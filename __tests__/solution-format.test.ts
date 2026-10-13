import { describe, expect, it } from "vitest";
import { cleanLatexSource, hasRequiredFormatRatio, isLatexSource, projectSolution, solutionWordCounts } from "@/lib/solution-format";
import type { SolveSolution } from "@/lib/solve-types";

const item = (text: string, priority: "high" | "low") => ({ heading: text, title: text, text, priority });
const solution: SolveSolution = {
  title: "Test",
  tags: ["Physics"],
  problem_statement: "Problem",
  problem_options: [],
  framing_line: "Long framing line",
  step1: { label: "One", answer: "Answer", explanation: "Long explanation ".repeat(20), tip: { text: "High tip", priority: "high" }, warning: { text: "High warning", priority: "high" } },
  step2: { label: "Two", answer: "Answer", explanation: "Long explanation ".repeat(20), tip: { text: "Low tip", priority: "low" }, warning: null },
  step3: { label: "Three", answer: "Answer", explanation: "Long explanation ".repeat(20), tip: null, warning: null },
  derivation: { label: "Derive", blocks: [{ type: "subsection", title: "Long heading" }, { type: "prose", text: "Long derivation explanation" }, { type: "equation", latex: "F=ma", annotation: "apply Newton's second law" }, { type: "equation", latex: "v=20", annotation: "solve for final speed" }] },
  final_answer: { latex: "v=20", display: "20 m/s", option: "Option A" },
  reality_checks: [item("R1", "high"), item("R2", "high"), item("R3 long detail ".repeat(12), "low"), item("R4 long detail ".repeat(12), "low")],
  common_errors: [item("E1", "high"), item("E2", "high"), item("E3 long detail ".repeat(12), "low"), item("E4 long detail ".repeat(12), "low")],
  takeaways: [item("T1", "high"), item("T2", "high"), item("T3", "high"), item("T4 long detail ".repeat(12), "low"), item("T5 long detail ".repeat(12), "low")],
};

describe("solution format projection", () => {
  it("detects LaTeX commands in text meant for plain display", () => {
    expect(isLatexSource("\\displaystyle \\tan \\theta = \\frac{d}{2}")).toBe(true);
    expect(isLatexSource("tan θ equals d over 2")).toBe(false);
    expect(isLatexSource("20 m/s")).toBe(false);
  });

  it("cleans display switches and dollar delimiters from stray LaTeX", () => {
    expect(cleanLatexSource("$$\\displaystyle \\tan \\theta = \\frac{d}{2}$$")).toBe("\\tan \\theta = \\frac{d}{2}");
    expect(cleanLatexSource("  v=20  ")).toBe("v=20");
  });

  it("makes Short a bare worked derivation", () => {
    const short = projectSolution(solution, "short");
    expect(short.showTeaching).toBe(false);
    expect(short.setupLine).toBe(solution.framing_line);
    expect(short.derivationBlocks).toEqual([
      { type: "equation", latex: "F=ma", annotation: "apply Newton's second law" },
      { type: "equation", latex: "v=20", annotation: "solve for final speed" },
    ]);
    expect(short.realityChecks).toEqual([]);
    expect(short.commonErrors).toEqual([]);
    expect(short.takeaways).toEqual([]);
    expect(short.steps.every((step) => step.tip === null && step.warning === null && step.explanation === "")).toBe(true);
  });

  it("keeps every teaching field in Long", () => {
    const long = projectSolution(solution, "long");
    expect(long.showTeaching).toBe(true);
    expect(long.setupLine).toBe(solution.framing_line);
    expect(long.steps[0].explanation).toBe(solution.step1.explanation);
    expect(long.steps[1].tip?.text).toBe("Low tip");
    expect(long.realityChecks).toHaveLength(4);
    expect(long.commonErrors).toHaveLength(4);
    expect(long.takeaways).toHaveLength(5);
    expect(long.derivationBlocks).toEqual(solution.derivation.blocks);
  });

  it("calculates the rendered format ratio", () => {
    const counts = solutionWordCounts(solution);
    expect(counts.long).toBeGreaterThan(counts.short);
  });

  it("enforces the exact 2.5 ratio boundary", () => {
    expect(hasRequiredFormatRatio(100, 249)).toBe(false);
    expect(hasRequiredFormatRatio(100, 250)).toBe(true);
  });
});
