import { describe, expect, it } from "vitest";
import { parse } from "./parser";
import { validate } from "./validator";

function codes(source: string) {
  return validate(parse(source)).diagnostics.map((diagnostic) => diagnostic.code);
}

describe("validator", () => {
  it("flags variables used without a monitor declaration", () => {
    const source = `
      workflow demo {
        rule low {
          when oxygen < 92
          then { alert nurse }
        }
      }
    `;
    expect(codes(source)).toContain("undeclared_variable");
    expect(validate(parse(source)).ok).toBe(false);
  });

  it("warns about monitors that are never used", () => {
    const source = `
      workflow demo {
        monitor oxygen
        monitor heart_rate
        rule low {
          when oxygen < 92
          then { alert nurse }
        }
      }
    `;
    expect(codes(source)).toContain("unused_monitor");
  });

  it("flags duplicate rule names and duplicate monitors", () => {
    const source = `
      workflow demo {
        monitor oxygen
        monitor oxygen
        rule low {
          when oxygen < 92
          then { alert nurse }
        }
        rule low {
          when oxygen < 90
          then { alert physician }
        }
      }
    `;
    const found = codes(source);
    expect(found).toContain("duplicate_monitor");
    expect(found).toContain("duplicate_rule");
  });

  it("flags rules with no actions", () => {
    const source = `
      workflow demo {
        monitor oxygen
        rule empty {
          when oxygen < 92
          then { }
        }
      }
    `;
    expect(codes(source)).toContain("empty_rule");
  });

  it("rejects invalid priority levels", () => {
    const source = `
      workflow demo {
        monitor oxygen
        rule low {
          when oxygen < 92
          then {
            alert nurse
            priority urgent
          }
        }
      }
    `;
    expect(codes(source)).toContain("invalid_priority");
  });

  it("warns on identical conditions", () => {
    const source = `
      workflow demo {
        monitor oxygen
        rule a {
          when oxygen < 92
          then { alert nurse }
        }
        rule b {
          when oxygen < 92
          then { alert physician }
        }
      }
    `;
    expect(codes(source)).toContain("duplicate_condition");
  });

  it("warns when a stricter threshold subsumes a looser one", () => {
    const source = `
      workflow demo {
        monitor oxygen
        rule severe {
          when oxygen < 88
          then { alert physician }
        }
        rule mild {
          when oxygen < 92
          then { alert nurse }
        }
      }
    `;
    expect(codes(source)).toContain("subsumed_condition");
  });

  it("warns when conditions cannot both be true", () => {
    const source = `
      workflow demo {
        monitor oxygen
        rule low {
          when oxygen < 80
          then { alert nurse }
        }
        rule high {
          when oxygen > 100
          then { alert physician }
        }
      }
    `;
    expect(codes(source)).toContain("mutually_exclusive_conditions");
  });

  it("accepts a well-formed program with only unused-monitor style warnings at most", () => {
    const source = `
      workflow demo {
        monitor oxygen
        rule low {
          when oxygen < 92
          then {
            alert nurse
            priority high
          }
        }
      }
    `;
    const result = validate(parse(source));
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("rejects zero and negative temporal or acknowledgement durations", () => {
    const source = `workflow demo {
      monitor oxygen
      rule low {
        when oxygen < 92 for 0 seconds
        then {
          alert nurse
          require acknowledgment within 0 minutes
          otherwise escalate physician
        }
      }
    }`;
    expect(codes(source).filter((code) => code === "invalid_duration")).toHaveLength(2);
    expect(codes(`workflow demo {
      monitor oxygen
      rule low { when oxygen < 92 for -1 minutes then { alert nurse } }
    }`)).toContain("invalid_duration");
  });

  it("requires an alert and escalation target for acknowledgement", () => {
    const source = `workflow demo {
      monitor oxygen
      rule low {
        when oxygen < 92
        then { priority high require acknowledgment within 2 minutes }
      }
    }`;
    const found = codes(source);
    expect(found).toContain("ack_without_alert");
    expect(found).toContain("ack_missing_escalation");
  });

  it("uses exact interval reasoning at large thresholds", () => {
    const source = `workflow demo {
      monitor x
      rule low { when x < 10000000000001 then { alert a } }
      rule high { when x > 10000000000002 then { alert b } }
    }`;
    expect(codes(source)).toContain("mutually_exclusive_conditions");
  });
});
