import { describe, it, expect } from "vitest";
import { formatForType, getStepFormat, type Step, type StepType } from "@/lib/types";
import { stepIcon } from "@/lib/step-icons";
import { STEP_COLORS, STEP_BG } from "@/components/StepQuestion";

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
    ["approach", "mcq"],
    ["depends", "multiselect"],
    ["scale", "mcq"],
    ["limit", "claim"],
    ["form", "build"],
  ];

  it.each(cases)("maps %s -> %s", (type, expected) => {
    expect(formatForType(type)).toBe(expected);
  });
});

// Map-lookup safety net: tsc cannot guarantee every map carries the `approach`
// key (the maps are typed Record<string, string> with default fallbacks), so
// these assertions are the executable guarantee that the new/re-themed step
// types resolve to their intended format, icon, and design tokens.
describe("step-type maps carry approach + re-themed solve", () => {
  it("stepIcon resolves approach and re-themed solve", () => {
    expect(stepIcon("approach")).toBe("🧭");
    expect(stepIcon("solve")).toBe("🔮");
  });

  it("STEP_COLORS carries approach + re-themed solve tokens", () => {
    expect(STEP_COLORS.approach).toBe("#5b8cff");
    expect(STEP_COLORS.solve).toBe("#6fb3b8");
  });

  it("STEP_BG carries approach + re-themed solve tokens", () => {
    expect(STEP_BG.approach).toBe("#11163a");
    expect(STEP_BG.solve).toBe("#0e2326");
  });
});

describe("new reasoning-chain step types (depends/scale/limit/form)", () => {
  it("stepIcon resolves the four new types", () => {
    expect(stepIcon("depends")).toBe("🎛️");
    expect(stepIcon("scale")).toBe("📈");
    expect(stepIcon("limit")).toBe("🔭");
    expect(stepIcon("form")).toBe("🏗️");
  });

  it("STEP_COLORS carries the four new accent tokens", () => {
    expect(STEP_COLORS.depends).toBe("#38bdf8");
    expect(STEP_COLORS.scale).toBe("#34d399");
    expect(STEP_COLORS.limit).toBe("#fbbf24");
    expect(STEP_COLORS.form).toBe("#5eead4");
  });

  it("STEP_BG carries the four new badge-background tokens", () => {
    expect(STEP_BG.depends).toBe("#0b2438");
    expect(STEP_BG.scale).toBe("#08291f");
    expect(STEP_BG.limit).toBe("#2a2008");
    expect(STEP_BG.form).toBe("#06251f");
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
