import { describe, expect, it } from "vitest";
import { isUnauthorizedSolveResponse } from "@/lib/solve-response";

describe("isUnauthorizedSolveResponse", () => {
  it.each([
    [401, undefined],
    [403, "Unauthorized"],
    [403, "SESSION_EXPIRED"],
  ])("recognizes expired sessions", (status, error) => {
    expect(isUnauthorizedSolveResponse(status, error)).toBe(true);
  });

  it("does not redirect for unrelated API errors", () => {
    expect(isUnauthorizedSolveResponse(429, "Try again later.")).toBe(false);
  });
});
