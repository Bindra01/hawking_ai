import { describe, expect, it } from "vitest";
import { parseSolveGenerationResult } from "@/lib/generate-solution";

describe("parseSolveGenerationResult", () => {
  const validSolution = {
    title: "Constant acceleration",
    tags: ["Mechanics"],
    problem_statement: "Find the speed.",
    problem_options: [],
    framing_line: "Use Newton's second law.",
    step1: { label: "Recall", answer: "F = ma", explanation: "Force causes acceleration.", tip: null, warning: null },
    step2: { label: "Inputs", answer: "m = 2 kg", explanation: "Use SI units.", tip: null, warning: null },
    step3: { label: "Plan", answer: "Find a, then v", explanation: "Apply constant acceleration.", tip: null, warning: null },
    derivation: { label: "Derivation", blocks: [{ type: "equation", latex: "a=F/m", annotation: "Acceleration" }] },
    final_answer: { latex: "v=20\\,m/s", display: "20 m/s", option: "" },
    reality_checks: [
      { heading: "Units", title: "Dimensions", text: "The units are speed.", priority: "high" },
      { heading: "Direction", title: "Sign", text: "The speed is positive.", priority: "high" },
      { heading: "Limit", title: "Time", text: "Zero time gives zero speed.", priority: "low" },
      { heading: "Scale", title: "Force", text: "More force gives more speed.", priority: "low" },
    ],
    common_errors: [
      { heading: "Force", title: "Mass", text: "Do not omit mass.", priority: "high" },
      { heading: "Initial", title: "Velocity", text: "Include initial speed.", priority: "high" },
      { heading: "Units", title: "Seconds", text: "Use seconds.", priority: "low" },
      { heading: "Vector", title: "Direction", text: "Track direction.", priority: "low" },
    ],
    takeaways: [
      { heading: "Method", title: "Sequence", text: "Find acceleration first.", priority: "high" },
      { heading: "Dynamics", title: "Newton", text: "Use F = ma.", priority: "high" },
      { heading: "Kinematics", title: "Speed", text: "Then use v = u + at.", priority: "high" },
      { heading: "Units", title: "SI", text: "Keep SI units.", priority: "low" },
      { heading: "Check", title: "Scale", text: "Check proportionality.", priority: "low" },
    ],
  };

  it("accepts a complete structured solution", () => {
    const result = parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: validSolution,
    }));
    expect(result.needs_clarification).toBe(false);
  });

  it("accepts a clarification response", () => {
    expect(parseSolveGenerationResult(JSON.stringify({
      needs_clarification: true,
      clarification_question: "What is the block mass?",
      solution: null,
    }))).toEqual({
      needs_clarification: true,
      clarification_question: "What is the block mass?",
      solution: null,
    });
  });

  it.each([
    "not json",
    JSON.stringify({}),
    JSON.stringify({ needs_clarification: true, clarification_question: "", solution: null }),
    JSON.stringify({ needs_clarification: false, clarification_question: "", solution: null }),
  ])("rejects invalid structured output", (output) => {
    expect(() => parseSolveGenerationResult(output)).toThrow();
  });

  it.each([
    { ...validSolution, derivation: { label: "Derivation", blocks: [null] } },
    { ...validSolution, derivation: { label: "Derivation", blocks: [{ type: "unknown" }] } },
    { ...validSolution, step1: { ...validSolution.step1, tip: { text: {}, priority: "high" } } },
    { ...validSolution, reality_checks: [{ heading: {}, text: "Check", priority: "high" }] },
    { ...validSolution, reality_checks: validSolution.reality_checks.map((item) => ({ ...item, priority: "high" })) },
  ])("rejects malformed nested solution data", (solution) => {
    expect(() => parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution,
    }))).toThrow();
  });
});
