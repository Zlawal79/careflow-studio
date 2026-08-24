import { describe, expect, it } from "vitest";
import { EXAMPLE_PROGRAMS, respiratoryMonitoring } from "./examples";
import { parse } from "./parser";
import { ParseError } from "./types";

describe("parser", () => {
  it("parses the respiratory monitoring example into a typed AST", () => {
    const ast = parse(respiratoryMonitoring.source);
    expect(ast.type).toBe("Workflow");
    expect(ast.name.name).toBe("respiratory_monitor");
    expect(ast.monitors.map((monitor) => monitor.name.name)).toEqual([
      "oxygen",
      "heart_rate",
    ]);
    expect(ast.rules).toHaveLength(2);
    expect(ast.rules[0]).toMatchObject({
      type: "Rule",
      name: { name: "low_oxygen" },
      condition: {
        type: "ComparisonCondition",
        variable: { name: "oxygen" },
        operator: "<",
        threshold: { value: 92 },
      },
    });
    expect(ast.rules[0]?.actions.map((action) => action.type)).toEqual([
      "AlertAction",
      "PriorityAction",
    ]);
    expect(
      ast.rules[1]?.actions.some(
        (action) => action.type === "EscalateAction" && action.target.name === "rapid_response",
      ),
    ).toBe(true);
  });

  it("parses every bundled example program", () => {
    for (const example of EXAMPLE_PROGRAMS) {
      const ast = parse(example.source);
      expect(ast.type).toBe("Workflow");
      expect(ast.rules.length).toBeGreaterThan(0);
    }
  });

  it("reports unknown actions as parse errors with locations", () => {
    const source = `
      workflow demo {
        monitor oxygen
        rule bad {
          when oxygen < 92
          then {
            notify nurse
          }
        }
      }
    `;
    expect(() => parse(source)).toThrow(ParseError);
    try {
      parse(source);
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError);
      expect((error as ParseError).message).toMatch(/Unknown action/);
      expect((error as ParseError).loc.line).toBeGreaterThan(1);
    }
  });

  it("requires comparison operators in conditions", () => {
    const source = `
      workflow demo {
        monitor oxygen
        rule bad {
          when oxygen 92
          then { alert nurse }
        }
      }
    `;
    expect(() => parse(source)).toThrow(/comparison operator/);
  });

  it("rejects extra tokens after the workflow", () => {
    expect(() => parse("workflow demo { } extra")).toThrow(/Unexpected input/);
  });
});
