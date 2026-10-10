import { describe, expect, it } from "vitest";
import { publicRequestOrigin, safeNextPath } from "@/lib/auth-redirect";

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

describe("publicRequestOrigin", () => {
  it("uses the configured public origin behind a proxy", () => {
    expect(
      publicRequestOrigin(
        "http://0.0.0.0:3000/auth/callback",
        "https://preview.example.com"
      )
    ).toBe("https://preview.example.com");
  });

  it("uses the request origin when no public origin is configured", () => {
    expect(publicRequestOrigin("https://hawking.example/auth/callback")).toBe(
      "https://hawking.example"
    );
  });

  it.each([
    "https://preview.example.com/path",
    "https://user:password@preview.example.com",
    "https://preview.example.com?next=evil",
    "javascript:alert(1)",
    "not a URL",
  ])("falls back to the request origin for an invalid configured origin: %s", (value) => {
    expect(publicRequestOrigin("https://hawking.example/auth/callback", value)).toBe(
      "https://hawking.example"
    );
  });
});
