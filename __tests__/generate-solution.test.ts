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
    reality_checks: [{ heading: "Units", title: "Dimensions", text: "The units are speed.", priority: "high" }],
    common_errors: [{ heading: "Force", title: "Mass", text: "Do not omit mass.", priority: "high" }],
    takeaways: [{ heading: "Method", title: "Sequence", text: "Find acceleration first.", priority: "high" }],
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
  ])("rejects malformed nested solution data", (solution) => {
    expect(() => parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution,
    }))).toThrow();
  });
});
