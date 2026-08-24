import type { Action, Workflow } from "./ast";
import type {
  EvaluatedRule,
  FiredAction,
  InterpreterResult,
  PatientState,
  TraceEvent,
  TraceKind,
} from "./types";
import type { ComparisonOperator } from "./types";

/**
 * Evaluates a CareFlow AST against a synthetic patient snapshot.
 *
 * Every rule is evaluated independently (multiple rules may fire). Later
 * phases can wrap this with time-series simulation and execution replay by
 * feeding successive `PatientState` snapshots and retaining `trace`.
 */
export function interpret(
  workflow: Workflow,
  patient: PatientState,
): InterpreterResult {
  const trace: TraceEvent[] = [];
  const rules: EvaluatedRule[] = [];
  const triggeredActions: FiredAction[] = [];

  push(trace, "workflow_start", `Start workflow '${workflow.name.name}'.`, {
    loc: workflow.loc,
  });

  for (const rule of workflow.rules) {
    push(trace, "rule_start", `Evaluate rule '${rule.name.name}'.`, {
      ruleName: rule.name.name,
      loc: rule.loc,
    });

    const variable = rule.condition.variable.name;
    const operator = rule.condition.operator;
    const threshold = rule.condition.threshold.value;
    const hasValue = Object.prototype.hasOwnProperty.call(patient, variable);
    const actual = hasValue ? patient[variable]! : null;

    let result: boolean | null = null;
    let error: string | undefined;
    if (!hasValue) {
      error = `Patient state is missing '${variable}'.`;
      result = null;
      push(trace, "error", error, {
        ruleName: rule.name.name,
        loc: rule.condition.variable.loc,
      });
    } else {
      result = compare(actual!, operator, threshold);
      push(
        trace,
        "condition",
        `Condition ${variable} ${operator} ${threshold} with actual ${actual} is ${result ? "TRUE" : "FALSE"}.`,
        { ruleName: rule.name.name, loc: rule.condition.loc },
      );
    }

    const matched = result === true;
    const actions: FiredAction[] = [];
    if (matched) {
      for (const action of rule.actions) {
        const fired = toFiredAction(action, rule.name.name);
        actions.push(fired);
        triggeredActions.push(fired);
        push(trace, "action", describeAction(fired), {
          ruleName: rule.name.name,
          loc: action.loc,
        });
      }
    }

    push(
      trace,
      "rule_end",
      `Rule '${rule.name.name}' ${matched ? "matched" : "did not match"}.`,
      { ruleName: rule.name.name, loc: rule.loc },
    );

    rules.push({
      ruleName: rule.name.name,
      condition: {
        variable,
        operator,
        threshold,
        actual,
        result,
        error,
      },
      matched,
      actions,
    });
  }

  push(
    trace,
    "workflow_end",
    `Finished workflow '${workflow.name.name}'. ${triggeredActions.length} action(s) triggered.`,
    { loc: workflow.loc },
  );

  return {
    workflowName: workflow.name.name,
    patient: { ...patient },
    rules,
    triggeredActions,
    trace,
  };
}

function compare(left: number, operator: ComparisonOperator, right: number): boolean {
  switch (operator) {
    case "<":
      return left < right;
    case ">":
      return left > right;
    case "<=":
      return left <= right;
    case ">=":
      return left >= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
  }
}

function toFiredAction(action: Action, ruleName: string): FiredAction {
  switch (action.type) {
    case "AlertAction":
      return { kind: "alert", target: action.recipient.name, ruleName };
    case "PriorityAction":
      return { kind: "priority", target: action.level.name, ruleName };
    case "EscalateAction":
      return { kind: "escalate", target: action.target.name, ruleName };
  }
}

function describeAction(action: FiredAction): string {
  switch (action.kind) {
    case "alert":
      return `Action: alert ${action.target}`;
    case "priority":
      return `Action: priority ${action.target}`;
    case "escalate":
      return `Action: escalate ${action.target}`;
  }
}

function push(
  trace: TraceEvent[],
  kind: TraceKind,
  message: string,
  extra: { ruleName?: string; loc?: TraceEvent["loc"] },
): void {
  trace.push({
    index: trace.length,
    kind,
    message,
    ruleName: extra.ruleName,
    loc: extra.loc,
  });
}
