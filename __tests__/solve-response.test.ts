import { describe, expect, it } from "vitest";
import { isUnauthorizedSolveResponse } from "@/lib/solve-response";

describe("isUnauthorizedSolveResponse", () => {
  it.each([
    [401, undefined],
    [403, { error: "Unauthorized" }],
    [403, { error: "Your session expired.", code: "SESSION_EXPIRED" }],
  ])("recognizes expired sessions", (status, payload) => {
    expect(isUnauthorizedSolveResponse(status, payload)).toBe(true);
  });

  it("does not redirect for unrelated API errors", () => {
    expect(isUnauthorizedSolveResponse(429, { error: "Try again later." })).toBe(false);
  });
});
