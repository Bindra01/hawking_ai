import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const state = vi.hoisted(() => ({ calls: [] as unknown[][], behavior: "resolve" as "resolve" | "P2024" | "P2028" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (_callback: unknown, options: unknown) => {
      state.calls.push([options]);
      if (state.behavior === "P2024" || state.behavior === "P2028") {
        throw new Prisma.PrismaClientKnownRequestError("transaction timeout", { code: state.behavior, clientVersion: Prisma.prismaVersion.client });
      }
      return { allowed: false, message: "limited", retryAfterSeconds: 1 };
    }),
  },
}));
const { acquireSolveSlot, SolveLimitTimeoutError } = await import("@/lib/solve-rate-limit");

describe("final composed Prisma quota budgets", () => {
  it("reserves bounded maxWait and rollback headroom from a normal transaction budget", async () => {
    await expect(acquireSolveSlot("user-a", new Date("2026-10-12T10:00:00Z"), { timeoutMs: 5_000 })).resolves.toMatchObject({ allowed: false, status: 429 });
    expect(state.calls.at(-1)?.[0]).toMatchObject({ isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 1_000, timeout: 3_750 });
  });
  it("scales maxWait and timeout for a short remaining request budget", async () => {
    await acquireSolveSlot("user-b", new Date("2026-10-12T10:00:00Z"), { timeoutMs: 500 });
    expect(state.calls.at(-1)?.[0]).toMatchObject({ maxWait: 100, timeout: 150 });
  });
  it.each(["P2024", "P2028"] as const)("translates Prisma %s into SolveLimitTimeoutError", async (code) => {
    state.behavior = code;
    await expect(acquireSolveSlot("user-c", new Date(), { timeoutMs: 5_000 })).rejects.toBeInstanceOf(SolveLimitTimeoutError);
    state.behavior = "resolve";
  });
});
