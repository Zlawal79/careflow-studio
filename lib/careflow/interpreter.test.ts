import { describe, expect, it } from "vitest";
import { interpret, simulate } from "./interpreter";
import { parse } from "./parser";
import { run } from "./index";
import { InterpreterError } from "./types";

const immediate = `
workflow demo {
  monitor oxygen
  rule low { when oxygen < 92 then { alert nurse priority high } }
}`;

const temporal = `
workflow demo {
  monitor oxygen
  rule low {
    when oxygen < 92 for 30 seconds
    then {
      alert nurse
      priority high
      require acknowledgment within 2 minutes
      otherwise escalate physician
    }
  }
}`;

describe("interpreter", () => {
  it("keeps the Phase 1 snapshot API working", () => {
    const result = interpret(parse(immediate), { oxygen: 87 });
    expect(result.rules[0]?.condition.result).toBe(true);
    expect(result.triggeredActions.map((action) => action.kind)).toEqual(["alert", "priority"]);
    expect(result.triggeredActions[0]).toMatchObject({
      firingInstanceId: "low#1", timeMs: 0, reason: "then",
    });
    expect(result.trace[0]?.kind).toBe("workflow_start");
    expect(result.trace.at(-1)?.kind).toBe("workflow_end");
  });

  it("accumulates time and fires at the exact duration boundary only once", () => {
    const result = simulate(parse(temporal), [
      { timeMs: 0, patient: { oxygen: 97 } },
      { timeMs: 10_000, patient: { oxygen: 91 } },
      { timeMs: 39_999, patient: { oxygen: 91 } },
      { timeMs: 40_000, patient: { oxygen: 91 } },
      { timeMs: 50_000, patient: { oxygen: 91 } },
    ]);
    expect(result.steps[2]?.rules[0]?.elapsedDurationMs).toBe(29_999);
    expect(result.steps[2]?.triggeredActions).toHaveLength(0);
    expect(result.steps[3]?.triggeredActions.map((action) => action.kind)).toEqual(["alert", "priority"]);
    expect(result.steps[4]?.triggeredActions).toHaveLength(0);
  });

  it("resets the timer after false and after a missing value", () => {
    const result = simulate(parse(temporal), [
      { timeMs: 0, patient: { oxygen: 91 } },
      { timeMs: 20_000, patient: { oxygen: 97 } },
      { timeMs: 30_000, patient: { oxygen: 91 } },
      { timeMs: 50_000, patient: {} },
      { timeMs: 60_000, patient: { oxygen: 91 } },
      { timeMs: 90_000, patient: { oxygen: 91 } },
    ]);
    expect(result.steps[2]?.rules[0]?.elapsedDurationMs).toBe(0);
    expect(result.steps[3]?.rules[0]?.condition.result).toBeNull();
    expect(result.steps[3]?.rules[0]?.condition.error).toMatch(/missing a finite value/);
    expect(result.triggeredActions.filter((action) => action.kind === "alert")).toHaveLength(1);
  });

  it("acknowledges before the deadline and at the exact boundary", () => {
    for (const acknowledgementTime of [100_000, 150_000]) {
      const result = simulate(parse(temporal), [
        { timeMs: 0, patient: { oxygen: 91 } },
        { timeMs: 30_000, patient: { oxygen: 91 } },
        { timeMs: acknowledgementTime, patient: { oxygen: 91 }, acknowledge: ["low#1"] },
      ]);
      expect(result.final.rules[0]?.acknowledgement.status).toBe("acknowledged");
      expect(result.triggeredActions.some((action) => action.reason === "acknowledgement_timeout")).toBe(false);
    }
  });

  it("escalates a missed acknowledgement exactly once", () => {
    const result = simulate(parse(temporal), [
      { timeMs: 0, patient: { oxygen: 91 } },
      { timeMs: 30_000, patient: { oxygen: 91 } },
      { timeMs: 149_999, patient: { oxygen: 91 } },
      { timeMs: 150_000, patient: { oxygen: 91 } },
      { timeMs: 200_000, patient: { oxygen: 91 } },
    ]);
    const escalations = result.triggeredActions.filter(
      (action) => action.reason === "acknowledgement_timeout",
    );
    expect(escalations).toHaveLength(1);
    expect(escalations[0]).toMatchObject({
      kind: "escalate", target: "physician", firingInstanceId: "low#1", timeMs: 150_000,
    });
    expect(result.final.rules[0]?.acknowledgement.status).toBe("escalated");
  });

  it("creates stable IDs for independent firing cycles", () => {
    const result = simulate(parse(immediate), [
      { timeMs: 0, patient: { oxygen: 91 } },
      { timeMs: 1_000, patient: { oxygen: 91 } },
      { timeMs: 2_000, patient: { oxygen: 97 } },
      { timeMs: 3_000, patient: { oxygen: 91 } },
    ]);
    expect(result.triggeredActions.filter((action) => action.kind === "alert").map(
      (action) => action.firingInstanceId,
    )).toEqual(["low#1", "low#2"]);
  });

  it("rejects duplicate or out-of-order timestamps", () => {
    expect(() => simulate(parse(immediate), [
      { timeMs: 10, patient: { oxygen: 91 } },
      { timeMs: 10, patient: { oxygen: 91 } },
    ])).toThrow(/strictly increasing/);
  });

  it("does not execute invalid programs through run()", () => {
    expect(() => run(`workflow bad { rule r { when x > 1 then { alert nurse } } }`, { x: 2 }))
      .toThrow(InterpreterError);
  });
});
