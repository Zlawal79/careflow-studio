import { describe, expect, it } from "vitest";
import { DEMO_PATIENT, respiratoryMonitoring } from "./examples";
import { interpret } from "./interpreter";
import { parse } from "./parser";
import { run } from "./index";

describe("interpreter", () => {
  it("evaluates rules against a synthetic patient and records a trace", () => {
    const ast = parse(respiratoryMonitoring.source);
    const result = interpret(ast, {
      oxygen: 87,
      heart_rate: 82,
      blood_pressure: 120,
      temperature: 37,
    });

    expect(result.workflowName).toBe("respiratory_monitor");
    expect(result.rules).toHaveLength(2);

    const low = result.rules.find((rule) => rule.ruleName === "low_oxygen")!;
    expect(low.condition.result).toBe(true);
    expect(low.matched).toBe(true);
    expect(low.actions.map((action) => action.kind)).toEqual(["alert", "priority"]);

    const severe = result.rules.find((rule) => rule.ruleName === "severe_hypoxia")!;
    expect(severe.condition).toMatchObject({
      variable: "oxygen",
      operator: "<",
      threshold: 88,
      actual: 87,
      result: true,
    });
    expect(severe.actions.map((action) => `${action.kind}:${action.target}`)).toEqual([
      "alert:physician",
      "priority:critical",
      "escalate:rapid_response",
    ]);

    expect(result.triggeredActions.length).toBe(5);
    expect(result.trace.some((event) => event.kind === "condition" && event.message.includes("TRUE"))).toBe(
      true,
    );
    expect(result.trace[0]?.kind).toBe("workflow_start");
    expect(result.trace.at(-1)?.kind).toBe("workflow_end");
  });

  it("marks non-matching conditions as FALSE without firing actions", () => {
    const ast = parse(respiratoryMonitoring.source);
    const result = interpret(ast, { oxygen: 98, heart_rate: 70 });
    expect(result.rules.every((rule) => rule.matched === false)).toBe(true);
    expect(result.triggeredActions).toHaveLength(0);
    expect(result.rules[0]?.condition.result).toBe(false);
  });

  it("records an error when the patient is missing a required variable", () => {
    const ast = parse(respiratoryMonitoring.source);
    const result = interpret(ast, { heart_rate: 80 });
    expect(result.rules[0]?.matched).toBe(false);
    expect(result.rules[0]?.condition.error).toMatch(/missing 'oxygen'/);
    expect(result.trace.some((event) => event.kind === "error")).toBe(true);
  });

  it("exposes parse + validate + interpret through run()", () => {
    const { result, validation } = run(respiratoryMonitoring.source, DEMO_PATIENT);
    expect(validation.diagnostics.some((d) => d.code === "unused_monitor")).toBe(true);
    expect(result.rules.some((rule) => rule.ruleName === "severe_hypoxia" && rule.matched)).toBe(true);
  });
});
