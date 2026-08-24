import type { Action, Rule, Workflow } from "./ast";
import type {
  AcknowledgementState, ComparisonOperator, ConditionStatus, DurationRequirement,
  EvaluatedRule, EscalationState, FiredAction, InterpreterResult, PatientState,
  SimulationEvent, SimulationResult, SimulationStepInput, TraceEvent, TraceKind,
} from "./types";

interface RuleRuntime {
  trueSinceMs: number | null;
  firedThisCycle: boolean;
  sequence: number;
  latestInstanceId: string | null;
  explicitEscalationTarget: string | null;
  pending: PendingAcknowledgement | null;
}

interface PendingAcknowledgement {
  instanceId: string;
  alertTimeMs: number;
  deadlineMs: number;
  acknowledgedAtMs: number | null;
  timedOut: boolean;
  escalated: boolean;
}

/** Evaluate one synthetic snapshot at t=0. Temporal rules remain waiting. */
export function interpret(workflow: Workflow, patient: PatientState): InterpreterResult {
  return simulate(workflow, [{ timeMs: 0, patient }]).final;
}

/** Deterministic simulation; timestamps must be strictly increasing. */
export function simulate(
  workflow: Workflow,
  inputs: readonly SimulationStepInput[],
): SimulationResult {
  if (inputs.length === 0) throw new Error("Simulation requires at least one step.");
  assertOrdered(inputs);

  const states = new Map<string, RuleRuntime>();
  for (const rule of workflow.rules) {
    states.set(rule.name.name, {
      trueSinceMs: null, firedThisCycle: false, sequence: 0,
      latestInstanceId: null, explicitEscalationTarget: null, pending: null,
    });
  }

  const allTrace: TraceEvent[] = [];
  const allActions: FiredAction[] = [];
  const events: SimulationEvent[] = [];
  const steps: InterpreterResult[] = [];

  for (const input of inputs) {
    const trace: TraceEvent[] = [];
    const stepActions: FiredAction[] = [];
    const evaluatedRules: EvaluatedRule[] = [];
    push(trace, "workflow_start", `Start workflow '${workflow.name.name}'.`, {
      timeMs: input.timeMs, loc: workflow.loc,
    });
    push(trace, "step_start", `Evaluate simulation step at ${input.timeMs}ms.`, { timeMs: input.timeMs });

    for (const rule of workflow.rules) {
      const state = states.get(rule.name.name)!;
      const actions: FiredAction[] = [];
      // Acknowledgement wins at the exact deadline because it is applied first.
      applyAcknowledgement(rule, state, input, trace);
      applyTimeout(rule, state, input.timeMs, actions, trace);
      const evaluation = evaluateRule(rule, state, input.patient, input.timeMs);

      if (evaluation.error) {
        push(trace, "error", evaluation.error, {
          ruleName: rule.name.name, timeMs: input.timeMs, loc: rule.condition.variable.loc,
        });
      } else {
        push(trace, "condition", `Condition ${rule.condition.variable.name} ${rule.condition.operator} ${rule.condition.threshold.value} is ${evaluation.comparisonHolds ? "TRUE" : "FALSE"}.`, {
          ruleName: rule.name.name, timeMs: input.timeMs, loc: rule.condition.loc,
        });
        if (evaluation.durationRequirement) {
          push(trace, "duration", `Temporal condition has held for ${evaluation.elapsedDurationMs}ms of ${evaluation.durationRequirement.milliseconds}ms.`, {
            ruleName: rule.name.name, timeMs: input.timeMs, loc: rule.condition.duration?.loc,
          });
        }
      }

      const acknowledgementOpen = state.pending &&
        state.pending.acknowledgedAtMs === null && !state.pending.timedOut;
      if (evaluation.conditionStatus === "satisfied" && !state.firedThisCycle && !acknowledgementOpen) {
        state.firedThisCycle = true;
        state.sequence += 1;
        state.latestInstanceId = `${rule.name.name}#${state.sequence}`;
        state.explicitEscalationTarget = null;
        for (const action of rule.actions) {
          const fired = toFiredAction(action, rule.name.name, state.latestInstanceId, input.timeMs, "then");
          actions.push(fired);
          if (fired.kind === "escalate") state.explicitEscalationTarget = fired.target;
          push(trace, "action", describeAction(fired), {
            ruleName: rule.name.name, loc: action.loc, timeMs: input.timeMs,
          });
        }
        if (rule.acknowledgement) {
          state.pending = {
            instanceId: state.latestInstanceId,
            alertTimeMs: input.timeMs,
            deadlineMs: input.timeMs + rule.acknowledgement.within.milliseconds,
            acknowledgedAtMs: null, timedOut: false, escalated: false,
          };
          push(trace, "acknowledgement", `Acknowledgement pending for '${state.latestInstanceId}' until ${state.pending.deadlineMs}ms.`, {
            ruleName: rule.name.name, timeMs: input.timeMs,
          });
        }
      }

      stepActions.push(...actions);
      const acknowledgement = acknowledgementState(rule, state, input.timeMs);
      const escalation = escalationState(rule, state);
      const condition = {
        variable: rule.condition.variable.name,
        operator: rule.condition.operator,
        threshold: rule.condition.threshold.value,
        actual: evaluation.actual,
        durationRequirement: evaluation.durationRequirement,
        elapsedDurationMs: evaluation.elapsedDurationMs,
        comparisonHolds: evaluation.comparisonHolds,
        result: evaluation.result,
        error: evaluation.error,
      };
      const evaluated: EvaluatedRule = {
        ruleName: rule.name.name,
        monitoredVariable: rule.condition.variable.name,
        observedValue: evaluation.actual,
        operator: rule.condition.operator,
        threshold: rule.condition.threshold.value,
        durationRequirement: evaluation.durationRequirement,
        elapsedDurationMs: evaluation.elapsedDurationMs,
        comparisonHolds: evaluation.comparisonHolds,
        result: evaluation.result,
        matched: evaluation.result === true,
        firingInstanceId: state.latestInstanceId,
        actions, acknowledgement, escalation, condition,
      };
      evaluatedRules.push(evaluated);
      events.push({
        timestamp: input.timeMs,
        ruleName: rule.name.name,
        firingInstanceId: state.latestInstanceId,
        observedValue: evaluation.actual,
        conditionStatus: evaluation.conditionStatus,
        elapsedDurationMs: evaluation.elapsedDurationMs,
        durationRequirement: evaluation.durationRequirement,
        actions,
        acknowledgementStatus: acknowledgement.status,
        escalationStatus: escalation,
      });
    }

    push(trace, "workflow_end", `Finished workflow '${workflow.name.name}'.`, {
      timeMs: input.timeMs, loc: workflow.loc,
    });

    allActions.push(...stepActions);
    allTrace.push(...trace.map((event) => ({ ...event, index: allTrace.length + event.index })));
    steps.push({
      workflowName: workflow.name.name,
      patient: { ...input.patient },
      timeMs: input.timeMs,
      rules: evaluatedRules,
      triggeredActions: stepActions,
      trace,
    });
  }

  return {
    workflowName: workflow.name.name,
    steps,
    final: steps.at(-1)!,
    triggeredActions: allActions,
    events,
    trace: allTrace,
  };
}

function evaluateRule(rule: Rule, state: RuleRuntime, patient: PatientState, timeMs: number) {
  const variable = rule.condition.variable.name;
  const hasValue = Object.prototype.hasOwnProperty.call(patient, variable);
  const actual = hasValue ? patient[variable]! : null;
  const requirement = durationRequirement(rule);
  let comparisonHolds: boolean | null = null;
  let result: boolean | null = null;
  let error: string | undefined;
  let conditionStatus: ConditionStatus;

  if (!hasValue || !Number.isFinite(actual)) {
    state.trueSinceMs = null;
    state.firedThisCycle = false;
    error = `Patient state is missing a finite value for '${variable}'.`;
    conditionStatus = "unknown";
  } else {
    comparisonHolds = compare(actual!, rule.condition.operator, rule.condition.threshold.value);
    if (!comparisonHolds) {
      state.trueSinceMs = null;
      state.firedThisCycle = false;
      result = false;
      conditionStatus = "false";
    } else if (!requirement) {
      result = true;
      conditionStatus = "satisfied";
    } else {
      state.trueSinceMs ??= timeMs;
      result = timeMs - state.trueSinceMs >= requirement.milliseconds;
      conditionStatus = result ? "satisfied" : "waiting";
    }
  }

  return {
    actual,
    durationRequirement: requirement,
    elapsedDurationMs: state.trueSinceMs === null ? 0 : timeMs - state.trueSinceMs,
    comparisonHolds, result, error, conditionStatus,
  };
}

function applyAcknowledgement(
  rule: Rule, state: RuleRuntime, input: SimulationStepInput, trace: TraceEvent[],
): void {
  const pending = state.pending;
  if (!pending || pending.acknowledgedAtMs !== null || pending.timedOut) return;
  const requested = input.acknowledge ?? [];
  if (requested.includes(rule.name.name) || requested.includes(pending.instanceId)) {
    pending.acknowledgedAtMs = input.timeMs;
    push(trace, "acknowledgement", `Acknowledged '${pending.instanceId}'.`, {
      ruleName: rule.name.name, timeMs: input.timeMs,
    });
  }
}

function applyTimeout(
  rule: Rule, state: RuleRuntime, timeMs: number,
  actions: FiredAction[], trace: TraceEvent[],
): void {
  const pending = state.pending;
  if (!pending || pending.acknowledgedAtMs !== null || pending.timedOut || timeMs < pending.deadlineMs) return;
  pending.timedOut = true;
  push(trace, "acknowledgement", `Acknowledgement missed for '${pending.instanceId}'.`, {
    ruleName: rule.name.name, timeMs,
  });
  if (rule.acknowledgement?.otherwise && !pending.escalated) {
    pending.escalated = true;
    const fired = toFiredAction(
      rule.acknowledgement.otherwise, rule.name.name, pending.instanceId,
      timeMs, "acknowledgement_timeout",
    );
    actions.push(fired);
    push(trace, "escalation", describeAction(fired), {
      ruleName: rule.name.name, timeMs, loc: rule.acknowledgement.otherwise.loc,
    });
  }
}

function acknowledgementState(rule: Rule, state: RuleRuntime, timeMs: number): AcknowledgementState {
  if (!rule.acknowledgement) return {
    required: false, status: "not_required", windowMs: null,
    elapsedSinceAlertMs: null, acknowledgedAtMs: null, deadlineMs: null,
  };
  const pending = state.pending;
  if (!pending) return {
    required: true, status: "not_required", windowMs: rule.acknowledgement.within.milliseconds,
    elapsedSinceAlertMs: null, acknowledgedAtMs: null, deadlineMs: null,
  };
  const status = pending.acknowledgedAtMs !== null ? "acknowledged"
    : pending.escalated ? "escalated" : pending.timedOut ? "missed" : "pending";
  return {
    required: true, status,
    windowMs: rule.acknowledgement.within.milliseconds,
    elapsedSinceAlertMs: timeMs - pending.alertTimeMs,
    acknowledgedAtMs: pending.acknowledgedAtMs,
    deadlineMs: pending.deadlineMs,
  };
}

function escalationState(rule: Rule, state: RuleRuntime): EscalationState {
  const pending = state.pending;
  if (pending?.escalated) return {
    pending: false, triggered: true,
    target: rule.acknowledgement?.otherwise?.target.name ?? null,
    reason: "acknowledgement_timeout",
  };
  if (pending && pending.acknowledgedAtMs === null && !pending.timedOut) return {
    pending: true, triggered: false,
    target: rule.acknowledgement?.otherwise?.target.name ?? null,
    reason: "awaiting_acknowledgement",
  };
  if (state.explicitEscalationTarget) return {
    pending: false, triggered: true, target: state.explicitEscalationTarget,
    reason: "explicit_action",
  };
  return { pending: false, triggered: false, target: null, reason: "not_applicable" };
}

function durationRequirement(rule: Rule): DurationRequirement | null {
  const duration = rule.condition.duration;
  return duration ? {
    value: duration.value.value, unit: duration.unit, milliseconds: duration.milliseconds,
  } : null;
}

function assertOrdered(inputs: readonly SimulationStepInput[]): void {
  for (let index = 0; index < inputs.length; index += 1) {
    const current = inputs[index]!.timeMs;
    if (!Number.isFinite(current) || current < 0) {
      throw new Error(`Simulation timestamp at index ${index} must be finite and non-negative.`);
    }
    if (index > 0 && current <= inputs[index - 1]!.timeMs) {
      throw new Error("Simulation timestamps must be strictly increasing.");
    }
  }
}

function compare(left: number, operator: ComparisonOperator, right: number): boolean {
  switch (operator) {
    case "<": return left < right;
    case ">": return left > right;
    case "<=": return left <= right;
    case ">=": return left >= right;
    case "==": return left === right;
    case "!=": return left !== right;
  }
}

function toFiredAction(
  action: Action, ruleName: string, firingInstanceId: string,
  timeMs: number, reason: FiredAction["reason"],
): FiredAction {
  switch (action.type) {
    case "AlertAction":
      return { kind: "alert", target: action.recipient.name, ruleName, firingInstanceId, timeMs, reason };
    case "PriorityAction":
      return { kind: "priority", target: action.level.name, ruleName, firingInstanceId, timeMs, reason };
    case "EscalateAction":
      return { kind: "escalate", target: action.target.name, ruleName, firingInstanceId, timeMs, reason };
  }
}

function describeAction(action: FiredAction): string {
  return `Action: ${action.kind} ${action.target} (${action.reason})`;
}

function push(
  trace: TraceEvent[], kind: TraceKind, message: string,
  extra: { ruleName?: string; loc?: TraceEvent["loc"]; timeMs?: number },
): void {
  trace.push({ index: trace.length, kind, message, ...extra });
}
