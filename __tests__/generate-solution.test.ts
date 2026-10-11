import { afterEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { generateSolution, parseSolveGenerationResult } from "@/lib/generate-solution";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseSolveGenerationResult", () => {
  const longTeaching = "This teaching detail explains the physical meaning and connects each equation to the next step. ".repeat(20);
  const validSolution = {
    title: "Constant acceleration",
    tags: ["Mechanics"],
    problem_statement: "Find the speed.",
    problem_options: [],
    framing_line: "Use Newton's second law.",
    step1: { label: "Recall", answer: "F = ma", explanation: longTeaching, tip: null, warning: null },
    step2: { label: "Inputs", answer: "m = 2 kg", explanation: longTeaching, tip: null, warning: null },
    step3: { label: "Plan", answer: "Find a, then v", explanation: longTeaching, tip: null, warning: null },
    derivation: { label: "Derivation", blocks: [
      { type: "equation", latex: "a=F/m", annotation: "solve for the acceleration" },
      { type: "equation", latex: "v=20\\,m/s", annotation: "substitute values and calculate speed" },
    ] },
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

  it("can return a valid solution when only the format ratio misses the quality target", () => {
    const thinLongSolution = {
      ...validSolution,
      step1: { ...validSolution.step1, explanation: "Brief explanation." },
      step2: { ...validSolution.step2, explanation: "Brief explanation." },
      step3: { ...validSolution.step3, explanation: "Brief explanation." },
      derivation: {
        ...validSolution.derivation,
        blocks: [...Array.from({ length: 149 }, (_, index) => ({ type: "equation", latex: `x_${index}=1`, annotation: "shared derivation step" })), { type: "equation", latex: "v=20\\,m/s", annotation: "state the final calculated speed" }],
      },
    };
    const output = JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: thinLongSolution,
    });

    expect(() => parseSolveGenerationResult(output)).toThrow(/insufficient Long-format depth/);
    expect(parseSolveGenerationResult(output, { enforceFormatRatio: false })).toMatchObject({
      needs_clarification: false,
      solution: thinLongSolution,
    });
  });

  it("returns and logs a below-target solution through generateSolution", async () => {
    const thinLongSolution = {
      ...validSolution,
      step1: { ...validSolution.step1, explanation: "Brief explanation." },
      step2: { ...validSolution.step2, explanation: "Brief explanation." },
      step3: { ...validSolution.step3, explanation: "Brief explanation." },
      derivation: {
        ...validSolution.derivation,
        blocks: [...Array.from({ length: 149 }, (_, index) => ({ type: "equation", latex: `x_${index}=1`, annotation: "shared derivation step" })), { type: "equation", latex: "v=20\\,m/s", annotation: "state the final calculated speed" }],
      },
    };
    const output = JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: thinLongSolution,
    });
    vi.spyOn(OpenAI.Responses.prototype, "create").mockResolvedValue({
      output_text: output,
      status: "completed",
    } as never);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(generateSolution([{ type: "input_text", text: "Solve this." }])).resolves.toMatchObject({
      needs_clarification: false,
      solution: thinLongSolution,
    });
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(/insufficient Long-format depth/));
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
    { ...validSolution, derivation: { label: "Derivation", blocks: [{ type: "equation", latex: "x=1", annotation: "too short" }] } },
    { ...validSolution, derivation: { label: "Derivation", blocks: [
      { type: "equation", latex: "x=1", annotation: "this annotation contains far too many words for short format" },
      { type: "equation", latex: "y=2", annotation: "second valid equation note" },
    ] } },
    { ...validSolution, derivation: { ...validSolution.derivation, blocks: validSolution.derivation.blocks.map((block, index) => index === validSolution.derivation.blocks.length - 1 ? { ...block, latex: "v=999" } : block) } },
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
