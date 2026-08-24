import type {
  Action,
  ComparisonCondition,
  Identifier,
  MonitorDeclaration,
  NumberLiteral,
  Rule,
  Workflow,
} from "./ast";
import { lex } from "./lexer";
import {
  ParseError,
  TokenKind,
  type ComparisonOperator,
  type Token,
} from "./types";

/**
 * Recursive-descent parser.
 *
 * Grammar (Phase 1):
 *
 *   workflow     := "workflow" IDENT "{" body "}"
 *   body         := (monitor | rule)*
 *   monitor      := "monitor" IDENT
 *   rule         := "rule" IDENT "{" "when" condition "then" "{" action* "}" "}"
 *   condition    := IDENT comparison NUMBER
 *   comparison   := "<" | ">" | "<=" | ">=" | "==" | "!="
 *   action       := "alert" IDENT | "priority" IDENT | "escalate" IDENT
 *
 * Later phases can extend `condition` with temporal suffixes and `action`
 * with acknowledgement deadlines without changing this descent structure.
 */
export function parse(source: string): Workflow {
  return new Parser(lex(source)).parseWorkflow();
}

export function parseTokens(tokens: Token[]): Workflow {
  return new Parser(tokens).parseWorkflow();
}

class Parser {
  private readonly tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseWorkflow(): Workflow {
    const start = this.expect(TokenKind.Workflow, "Expected 'workflow' at the start of a program.");
    const name = this.parseIdentifier("Expected a workflow name.");
    this.expect(TokenKind.LBrace, "Expected '{' after the workflow name.");

    const monitors: MonitorDeclaration[] = [];
    const rules: Rule[] = [];

    while (!this.check(TokenKind.RBrace) && !this.check(TokenKind.Eof)) {
      if (this.check(TokenKind.Monitor)) {
        monitors.push(this.parseMonitor());
      } else if (this.check(TokenKind.Rule)) {
        rules.push(this.parseRule());
      } else {
        const token = this.peek();
        throw new ParseError(
          `Unexpected ${describe(token)} in workflow body. Expected 'monitor' or 'rule'.`,
          token.loc,
        );
      }
    }

    this.expect(TokenKind.RBrace, "Expected '}' to close the workflow.");
    this.expect(TokenKind.Eof, "Unexpected input after the workflow.");

    return {
      type: "Workflow",
      name,
      monitors,
      rules,
      loc: start.loc,
    };
  }

  private parseMonitor(): MonitorDeclaration {
    const start = this.expect(TokenKind.Monitor, "Expected 'monitor'.");
    const name = this.parseIdentifier("Expected a variable name after 'monitor'.");
    return { type: "MonitorDeclaration", name, loc: start.loc };
  }

  private parseRule(): Rule {
    const start = this.expect(TokenKind.Rule, "Expected 'rule'.");
    const name = this.parseIdentifier("Expected a rule name.");
    this.expect(TokenKind.LBrace, "Expected '{' after the rule name.");
    this.expect(TokenKind.When, "Expected 'when' to start the rule condition.");
    const condition = this.parseCondition();
    this.expect(TokenKind.Then, "Expected 'then' after the condition.");
    this.expect(TokenKind.LBrace, "Expected '{' after 'then'.");

    const actions: Action[] = [];
    while (!this.check(TokenKind.RBrace) && !this.check(TokenKind.Eof)) {
      actions.push(this.parseAction());
    }

    this.expect(TokenKind.RBrace, "Expected '}' to close the 'then' block.");
    this.expect(TokenKind.RBrace, "Expected '}' to close the rule.");

    return {
      type: "Rule",
      name,
      condition,
      actions,
      loc: start.loc,
    };
  }

  private parseCondition(): ComparisonCondition {
    const variable = this.parseIdentifier("Expected a monitored variable in the condition.");
    const operator = this.parseOperator();
    const threshold = this.parseNumber();
    return {
      type: "ComparisonCondition",
      variable,
      operator,
      threshold,
      loc: variable.loc,
    };
  }

  private parseAction(): Action {
    const token = this.peek();
    if (this.match(TokenKind.Alert)) {
      const recipient = this.parseIdentifier("Expected an alert recipient after 'alert'.");
      return { type: "AlertAction", recipient, loc: token.loc };
    }
    if (this.match(TokenKind.Priority)) {
      const level = this.parseIdentifier("Expected a priority level after 'priority'.");
      return { type: "PriorityAction", level, loc: token.loc };
    }
    if (this.match(TokenKind.Escalate)) {
      const target = this.parseIdentifier("Expected an escalation target after 'escalate'.");
      return { type: "EscalateAction", target, loc: token.loc };
    }
    throw new ParseError(
      `Unknown action ${describe(token)}. Expected 'alert', 'priority', or 'escalate'.`,
      token.loc,
    );
  }

  private parseOperator(): ComparisonOperator {
    const token = this.peek();
    const operators: Partial<Record<TokenKind, ComparisonOperator>> = {
      [TokenKind.Lt]: "<",
      [TokenKind.Gt]: ">",
      [TokenKind.Le]: "<=",
      [TokenKind.Ge]: ">=",
      [TokenKind.Eq]: "==",
      [TokenKind.Ne]: "!=",
    };
    const operator = operators[token.kind];
    if (!operator) {
      throw new ParseError(
        `Expected a comparison operator (<, >, <=, >=, ==, !=), found ${describe(token)}.`,
        token.loc,
      );
    }
    this.advance();
    return operator;
  }

  private parseIdentifier(message: string): Identifier {
    const token = this.expect(TokenKind.Identifier, message);
    return { type: "Identifier", name: token.lexeme, loc: token.loc };
  }

  private parseNumber(): NumberLiteral {
    const token = this.expect(TokenKind.Number, "Expected a numeric threshold.");
    return {
      type: "NumberLiteral",
      value: token.numericValue ?? Number(token.lexeme),
      raw: token.lexeme,
      loc: token.loc,
    };
  }

  private match(kind: TokenKind): boolean {
    if (this.check(kind)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(kind: TokenKind, message: string): Token {
    if (this.check(kind)) {
      return this.advance();
    }
    const token = this.peek();
    throw new ParseError(`${message} Found ${describe(token)}.`, token.loc);
  }

  private check(kind: TokenKind): boolean {
    return this.peek().kind === kind;
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1]!;
  }

  private advance(): Token {
    const token = this.peek();
    if (token.kind !== TokenKind.Eof) {
      this.current += 1;
    }
    return token;
  }
}

function describe(token: Token): string {
  if (token.kind === TokenKind.Eof) return "end of file";
  if (token.kind === TokenKind.Identifier) return `identifier '${token.lexeme}'`;
  if (token.kind === TokenKind.Number) return `number '${token.lexeme}'`;
  return `'${token.lexeme}'`;
}
