import { describe, expect, it } from "vitest";
import { parse, simulate } from "@/lib/careflow";
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
});
