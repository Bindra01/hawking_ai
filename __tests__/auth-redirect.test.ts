import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth-redirect";

const origin = "https://hawking.example";

describe("safeNextPath", () => {
  it("keeps same-origin paths and query strings", () => {
    expect(safeNextPath("/solve?format=long", origin)).toBe("/solve?format=long");
  });

  it.each([
    null,
    "https://evil.example/steal",
    "//evil.example/steal",
    "javascript:alert(1)",
    "http://[",
  ])("falls back to home for an unsafe next value: %s", (next) => {
    expect(safeNextPath(next, origin)).toBe("/home");
  });
});
