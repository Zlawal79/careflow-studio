export type {
  Action,
  AlertAction,
  AstNode,
  ComparisonCondition,
  Condition,
  EscalateAction,
  Identifier,
  MonitorDeclaration,
  NumberLiteral,
  PriorityAction,
  Rule,
  Workflow,
} from "./ast";
export { EXAMPLE_PROGRAMS, DEMO_PATIENT, SYNTHETIC_DISCLAIMER } from "./examples";
export type { ExampleProgram } from "./examples";
export { interpret } from "./interpreter";
export { lex } from "./lexer";
export { parse, parseTokens } from "./parser";
export {
  CareFlowError,
  InterpreterError,
  LexError,
  ParseError,
  PRIORITY_LEVELS,
  TokenKind,
  isPriorityLevel,
  unknownLocation,
} from "./types";
export type {
  ComparisonOperator,
  Diagnostic,
  DiagnosticCode,
  EvaluatedCondition,
  EvaluatedRule,
  FiredAction,
  InterpreterResult,
  PatientState,
  PriorityLevel,
  SourceLocation,
  Token,
  TraceEvent,
  ValidationResult,
} from "./types";
export { validate } from "./validator";

import { interpret } from "./interpreter";
import { parse } from "./parser";
import type { InterpreterResult, PatientState } from "./types";
import { validate } from "./validator";

/** Parse source and evaluate it. Validation is returned alongside the result. */
export function run(
  source: string,
  patient: PatientState,
): { ast: ReturnType<typeof parse>; validation: ReturnType<typeof validate>; result: InterpreterResult } {
  const ast = parse(source);
  const validation = validate(ast);
  const result = interpret(ast, patient);
  return { ast, validation, result };
}
