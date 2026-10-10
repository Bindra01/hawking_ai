import { describe, expect, it } from "vitest";
import { acquireSolveSlot } from "@/lib/solve-rate-limit";

describe("acquireSolveSlot", () => {
  it("allows one in-flight solve and releases the slot", () => {
    const userId = `concurrent-${crypto.randomUUID()}`;
    const first = acquireSolveSlot(userId, Date.UTC(2026, 9, 10));
    expect(first.allowed).toBe(true);
    expect(acquireSolveSlot(userId, Date.UTC(2026, 9, 10) + 1).allowed).toBe(false);
    if (first.allowed) first.release();
    expect(acquireSolveSlot(userId, Date.UTC(2026, 9, 10) + 2).allowed).toBe(true);
  });

  it("limits repeated requests inside one minute", () => {
    const userId = `minute-${crypto.randomUUID()}`;
    const now = Date.UTC(2026, 9, 10);
    for (let index = 0; index < 4; index += 1) {
      const slot = acquireSolveSlot(userId, now + index);
      expect(slot.allowed).toBe(true);
      if (slot.allowed) slot.release();
    }
    expect(acquireSolveSlot(userId, now + 5).allowed).toBe(false);
  });
});
