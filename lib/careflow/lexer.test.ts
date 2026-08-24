import { describe, expect, it } from "vitest";
import { lex } from "./lexer";
import { LexError, TokenKind } from "./types";

describe("lexer", () => {
  it("tokenizes keywords, identifiers, numbers, braces, and operators", () => {
    const tokens = lex("workflow sample { monitor oxygen when x <= 92 }");
    const kinds = tokens.map((token) => token.kind);
    expect(kinds).toEqual([
      TokenKind.Workflow,
      TokenKind.Identifier,
      TokenKind.LBrace,
      TokenKind.Monitor,
      TokenKind.Identifier,
      TokenKind.When,
      TokenKind.Identifier,
      TokenKind.Le,
      TokenKind.Number,
      TokenKind.RBrace,
      TokenKind.Eof,
    ]);
    const number = tokens.find((token) => token.kind === TokenKind.Number);
    expect(number?.numericValue).toBe(92);
  });

  it("recognizes all comparison operators", () => {
    const tokens = lex("< > <= >= == !=");
    expect(tokens.slice(0, 6).map((token) => token.lexeme)).toEqual([
      "<",
      ">",
      "<=",
      ">=",
      "==",
      "!=",
    ]);
  });

  it("records 1-based line and column locations", () => {
    const source = "workflow demo {\n  monitor oxygen\n}";
    const tokens = lex(source);
    const workflow = tokens[0]!;
    expect(workflow.loc).toMatchObject({ line: 1, column: 1, offset: 0 });
    const monitor = tokens.find((token) => token.kind === TokenKind.Monitor)!;
    expect(monitor.loc.line).toBe(2);
    expect(monitor.loc.column).toBe(3);
  });

  it("skips // comments", () => {
    const tokens = lex("// ignore me\nworkflow demo {\n}");
    expect(tokens[0]?.kind).toBe(TokenKind.Workflow);
  });

  it("parses decimal numbers", () => {
    const tokens = lex("6.5");
    expect(tokens[0]?.numericValue).toBe(6.5);
  });

  it("rejects a single equals sign", () => {
    expect(() => lex("oxygen = 92")).toThrow(LexError);
    try {
      lex("oxygen = 92");
    } catch (error) {
      expect(error).toBeInstanceOf(LexError);
      expect((error as LexError).loc.column).toBe(8);
    }
  });

  it("rejects unknown characters with a location", () => {
    expect(() => lex("workflow @")).toThrow(/Unexpected character/);
  });
});
