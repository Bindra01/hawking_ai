import { describe, expect, it } from "vitest";
import { parseSolveGenerationResult } from "@/lib/generate-solution";

describe("parseSolveGenerationResult", () => {
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
});
