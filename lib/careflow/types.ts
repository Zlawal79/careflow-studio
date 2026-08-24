/**
 * Shared compiler/runtime types for the CareFlow DSL.
 *
 * AST node shapes live in `ast.ts`. This file holds tokens, locations,
 * diagnostics, patient state, and interpreter I/O.
 */

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
  length: number;
}

export const TokenKind = {
  Workflow: "workflow",
  Monitor: "monitor",
  Rule: "rule",
  When: "when",
  Then: "then",
  Alert: "alert",
  Priority: "priority",
  Escalate: "escalate",
  For: "for",
  Require: "require",
  Acknowledgment: "acknowledgment",
  Within: "within",
  Otherwise: "otherwise",
  Identifier: "identifier",
  Number: "number",
  LBrace: "{",
  RBrace: "}",
  Lt: "<",
  Gt: ">",
  Le: "<=",
  Ge: ">=",
  Eq: "==",
  Ne: "!=",
  Eof: "eof",
} as const;

export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

export type ComparisonOperator = "<" | ">" | "<=" | ">=" | "==" | "!=";

export type DurationUnit =
  | "second"
  | "seconds"
  | "minute"
  | "minutes"
  | "hour"
  | "hours";

export const DURATION_UNITS: readonly DurationUnit[] = [
  "second",
  "seconds",
  "minute",
  "minutes",
  "hour",
  "hours",
];

export function isDurationUnit(value: string): value is DurationUnit {
  return (DURATION_UNITS as readonly string[]).includes(value);
}

/** Canonical unit plus milliseconds for a duration literal. */
export function durationToMs(value: number, unit: DurationUnit): number {
  switch (unit) {
    case "second":
    case "seconds":
      return value * 1000;
    case "minute":
    case "minutes":
      return value * 60_000;
    case "hour":
    case "hours":
      return value * 3_600_000;
  }
}

export interface Token {
  kind: TokenKind;
  lexeme: string;
  loc: SourceLocation;
  /** Present on number tokens. */
  numericValue?: number;
}

export const PRIORITY_LEVELS = ["low", "medium", "high", "critical"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export function isPriorityLevel(value: string): value is PriorityLevel {
  return (PRIORITY_LEVELS as readonly string[]).includes(value);
}

/** Synthetic vital/lab/device readings used to evaluate a workflow. */
export type PatientState = Record<string, number>;

export type DiagnosticSeverity = "error" | "warning";

export type DiagnosticCode =
  | "undeclared_variable"
  | "unused_monitor"
  | "duplicate_rule"
  | "duplicate_monitor"
  | "empty_rule"
  | "invalid_priority"
  | "invalid_duration"
  | "duplicate_condition"
  | "subsumed_condition"
  | "mutually_exclusive_conditions"
  | "ack_missing_escalation";

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  loc: SourceLocation;
  related?: SourceLocation[];
}

export interface ValidationResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

export interface DurationRequirement {
  value: number;
  unit: DurationUnit;
  milliseconds: number;
}

export interface EvaluatedCondition {
  variable: string;
  operator: ComparisonOperator;
  threshold: number;
  actual: number | null;
  durationRequirement: DurationRequirement | null;
  elapsedDurationMs: number;
  comparisonHolds: boolean | null;
  result: boolean | null;
  error?: string;
}

export interface FiredAction {
  kind: "alert" | "priority" | "escalate";
  target: string;
  ruleName: string;
  timeMs: number;
  reason: "then" | "acknowledgement_timeout";
}

export type AcknowledgementStatus =
  | "not_required"
  | "pending"
  | "acknowledged"
  | "missed"
  | "escalated";

export interface AcknowledgementState {
  required: boolean;
  status: AcknowledgementStatus;
  windowMs: number | null;
  elapsedSinceAlertMs: number | null;
  acknowledgedAtMs: number | null;
  deadlineMs: number | null;
}

export type EscalationReason =
  | "not_applicable"
  | "awaiting_acknowledgement"
  | "acknowledgement_timeout"
  | "explicit_action";

export interface EscalationState {
  pending: boolean;
  triggered: boolean;
  target: string | null;
  reason: EscalationReason;
}

export interface EvaluatedRule {
  ruleName: string;
  monitoredVariable: string;
  observedValue: number | null;
  operator: ComparisonOperator;
  threshold: number;
  durationRequirement: DurationRequirement | null;
  elapsedDurationMs: number;
  comparisonHolds: boolean | null;
  result: boolean | null;
  matched: boolean;
  actions: FiredAction[];
  acknowledgement: AcknowledgementState;
  escalation: EscalationState;
  condition: EvaluatedCondition;
}

export type TraceKind =
  | "workflow_start"
  | "step_start"
  | "rule_start"
  | "condition"
  | "duration"
  | "action"
  | "acknowledgement"
  | "escalation"
  | "rule_end"
  | "workflow_end"
  | "error";

export interface TraceEvent {
  index: number;
  kind: TraceKind;
  message: string;
  timeMs?: number;
  ruleName?: string;
  loc?: SourceLocation;
}

export interface InterpreterResult {
  workflowName: string;
  patient: PatientState;
  timeMs: number;
  rules: EvaluatedRule[];
  triggeredActions: FiredAction[];
  trace: TraceEvent[];
}

export interface SimulationStepInput {
  /** Absolute simulation time in milliseconds. */
  timeMs: number;
  patient: PatientState;
  /** Named rules acknowledged at this tick. */
  acknowledge?: string[];
}

export interface SimulationResult {
  workflowName: string;
  steps: InterpreterResult[];
  final: InterpreterResult;
  triggeredActions: FiredAction[];
  trace: TraceEvent[];
}

export class CareFlowError extends Error {
  readonly loc: SourceLocation;

  constructor(name: string, message: string, loc: SourceLocation) {
    super(`${loc.line}:${loc.column}: ${message}`);
    this.name = name;
    this.loc = loc;
  }
}

export class LexError extends CareFlowError {
  constructor(message: string, loc: SourceLocation) {
    super("LexError", message, loc);
  }
}

export class ParseError extends CareFlowError {
  constructor(message: string, loc: SourceLocation) {
    super("ParseError", message, loc);
  }
}

export class InterpreterError extends CareFlowError {
  constructor(message: string, loc: SourceLocation) {
    super("InterpreterError", message, loc);
  }
}

export function unknownLocation(): SourceLocation {
  return { line: 1, column: 1, offset: 0, length: 0 };
}
