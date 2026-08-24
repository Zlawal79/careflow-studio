import { describe, expect, it } from "vitest";
import { durationToMs } from "./types";

describe("durations", () => {
  it("converts supported singular and plural units deterministically", () => {
    expect(durationToMs(30, "seconds")).toBe(30_000);
    expect(durationToMs(1, "minute")).toBe(60_000);
    expect(durationToMs(2, "hours")).toBe(7_200_000);
  });
});
