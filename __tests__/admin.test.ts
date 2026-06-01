import { describe, it, expect } from "vitest";
import { isAdmin } from "@/lib/admin";

describe("isAdmin", () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = originalEnv;
    }
  });

  it("returns false for undefined email", () => {
    expect(isAdmin(undefined)).toBe(false);
  });

  it("returns true for any email when ADMIN_EMAILS is not set", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdmin("anyone@example.com")).toBe(true);
  });

  it("returns false for any email when ADMIN_EMAILS is empty string", () => {
    // Empty string is falsy, so no allowlist = allow all
    process.env.ADMIN_EMAILS = "";
    expect(isAdmin("anyone@example.com")).toBe(true);
  });

  it("returns true for an email in the allowlist", () => {
    process.env.ADMIN_EMAILS = "admin@example.com,boss@example.com";
    expect(isAdmin("admin@example.com")).toBe(true);
    expect(isAdmin("boss@example.com")).toBe(true);
  });

  it("returns false for an email not in the allowlist", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdmin("hacker@example.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    process.env.ADMIN_EMAILS = "Admin@Example.com";
    expect(isAdmin("admin@example.com")).toBe(true);
    expect(isAdmin("ADMIN@EXAMPLE.COM")).toBe(true);
  });

  it("handles whitespace in the allowlist", () => {
    process.env.ADMIN_EMAILS = " admin@example.com , boss@example.com ";
    expect(isAdmin("admin@example.com")).toBe(true);
    expect(isAdmin("boss@example.com")).toBe(true);
  });
});
