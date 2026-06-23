import { describe, it, expect } from "vitest";
import { formatForType, getStepFormat, type Step, type StepType } from "@/lib/types";

describe("formatForType", () => {
  const cases: Array<[StepType, string]> = [
    ["trap", "claim"],
    ["identify", "multiselect"],
    ["setup", "build"],
    ["principle", "mcq"],
    ["connect", "mcq"],
    ["why", "mcq"],
    ["solve", "mcq"],
    ["sanity", "mcq"],
  ];

  it.each(cases)("maps %s -> %s", (type, expected) => {
    expect(formatForType(type)).toBe(expected);
  });
});

describe("getStepFormat", () => {
  const base = { label: "", icon: "", prompt: "", tip: "" };

  it("resolves legacy mcq step (options, no format) to mcq even for a trap type", () => {
    const step: Step = {
      ...base,
      type: "trap",
      options: [{ text: "a", correct: true, feedback: "f" }],
    };
    expect(getStepFormat(step)).toBe("mcq");
  });

  it("resolves a claim step by its claim object", () => {
    const step: Step = {
      ...base,
      type: "trap",
      claim: { statement: "s", isTrap: true, feedbackTrap: "t", feedbackSound: "s" },
    };
    expect(getStepFormat(step)).toBe("claim");
  });

  it("resolves a multiselect step by its multiselect object", () => {
    const step: Step = {
      ...base,
      type: "identify",
      multiselect: { items: [], feedbackCorrect: "c", feedbackWrong: "w" },
    };
    expect(getStepFormat(step)).toBe("multiselect");
  });

  it("resolves a build step by its build object", () => {
    const step: Step = {
      ...base,
      type: "setup",
      build: { tiles: [], accepted: [], distractors: [], feedbackCorrect: "c", feedbackWrong: "w" },
    };
    expect(getStepFormat(step)).toBe("build");
  });

  it("explicit format wins over shape", () => {
    const step: Step = {
      ...base,
      type: "setup",
      format: "mcq",
      options: [{ text: "a", correct: true, feedback: "f" }],
    };
    expect(getStepFormat(step)).toBe("mcq");
  });

  it("falls back to formatForType when no shape data present", () => {
    const step: Step = { ...base, type: "setup" };
    expect(getStepFormat(step)).toBe("build");
  });
});
