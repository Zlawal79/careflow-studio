import type { Action, ComparisonCondition, Workflow } from "./ast";
import {
  isPriorityLevel,
  type Diagnostic,
  type ValidationResult,
} from "./types";

/**
 * Static checks for a parsed workflow. Parser errors (unknown actions,
 * malformed syntax) are reported at parse time; this pass covers semantic
 * issues that need the full AST.
 */
export function validate(workflow: Workflow): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const monitorNames = new Map<string, (typeof workflow.monitors)[number]>();
  const ruleNames = new Map<string, (typeof workflow.rules)[number]>();
  const usedMonitors = new Set<string>();

  for (const monitor of workflow.monitors) {
    const existing = monitorNames.get(monitor.name.name);
    if (existing) {
      diagnostics.push({
        code: "duplicate_monitor",
        severity: "error",
        message: `Monitor '${monitor.name.name}' is declared more than once.`,
        loc: monitor.name.loc,
        related: [existing.name.loc],
      });
    } else {
      monitorNames.set(monitor.name.name, monitor);
    }
  }

  for (const rule of workflow.rules) {
    const existing = ruleNames.get(rule.name.name);
    if (existing) {
      diagnostics.push({
        code: "duplicate_rule",
        severity: "error",
        message: `Rule '${rule.name.name}' is declared more than once.`,
        loc: rule.name.loc,
        related: [existing.name.loc],
      });
    } else {
      ruleNames.set(rule.name.name, rule);
    }

    const variable = rule.condition.variable.name;
    usedMonitors.add(variable);
    if (!monitorNames.has(variable)) {
      diagnostics.push({
        code: "undeclared_variable",
        severity: "error",
        message: `Variable '${variable}' is used in rule '${rule.name.name}' but was not declared with 'monitor'.`,
        loc: rule.condition.variable.loc,
      });
    }

    if (rule.actions.length === 0) {
      diagnostics.push({
        code: "empty_rule",
        severity: "error",
        message: `Rule '${rule.name.name}' has no actions.`,
        loc: rule.loc,
      });
    }

    for (const action of rule.actions) {
      checkAction(action, diagnostics);
    }

    if (rule.condition.duration && (
      !Number.isFinite(rule.condition.duration.milliseconds) ||
      rule.condition.duration.milliseconds <= 0
    )) {
      diagnostics.push({
        code: "invalid_duration",
        severity: "error",
        message: `Temporal duration in rule '${rule.name.name}' must be greater than zero.`,
        loc: rule.condition.duration.loc,
      });
    }

    if (rule.acknowledgement) {
      if (
        !Number.isFinite(rule.acknowledgement.within.milliseconds) ||
        rule.acknowledgement.within.milliseconds <= 0
      ) {
        diagnostics.push({
          code: "invalid_duration",
          severity: "error",
          message: `Acknowledgement duration in rule '${rule.name.name}' must be greater than zero.`,
          loc: rule.acknowledgement.within.loc,
        });
      }
      if (!rule.actions.some((action) => action.type === "AlertAction")) {
        diagnostics.push({
          code: "ack_without_alert",
          severity: "error",
          message: `Rule '${rule.name.name}' requires acknowledgement but does not alert a recipient.`,
          loc: rule.acknowledgement.loc,
        });
      }
      if (!rule.acknowledgement.otherwise) {
        diagnostics.push({
          code: "ack_missing_escalation",
          severity: "error",
          message: `Rule '${rule.name.name}' requires acknowledgement but has no 'otherwise escalate' target.`,
          loc: rule.acknowledgement.loc,
        });
      }
    }
  }

  for (const monitor of workflow.monitors) {
    if (!usedMonitors.has(monitor.name.name)) {
      diagnostics.push({
        code: "unused_monitor",
        severity: "warning",
        message: `Monitor '${monitor.name.name}' is declared but never used in a condition.`,
        loc: monitor.name.loc,
      });
    }
  }

  checkConditionRelationships(workflow, diagnostics);

  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics,
  };
}

function checkAction(action: Action, diagnostics: Diagnostic[]): void {
  if (action.type === "PriorityAction" && !isPriorityLevel(action.level.name)) {
    diagnostics.push({
      code: "invalid_priority",
      severity: "error",
      message: `Invalid priority '${action.level.name}'. Expected one of: low, medium, high, critical.`,
      loc: action.level.loc,
    });
  }
}

function checkConditionRelationships(
  workflow: Workflow,
  diagnostics: Diagnostic[],
): void {
  const rules = workflow.rules;
  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const left = rules[i]!;
      const right = rules[j]!;
      const a = left.condition;
      const b = right.condition;
      if (a.variable.name !== b.variable.name) continue;

      if (sameCondition(a, b)) {
        diagnostics.push({
          code: "duplicate_condition",
          severity: "warning",
          message: `Rules '${left.name.name}' and '${right.name.name}' have identical conditions.`,
          loc: b.loc,
          related: [a.loc],
        });
        continue;
      }

      if (implies(a, b)) {
        diagnostics.push({
          code: "subsumed_condition",
          severity: "warning",
          message: `Condition of rule '${right.name.name}' is always true whenever '${left.name.name}' matches, so the two rules overlap.`,
          loc: b.loc,
          related: [a.loc],
        });
      } else if (implies(b, a)) {
        diagnostics.push({
          code: "subsumed_condition",
          severity: "warning",
          message: `Condition of rule '${left.name.name}' is always true whenever '${right.name.name}' matches, so the two rules overlap.`,
          loc: a.loc,
          related: [b.loc],
        });
      }

      if (mutuallyExclusive(a, b)) {
        diagnostics.push({
          code: "mutually_exclusive_conditions",
          severity: "warning",
          message: `Rules '${left.name.name}' and '${right.name.name}' have mutually exclusive conditions; they cannot both match the same patient state.`,
          loc: b.loc,
          related: [a.loc],
        });
      }
    }
  }
}

function sameCondition(a: ComparisonCondition, b: ComparisonCondition): boolean {
  return (
    a.variable.name === b.variable.name &&
    a.operator === b.operator &&
    a.threshold.value === b.threshold.value &&
    a.duration?.milliseconds === b.duration?.milliseconds
  );
}

/** True if every number satisfying `a` also satisfies `b`. */
function implies(a: ComparisonCondition, b: ComparisonCondition): boolean {
  if (a.variable.name !== b.variable.name) return false;
  if (a.duration?.milliseconds !== b.duration?.milliseconds) return false;
  const x = a.threshold.value;
  const y = b.threshold.value;

  switch (a.operator) {
    case "<":
      if (b.operator === "<") return x <= y;
      if (b.operator === "<=") return x <= y;
      if (b.operator === "!=") return y >= x;
      return false;
    case "<=":
      if (b.operator === "<") return x < y;
      if (b.operator === "<=") return x <= y;
      if (b.operator === "!=") return y > x;
      return false;
    case ">":
      if (b.operator === ">") return x >= y;
      if (b.operator === ">=") return x >= y;
      if (b.operator === "!=") return y <= x;
      return false;
    case ">=":
      if (b.operator === ">") return x > y;
      if (b.operator === ">=") return x >= y;
      if (b.operator === "!=") return y < x;
      return false;
    case "==":
      return evaluate(b.operator, x, y);
    case "!=":
      return b.operator === "!=" && x === y;
    default:
      return false;
  }
}

function mutuallyExclusive(a: ComparisonCondition, b: ComparisonCondition): boolean {
  if (a.variable.name !== b.variable.name) return false;
  return !rangesOverlap(a, b);
}

function rangesOverlap(a: ComparisonCondition, b: ComparisonCondition): boolean {
  return intervals(a).some((left) =>
    intervals(b).some((right) => intervalOverlap(left, right)),
  );
}

interface Interval {
  low: number;
  lowClosed: boolean;
  high: number;
  highClosed: boolean;
}

function intervals(condition: ComparisonCondition): Interval[] {
  const value = condition.threshold.value;
  switch (condition.operator) {
    case "<": return [{ low: -Infinity, lowClosed: false, high: value, highClosed: false }];
    case "<=": return [{ low: -Infinity, lowClosed: false, high: value, highClosed: true }];
    case ">": return [{ low: value, lowClosed: false, high: Infinity, highClosed: false }];
    case ">=": return [{ low: value, lowClosed: true, high: Infinity, highClosed: false }];
    case "==": return [{ low: value, lowClosed: true, high: value, highClosed: true }];
    case "!=": return [
      { low: -Infinity, lowClosed: false, high: value, highClosed: false },
      { low: value, lowClosed: false, high: Infinity, highClosed: false },
    ];
  }
}

function intervalOverlap(a: Interval, b: Interval): boolean {
  const low = Math.max(a.low, b.low);
  const high = Math.min(a.high, b.high);
  if (low < high) return true;
  if (low > high) return false;
  const lowIncluded = (low !== a.low || a.lowClosed) && (low !== b.low || b.lowClosed);
  const highIncluded = (high !== a.high || a.highClosed) && (high !== b.high || b.highClosed);
  return lowIncluded && highIncluded;
}

function evaluate(
  operator: ComparisonCondition["operator"],
  left: number,
  right: number,
): boolean {
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
