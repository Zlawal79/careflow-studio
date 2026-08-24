export type {
  Action,
  AlertAction,
  AcknowledgementClause,
  AstNode,
  ComparisonCondition,
  Condition,
  EscalateAction,
  Identifier,
  DurationLiteral,
  MonitorDeclaration,
  NumberLiteral,
  PriorityAction,
  Rule,
  Workflow,
} from "./ast";
export { EXAMPLE_PROGRAMS, DEMO_PATIENT, SYNTHETIC_DISCLAIMER } from "./examples";
export type { ExampleProgram } from "./examples";
export { interpret, simulate } from "./interpreter";
export { lex } from "./lexer";
export { parse, parseTokens } from "./parser";
export {
  CareFlowError,
  InterpreterError,
  LexError,
  ParseError,
  DURATION_UNITS,
  PRIORITY_LEVELS,
  TokenKind,
  durationToMs,
  isDurationUnit,
  isPriorityLevel,
  unknownLocation,
} from "./types";
export type {
  ComparisonOperator,
  AcknowledgementState,
  AcknowledgementStatus,
  ConditionStatus,
  Diagnostic,
  DiagnosticCode,
  DurationRequirement,
  DurationUnit,
  EvaluatedCondition,
  EvaluatedRule,
  FiredAction,
  InterpreterResult,
  PatientState,
  PriorityLevel,
  SimulationEvent,
  SimulationResult,
  SimulationStepInput,
  SourceLocation,
  Token,
  TraceEvent,
  ValidationResult,
} from "./types";
export { validate } from "./validator";

import { interpret, simulate } from "./interpreter";
import { parse } from "./parser";
import {
  InterpreterError,
  type InterpreterResult,
  type PatientState,
  type SimulationResult,
  type SimulationStepInput,
} from "./types";
import { validate } from "./validator";

/** Parse source and evaluate it. Validation is returned alongside the result. */
export function run(
  source: string,
  patient: PatientState,
): { ast: ReturnType<typeof parse>; validation: ReturnType<typeof validate>; result: InterpreterResult } {
  const ast = parse(source);
  const validation = validate(ast);
  if (!validation.ok) {
    const firstError = validation.diagnostics.find((diagnostic) => diagnostic.severity === "error")!;
    throw new InterpreterError(
      `Workflow failed validation: ${firstError.message}`,
      firstError.loc,
    );
  }
  const result = interpret(ast, patient);
  return { ast, validation, result };
}

/** Parse, validate, and simulate source. Programs with semantic errors never execute. */
export function runSimulation(
  source: string,
  inputs: readonly SimulationStepInput[],
): { ast: ReturnType<typeof parse>; validation: ReturnType<typeof validate>; result: SimulationResult } {
  const ast = parse(source);
  const validation = validate(ast);
  if (!validation.ok) {
    const firstError = validation.diagnostics.find((diagnostic) => diagnostic.severity === "error")!;
    throw new InterpreterError(
      `Workflow failed validation: ${firstError.message}`,
      firstError.loc,
    );
  }
  return { ast, validation, result: simulate(ast, inputs) };
}
