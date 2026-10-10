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
  it("uses the public host and protocol supplied by a proxy", () => {
    const headers = new Headers({
      "x-forwarded-host": "preview.example.com",
      "x-forwarded-proto": "https",
    });

    expect(publicRequestOrigin("http://0.0.0.0:3000/auth/callback", headers)).toBe(
      "https://preview.example.com"
    );
  });

  it("uses the first value from a forwarded header chain", () => {
    const headers = new Headers({
      "x-forwarded-host": "preview.example.com, internal.example",
      "x-forwarded-proto": "https, http",
    });

    expect(publicRequestOrigin("http://0.0.0.0:3000/auth/callback", headers)).toBe(
      "https://preview.example.com"
    );
  });

  it("falls back to the request origin for malformed proxy values", () => {
    const headers = new Headers({
      "x-forwarded-host": "preview.example.com/path",
      "x-forwarded-proto": "https",
    });

    expect(publicRequestOrigin("http://0.0.0.0:3000/auth/callback", headers)).toBe(
      "http://0.0.0.0:3000"
    );
  });
});
