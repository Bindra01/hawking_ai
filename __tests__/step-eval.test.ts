import { describe, it, expect } from "vitest";
import {
  evaluateStep,
  isAnswerReady,
  describeAnswer,
  describeCorrectAnswer,
  type Answer,
} from "@/lib/step-eval";
import type { Step } from "@/lib/types";

const mcqStep: Step = {
  type: "principle",
  format: "mcq",
  label: "Principle",
  icon: "P",
  prompt: "Which law applies?",
  options: [
    { text: "Right", correct: true, feedback: "Yes, correct." },
    { text: "Wrong A", correct: false, feedback: "Nope A." },
    { text: "Wrong B", correct: false, feedback: "Nope B." },
    { text: "Wrong C", correct: false, feedback: "Nope C." },
  ],
  tip: "tip",
};

const claimStep: Step = {
  type: "trap",
  format: "claim",
  label: "Trap",
  icon: "T",
  prompt: "Is this a trap?",
  claim: {
    statement: "Acceleration equals velocity here.",
    isTrap: true,
    feedbackTrap: "Correct — this is indeed a trap.",
    feedbackSound: "Wrong — it actually was a trap.",
  },
  tip: "tip",
};

const multiStep: Step = {
  type: "identify",
  format: "multiselect",
  label: "Identify",
  icon: "I",
  prompt: "Which quantities matter?",
  multiselect: {
    items: [
      { text: "Mass", matters: true },
      { text: "Color", matters: false },
      { text: "Velocity", matters: true },
      { text: "Smell", matters: false },
    ],
    feedbackCorrect: "Great — those are the relevant quantities.",
    feedbackWrong: "Not quite — reconsider what actually matters here.",
  },
  tip: "tip",
};

const buildStep: Step = {
  type: "setup",
  format: "build",
  label: "Setup",
  icon: "S",
  prompt: "Build the equation",
  build: {
    tiles: ["F", "=", "m", "a", "v"],
    accepted: [
      ["F", "=", "m", "a"],
      ["F", "=", "a", "m"],
    ],
    distractors: [{ tile: "v", feedback: "v is velocity, not part of F = ma." }],
    feedbackCorrect: "Nailed it — that is Newton's second law.",
    feedbackWrong: "Not the right arrangement, try again.",
  },
  tip: "tip",
};

// A predict-the-dependence terminal form step. Ground truth: r = m v / (q B).
const predictStep: Step = {
  type: "form",
  format: "build",
  label: "Assemble the form",
  icon: "F",
  prompt: "Predict how the radius depends on each quantity.",
  predict: {
    target: "r",
    correctFormula: "$r = \\frac{mv}{qB}$",
    variables: [
      { symbol: "m", label: "the mass", factor: "m", role: "numerator" },
      { symbol: "v", label: "the speed", factor: "v", role: "numerator" },
      { symbol: "q", label: "the charge", factor: "q", role: "denominator" },
      { symbol: "B", label: "the field", factor: "B", role: "denominator" },
    ],
  },
  tip: "tip",
};

describe("evaluateStep — mcq", () => {
  it("correct option", () => {
    const r = evaluateStep(mcqStep, { kind: "mcq", index: 0 });
    expect(r.correct).toBe(true);
    expect(r.feedback).toBe("Yes, correct.");
  });
  it("wrong option", () => {
    const r = evaluateStep(mcqStep, { kind: "mcq", index: 1 });
    expect(r.correct).toBe(false);
    expect(r.feedback).toBe("Nope A.");
  });
});

describe("evaluateStep — claim", () => {
  it("saidTrap matching isTrap is correct", () => {
    const r = evaluateStep(claimStep, { kind: "claim", saidTrap: true });
    expect(r.correct).toBe(true);
    expect(r.feedback).toBe("Correct — this is indeed a trap.");
  });
  it("not matching isTrap is wrong", () => {
    const r = evaluateStep(claimStep, { kind: "claim", saidTrap: false });
    expect(r.correct).toBe(false);
    expect(r.feedback).toBe("Wrong — it actually was a trap.");
  });
});

describe("evaluateStep — multiselect", () => {
  it("exact correct set", () => {
    const r = evaluateStep(multiStep, { kind: "multiselect", indices: [0, 2] });
    expect(r.correct).toBe(true);
    expect(r.feedback).toBe("Great — those are the relevant quantities.");
  });
  it("partial selection (missing one) is wrong", () => {
    const r = evaluateStep(multiStep, { kind: "multiselect", indices: [0] });
    expect(r.correct).toBe(false);
    expect(r.feedback).toBe("Not quite — reconsider what actually matters here.");
  });
  it("extra selection (one too many) is wrong", () => {
    const r = evaluateStep(multiStep, { kind: "multiselect", indices: [0, 2, 1] });
    expect(r.correct).toBe(false);
    expect(r.feedback).toBe("Not quite — reconsider what actually matters here.");
  });
});

describe("evaluateStep — build", () => {
  it("matches first accepted arrangement", () => {
    const r = evaluateStep(buildStep, { kind: "build", order: [0, 1, 2, 3] });
    expect(r.correct).toBe(true);
    expect(r.feedback).toBe("Nailed it — that is Newton's second law.");
  });
  it("matches second accepted arrangement", () => {
    const r = evaluateStep(buildStep, { kind: "build", order: [0, 1, 3, 2] });
    expect(r.correct).toBe(true);
    expect(r.feedback).toBe("Nailed it — that is Newton's second law.");
  });
  it("wrong order with distractor tile returns distractor feedback", () => {
    // tiles: F = m v  -> includes distractor "v" (index 4)
    const r = evaluateStep(buildStep, { kind: "build", order: [0, 1, 2, 4] });
    expect(r.correct).toBe(false);
    expect(r.feedback).toBe("v is velocity, not part of F = ma.");
  });
  it("wrong order without distractor tile returns feedbackWrong", () => {
    // F = a m -> wait that's accepted; use F m a = (no v)
    const r = evaluateStep(buildStep, { kind: "build", order: [0, 2, 3, 1] });
    expect(r.correct).toBe(false);
    expect(r.feedback).toBe("Not the right arrangement, try again.");
  });
});

describe("evaluateStep — predict", () => {
  it("all roles matching ground truth is correct", () => {
    const r = evaluateStep(predictStep, {
      kind: "predict",
      choices: { m: "up", v: "up", q: "down", B: "down" },
    });
    expect(r.correct).toBe(true);
  });
  it("one variable on the wrong side is incorrect", () => {
    const r = evaluateStep(predictStep, {
      kind: "predict",
      choices: { m: "up", v: "up", q: "up", B: "down" },
    });
    expect(r.correct).toBe(false);
  });
  it("a 'none' choice never matches a numerator/denominator role (incorrect)", () => {
    const r = evaluateStep(predictStep, {
      kind: "predict",
      choices: { m: "none", v: "up", q: "down", B: "down" },
    });
    expect(r.correct).toBe(false);
  });
});

describe("describeAnswer / describeCorrectAnswer — predict", () => {
  it("describeAnswer assembles the student's picked formula", () => {
    const s = describeAnswer(predictStep, {
      kind: "predict",
      choices: { m: "up", v: "up", q: "down", B: "down" },
    });
    expect(s).toBe("$r = \\frac{m v}{q B}$");
  });
  it("describeAnswer with an area-backwards style pick lands the factor on the wrong side", () => {
    const s = describeAnswer(predictStep, {
      kind: "predict",
      choices: { m: "up", v: "up", q: "down", B: "up" },
    });
    expect(s).toBe("$r = \\frac{m v B}{q}$");
  });
  it("describeCorrectAnswer returns the correctFormula", () => {
    expect(describeCorrectAnswer(predictStep)).toBe("$r = \\frac{mv}{qB}$");
  });
});

describe("isAnswerReady", () => {
  it("mcq ready when index >= 0", () => {
    expect(isAnswerReady(mcqStep, { kind: "mcq", index: 0 })).toBe(true);
  });
  it("mcq not ready when index < 0", () => {
    expect(isAnswerReady(mcqStep, { kind: "mcq", index: -1 })).toBe(false);
  });
  it("claim ready when choice made", () => {
    expect(isAnswerReady(claimStep, { kind: "claim", saidTrap: false })).toBe(true);
  });
  it("multiselect ready with >= 1 index", () => {
    expect(isAnswerReady(multiStep, { kind: "multiselect", indices: [1] })).toBe(true);
  });
  it("multiselect not ready with 0 indices", () => {
    expect(isAnswerReady(multiStep, { kind: "multiselect", indices: [] })).toBe(false);
  });
  it("build ready when order length matches an accepted arrangement", () => {
    expect(isAnswerReady(buildStep, { kind: "build", order: [0, 1, 2, 3] })).toBe(
      true
    );
  });
  it("build ready with a single placed tile (any-length arrangement allowed)", () => {
    expect(isAnswerReady(buildStep, { kind: "build", order: [0] })).toBe(true);
  });
  it("build ready with a partial arrangement shorter than accepted", () => {
    expect(isAnswerReady(buildStep, { kind: "build", order: [0, 1] })).toBe(true);
  });
  it("build not ready with empty order", () => {
    expect(isAnswerReady(buildStep, { kind: "build", order: [] })).toBe(false);
  });
  it("build not ready with duplicate tile indices", () => {
    expect(
      isAnswerReady(buildStep, { kind: "build", order: [0, 1, 2, 2] })
    ).toBe(false);
  });
  it("build not ready with out-of-range tile index", () => {
    expect(
      isAnswerReady(buildStep, { kind: "build", order: [0, 1, 2, 99] })
    ).toBe(false);
  });
  it("null answer not ready", () => {
    expect(isAnswerReady(mcqStep, null)).toBe(false);
  });
  it("predict ready when every variable has a choice", () => {
    expect(
      isAnswerReady(predictStep, {
        kind: "predict",
        choices: { m: "up", v: "none", q: "down", B: "down" },
      })
    ).toBe(true);
  });
  it("predict not ready when a variable choice is missing", () => {
    expect(
      isAnswerReady(predictStep, {
        kind: "predict",
        choices: { m: "up", v: "up", q: "down" },
      })
    ).toBe(false);
  });
});
