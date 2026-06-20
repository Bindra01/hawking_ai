import { describe, it, expect } from "vitest";
import { calcStreak } from "@/lib/streak";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("calcStreak", () => {
  it("starts a streak at 1 on the first solve (no prior activity)", () => {
    expect(calcStreak(0, null, day("2026-06-20"))).toBe(1);
  });

  it("keeps the streak unchanged when already practiced today", () => {
    expect(calcStreak(5, day("2026-06-20"), day("2026-06-20"))).toBe(5);
  });

  it("increments when the last solve was exactly yesterday", () => {
    expect(calcStreak(5, day("2026-06-19"), day("2026-06-20"))).toBe(6);
  });

  it("resets to 1 after a gap of two or more days", () => {
    expect(calcStreak(5, day("2026-06-17"), day("2026-06-20"))).toBe(1);
  });

  it("treats a same-day solve at a later hour as already counted", () => {
    const lastActive = new Date("2026-06-20T08:00:00.000Z");
    const laterToday = new Date("2026-06-20T22:30:00.000Z");
    expect(calcStreak(3, lastActive, laterToday)).toBe(3);
  });

  it("leaves the streak unchanged if the last solve is in the future (clock skew)", () => {
    expect(calcStreak(3, day("2026-06-21"), day("2026-06-20"))).toBe(3);
  });

  it("increments across a day boundary regardless of time of day", () => {
    const lastActive = new Date("2026-06-19T23:30:00.000Z");
    const today = new Date("2026-06-20T00:10:00.000Z");
    expect(calcStreak(3, lastActive, today)).toBe(4);
  });
});
