import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ mode: "normal" as "normal" | "stalled-auth" | "hung-release" }));
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: () => state.mode === "stalled-auth" ? new Promise(() => undefined) : Promise.resolve({ data: { user: { id: "test-user" } } }) } })),
}));
vi.mock("@/lib/solve-rate-limit", () => ({
  SolveLimitTimeoutError: class SolveLimitTimeoutError extends Error {},
  acquireSolveSlot: vi.fn(async () => ({ allowed: true, release: () => state.mode === "hung-release" ? new Promise<void>(() => undefined) : Promise.resolve() })),
}));
vi.mock("@/lib/generate-solution", () => ({
  SolveUpstreamTimeoutError: class SolveUpstreamTimeoutError extends Error {},
  isSolveUpstreamOutputError: () => false,
  generateSolution: vi.fn(async () => ({ needs_clarification: true, clarification_question: "Clarify the problem.", solution: null })),
}));
const route = await import("@/app/api/solve/route");
function textRequest() { const form = new FormData(); form.set("problem", "solve this"); return new Request("http://local/api/solve", { method: "POST", body: form }); }
afterEach(() => { state.mode = "normal"; vi.useRealTimers(); });

describe("route-wide deadline and lease cleanup", () => {
  it("bounds stalled authenticated-user preflight at 26 seconds and clears the deadline timer", async () => {
    vi.useFakeTimers(); state.mode = "stalled-auth";
    const pending = route.POST(textRequest());
    await vi.advanceTimersByTimeAsync(26_000);
    const response = await pending;
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({ code: "SOLVE_UPSTREAM_TIMEOUT" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds an acquired lease cleanup at one second and clears the cleanup timer", async () => {
    vi.useFakeTimers(); state.mode = "hung-release";
    const pending = route.POST(textRequest());
    await vi.advanceTimersByTimeAsync(1_000);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
  });
});
