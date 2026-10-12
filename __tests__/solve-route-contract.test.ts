import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ mode: "ok" as "ok" | "quota-timeout" | "output" | "provider-timeout", quotaCalls: [] as unknown[][], solveCalls: [] as unknown[][] }));
vi.mock("@/lib/supabase-server", () => ({ createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: { id: "test-user" } } }) } })) }));
vi.mock("@/lib/solve-rate-limit", () => {
  class SolveLimitTimeoutError extends Error {}
  return { SolveLimitTimeoutError, acquireSolveSlot: vi.fn(async (...args: unknown[]) => { state.quotaCalls.push(args); if (state.mode === "quota-timeout") throw new SolveLimitTimeoutError(); return { allowed: true, release: async () => undefined }; }) };
});
vi.mock("@/lib/generate-solution", () => {
  class SolveUpstreamTimeoutError extends Error {}
  class SolveUpstreamOutputError extends Error {}
  return {
    SolveUpstreamTimeoutError, SolveUpstreamOutputError,
    isSolveUpstreamOutputError: (error: unknown) => error instanceof SolveUpstreamOutputError,
    generateSolution: vi.fn(async (...args: unknown[]) => { state.solveCalls.push(args); if (state.mode === "provider-timeout") throw new SolveUpstreamTimeoutError(); if (state.mode === "output") throw new SolveUpstreamOutputError(); return { needs_clarification: true, clarification_question: "Clarify the problem.", solution: null }; }),
  };
});
const route = await import("@/app/api/solve/route");
function request(form: FormData) { return new Request("http://local/api/solve", { method: "POST", body: form }); }
function imageRequest() { const f = new FormData(); f.set("file", new File([Uint8Array.of(137,80,78,71)], "q.png", { type: "image/png" })); return request(f); }
function textRequest() { const f = new FormData(); f.set("problem", "What is the speed after two seconds?"); return request(f); }
function pdfRequest() { const f = new FormData(); f.set("file", new File([Uint8Array.of(37,80,68,70)], "q.pdf", { type: "application/pdf" })); return request(f); }
function options() { return state.solveCalls.at(-1)?.[1] as { model: string; timeoutMs: number }; }
afterEach(() => { state.mode = "ok"; state.quotaCalls.length = 0; state.solveCalls.length = 0; delete process.env.OPENAI_SOLVE_IMAGE_MODEL; delete process.env.OPENAI_SOLVE_MODEL; });

describe("Solve route final model, deadline, and error contract", () => {
  it("uses gpt-4.1-mini with low detail for image input by default", async () => {
    expect((await route.POST(imageRequest())).status).toBe(200);
    const [content] = state.solveCalls[0] as [Array<Record<string, unknown>>];
    expect(content).toEqual([expect.objectContaining({ type: "input_image", detail: "low", image_url: "data:image/png;base64,iVBORw==" })]);
    expect(options()).toMatchObject({ model: "gpt-4.1-mini" });
    expect(options().timeoutMs).toBeGreaterThan(24_000); expect(options().timeoutMs).toBeLessThanOrEqual(24_500);
  });
  it("honors OPENAI_SOLVE_IMAGE_MODEL for image input", async () => {
    process.env.OPENAI_SOLVE_IMAGE_MODEL = "image-override-model";
    expect((await route.POST(imageRequest())).status).toBe(200); expect(options().model).toBe("image-override-model");
  });
  it.each([["text", textRequest], ["PDF", pdfRequest]])("uses gpt-4.1 for %s input by default", async (_kind, makeRequest) => { expect((await route.POST(makeRequest())).status).toBe(200); expect(options().model).toBe("gpt-4.1"); });
  it("honors OPENAI_SOLVE_MODEL for text input", async () => {
    process.env.OPENAI_SOLVE_MODEL = "text-override-model";
    expect((await route.POST(textRequest())).status).toBe(200); expect(options().model).toBe("text-override-model");
  });
  it.each([["quota", "quota-timeout", 503, "SOLVE_QUOTA_TIMEOUT"], ["provider", "provider-timeout", 504, "SOLVE_UPSTREAM_TIMEOUT"], ["output", "output", 502, "SOLVE_UPSTREAM_OUTPUT"]] as const)("maps %s failure to no-store structured status", async (_label, mode, status, code) => {
    state.mode = mode; const response = await route.POST(imageRequest()); expect(response.status).toBe(status); expect(response.headers.get("Cache-Control")).toBe("no-store"); await expect(response.json()).resolves.toMatchObject({ code });
  });
  it("caps quota acquisition at eight seconds to preserve model time", async () => { await route.POST(imageRequest()); const [, , quotaOptions] = state.quotaCalls[0] as [string, Date, { timeoutMs: number }]; expect(quotaOptions.timeoutMs).toBeGreaterThan(7_900); expect(quotaOptions.timeoutMs).toBeLessThanOrEqual(8_000); });
});
