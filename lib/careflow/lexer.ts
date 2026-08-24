import { LexError, TokenKind, type SourceLocation, type Token } from "./types";

const KEYWORDS: Record<string, TokenKind> = {
  workflow: TokenKind.Workflow,
  monitor: TokenKind.Monitor,
  rule: TokenKind.Rule,
  when: TokenKind.When,
  then: TokenKind.Then,
  alert: TokenKind.Alert,
  priority: TokenKind.Priority,
  escalate: TokenKind.Escalate,
  for: TokenKind.For,
  require: TokenKind.Require,
  acknowledgment: TokenKind.Acknowledgment,
  acknowledgement: TokenKind.Acknowledgment,
  within: TokenKind.Within,
  otherwise: TokenKind.Otherwise,
};

export function lex(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}

class Lexer {
  private readonly source: string;
  private index = 0;
  private line = 1;
  private column = 1;
  private readonly tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.skipTrivia();
      if (this.isAtEnd()) break;

      const start = this.mark();
      const char = this.peek();

      if (isIdentStart(char)) {
        this.readIdentifierOrKeyword(start);
        continue;
      }
      if (isDigit(char) || (char === "." && isDigit(this.peekNext()))) {
        this.readNumber(start);
        continue;
      }

      switch (char) {
        case "{":
          this.advance();
          this.emit(TokenKind.LBrace, "{", start);
          break;
        case "}":
          this.advance();
          this.emit(TokenKind.RBrace, "}", start);
          break;
        case "<":
          this.advance();
          if (this.peek() === "=") {
            this.advance();
            this.emit(TokenKind.Le, "<=", start);
          } else {
            this.emit(TokenKind.Lt, "<", start);
          }
          break;
        case ">":
          this.advance();
          if (this.peek() === "=") {
            this.advance();
            this.emit(TokenKind.Ge, ">=", start);
          } else {
            this.emit(TokenKind.Gt, ">", start);
          }
          break;
        case "=":
          this.advance();
          if (this.peek() === "=") {
            this.advance();
            this.emit(TokenKind.Eq, "==", start);
          } else {
            throw new LexError(
              `Unexpected '='. Use '==' for equality.`,
              this.locFrom(start),
            );
          }
          break;
        case "!":
          this.advance();
          if (this.peek() === "=") {
            this.advance();
            this.emit(TokenKind.Ne, "!=", start);
          } else {
            throw new LexError(
              `Unexpected '!'. Use '!=' for inequality.`,
              this.locFrom(start),
            );
          }
          break;
        default:
          throw new LexError(
            `Unexpected character ${JSON.stringify(char)}.`,
            this.locFrom(start),
          );
      }
    }

    const eofMark = this.mark();
    this.tokens.push({
      kind: TokenKind.Eof,
      lexeme: "",
      loc: this.locFrom(eofMark),
    });
    return this.tokens;
  }

  private readIdentifierOrKeyword(start: Mark): void {
    while (isIdentContinue(this.peek())) {
      this.advance();
    }
    const lexeme = this.source.slice(start.offset, this.index);
    const kind = KEYWORDS[lexeme] ?? TokenKind.Identifier;
    this.emit(kind, lexeme, start);
  }

  private readNumber(start: Mark): void {
    while (isDigit(this.peek())) {
      this.advance();
    }
    if (this.peek() === "." && isDigit(this.peekNext())) {
      this.advance();
      while (isDigit(this.peek())) {
        this.advance();
      }
    }
    const lexeme = this.source.slice(start.offset, this.index);
    const numericValue = Number(lexeme);
    if (!Number.isFinite(numericValue)) {
      throw new LexError(`Invalid numeric literal '${lexeme}'.`, this.locFrom(start));
    }
    this.tokens.push({
      kind: TokenKind.Number,
      lexeme,
      numericValue,
      loc: this.locFrom(start),
    });
  }

  private skipTrivia(): void {
    for (;;) {
      if (this.isAtEnd()) return;
      const char = this.peek();
      if (char === " " || char === "\t" || char === "\r") {
        this.advance();
        continue;
      }
      if (char === "\n") {
        this.advance();
        continue;
      }
      if (char === "/" && this.peekNext() === "/") {
        while (!this.isAtEnd() && this.peek() !== "\n") {
          this.advance();
        }
        continue;
      }
      return;
    }
  }

  private emit(kind: TokenKind, lexeme: string, start: Mark): void {
    this.tokens.push({ kind, lexeme, loc: this.locFrom(start) });
  }

  private mark(): Mark {
    return { line: this.line, column: this.column, offset: this.index };
  }

  private locFrom(start: Mark): SourceLocation {
    return {
      line: start.line,
      column: start.column,
      offset: start.offset,
      length: this.index - start.offset,
    };
  }

  private peek(): string {
    return this.source[this.index] ?? "";
  }

  private peekNext(): string {
    return this.source[this.index + 1] ?? "";
  }

  private advance(): string {
    const char = this.source[this.index] ?? "";
    this.index += 1;
    if (char === "\n") {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }
    return char;
  }

  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }
}

interface Mark {
  line: number;
  column: number;
  offset: number;
}

function isIdentStart(char: string): boolean {
  return /[A-Za-z_]/.test(char);
}

function isIdentContinue(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}
