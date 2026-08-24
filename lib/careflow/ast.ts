import type { ComparisonOperator, DurationUnit, SourceLocation } from "./types";

/**
 * CareFlow AST.
 *
 * `Condition` stays a comparison with an optional temporal `duration` so
 * `when oxygen < 92` and `when oxygen < 92 for 30 seconds` share a node.
 * Acknowledgement clauses hang off `Rule` rather than `Action` so later
 * phases can add deadlines without overloading the then-block.
 */

export interface Identifier {
  type: "Identifier";
  name: string;
  loc: SourceLocation;
}

export interface NumberLiteral {
  type: "NumberLiteral";
  value: number;
  raw: string;
  loc: SourceLocation;
}

export interface DurationLiteral {
  type: "DurationLiteral";
  value: NumberLiteral;
  unit: DurationUnit;
  milliseconds: number;
  loc: SourceLocation;
}

export interface MonitorDeclaration {
  type: "MonitorDeclaration";
  name: Identifier;
  loc: SourceLocation;
}

export interface ComparisonCondition {
  type: "ComparisonCondition";
  variable: Identifier;
  operator: ComparisonOperator;
  threshold: NumberLiteral;
  duration: DurationLiteral | null;
  loc: SourceLocation;
}

export type Condition = ComparisonCondition;

export interface AlertAction {
  type: "AlertAction";
  recipient: Identifier;
  loc: SourceLocation;
}

export interface PriorityAction {
  type: "PriorityAction";
  level: Identifier;
  loc: SourceLocation;
}

export interface EscalateAction {
  type: "EscalateAction";
  target: Identifier;
  loc: SourceLocation;
}

export type Action = AlertAction | PriorityAction | EscalateAction;

export interface AcknowledgementClause {
  type: "AcknowledgementClause";
  within: DurationLiteral;
  otherwise: EscalateAction | null;
  loc: SourceLocation;
}

export interface Rule {
  type: "Rule";
  name: Identifier;
  condition: Condition;
  actions: Action[];
  acknowledgement: AcknowledgementClause | null;
  loc: SourceLocation;
}

export interface Workflow {
  type: "Workflow";
  name: Identifier;
  monitors: MonitorDeclaration[];
  rules: Rule[];
  loc: SourceLocation;
}

export type AstNode =
  | Identifier
  | NumberLiteral
  | DurationLiteral
  | MonitorDeclaration
  | ComparisonCondition
  | AlertAction
  | PriorityAction
  | EscalateAction
  | AcknowledgementClause
  | Rule
  | Workflow;
