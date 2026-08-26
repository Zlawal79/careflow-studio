import { describe, expect, it } from "vitest";
import { parse, simulate } from "@/lib/careflow";
import { deviceAlert } from "@/lib/careflow/examples";
import { deriveRuntimeMarkers } from "./runtime-visualization";

const source=`workflow demo {
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

describe("runtime visualization adapter",()=>{
  it("derives temporal and escalation markers only from simulation output",()=>{
    const result=simulate(parse(source),[
      {timeMs:0,patient:{oxygen:97}},
      {timeMs:10_000,patient:{oxygen:91}},
      {timeMs:40_000,patient:{oxygen:91}},
      {timeMs:160_000,patient:{oxygen:91}},
    ]);
    expect(deriveRuntimeMarkers(result.events).map((marker)=>marker.kind)).toEqual([
      "condition_true","timer_started","persistence_satisfied","rule_fired",
      "alert_created","ack_window","deadline_missed","escalated",
    ]);
  });

  it("shows acknowledgement instead of timeout escalation when runtime accepts it",()=>{
    const result=simulate(parse(source),[
      {timeMs:0,patient:{oxygen:91}},
      {timeMs:30_000,patient:{oxygen:91}},
      {timeMs:60_000,patient:{oxygen:91},acknowledge:["low#1"]},
    ]);
    const kinds=deriveRuntimeMarkers(result.events).map((marker)=>marker.kind);
    expect(kinds).toContain("acknowledged");
    expect(kinds).not.toContain("deadline_missed");
    expect(kinds).not.toContain("escalated");
  });

  it("renders the ventilator connectivity assignment, missed deadline, and escalation",()=>{
    const result=simulate(parse(deviceAlert.source),[
      {timeMs:0,patient:{connectivity_status:1}},
      {timeMs:10_000,patient:{connectivity_status:0}},
      {timeMs:129_999,patient:{connectivity_status:0}},
      {timeMs:130_000,patient:{connectivity_status:0}},
    ]);
    expect(result.triggeredActions).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:"alert",target:"er_operations",reason:"then"}),
      expect.objectContaining({kind:"escalate",target:"clinical_engineering",reason:"acknowledgement_timeout",timeMs:130_000}),
    ]));
    expect(result.final.rules[0]?.acknowledgement.status).toBe("escalated");
    expect(deriveRuntimeMarkers(result.events).map((marker)=>marker.kind)).toEqual(expect.arrayContaining(["alert_created","ack_window","deadline_missed","escalated"]));
  });
});
