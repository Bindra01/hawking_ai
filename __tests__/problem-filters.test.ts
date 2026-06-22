import { describe, it, expect } from "vitest";
import { buildProblemListWhere, buildCardMeta } from "@/lib/problem-filters";

describe("buildProblemListWhere", () => {
  it("returns only published when no filters are given", () => {
    expect(buildProblemListWhere(null, null)).toEqual({ status: "published" });
    expect(buildProblemListWhere("", "")).toEqual({ status: "published" });
    expect(buildProblemListWhere(undefined, undefined)).toEqual({ status: "published" });
  });

  it("adds subject only", () => {
    expect(buildProblemListWhere("mechanics", null)).toEqual({
      status: "published",
      subject: "mechanics",
    });
  });

  it("adds difficulty (class) only", () => {
    expect(buildProblemListWhere(null, "class_11")).toEqual({
      status: "published",
      difficulty: "class_11",
    });
  });

  it("combines subject and difficulty as an AND filter", () => {
    expect(buildProblemListWhere("mechanics", "class_12")).toEqual({
      status: "published",
      subject: "mechanics",
      difficulty: "class_12",
    });
  });
});

describe("buildCardMeta", () => {
  it("shows subject and step count, hiding topic when it equals the subject", () => {
    expect(buildCardMeta("Mechanics", "Mechanics", 5)).toBe("Mechanics · 5 steps");
  });

  it("is case-insensitive when comparing topic to subject", () => {
    expect(buildCardMeta("Mechanics", "mechanics", 3)).toBe("Mechanics · 3 steps");
  });

  it("shows the topic when it differs from the subject", () => {
    expect(buildCardMeta("Quantum Mechanics", "Photoelectric Effect", 5)).toBe(
      "Quantum Mechanics · Photoelectric Effect · 5 steps"
    );
  });

  it("omits topic when null or empty", () => {
    expect(buildCardMeta("Mechanics", null, 4)).toBe("Mechanics · 4 steps");
    expect(buildCardMeta("Mechanics", "", 4)).toBe("Mechanics · 4 steps");
  });
});
