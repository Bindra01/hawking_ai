import { describe, expect, it } from "vitest";
import { hasRequiredFormatRatio, projectSolution, solutionWordCounts } from "@/lib/solution-format";
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
  derivation: { label: "Derive", blocks: [{ type: "equation", latex: "F=ma", annotation: "Same math" }] },
  final_answer: { latex: "v=20", display: "20 m/s", option: "Option A" },
  reality_checks: [item("R1", "high"), item("R2", "high"), item("R3 long detail ".repeat(12), "low"), item("R4 long detail ".repeat(12), "low")],
  common_errors: [item("E1", "high"), item("E2", "high"), item("E3 long detail ".repeat(12), "low"), item("E4 long detail ".repeat(12), "low")],
  takeaways: [item("T1", "high"), item("T2", "high"), item("T3", "high"), item("T4 long detail ".repeat(12), "low"), item("T5 long detail ".repeat(12), "low")],
};

describe("solution format projection", () => {
  it("makes Short a strict filtered subset while preserving high callouts", () => {
    const short = projectSolution(solution, "short");
    expect(short.framingLine).toBe("");
    expect(short.steps[0].explanation).toBe("");
    expect(short.steps[0].tip?.text).toBe("High tip");
    expect(short.steps[0].warning?.text).toBe("High warning");
    expect(short.steps[1].tip).toBeNull();
    expect(short.realityChecks).toHaveLength(2);
    expect(short.commonErrors).toHaveLength(2);
    expect(short.takeaways).toHaveLength(3);
  });

  it("keeps every teaching field in Long", () => {
    const long = projectSolution(solution, "long");
    expect(long.framingLine).toBe(solution.framing_line);
    expect(long.steps[0].explanation).toBe(solution.step1.explanation);
    expect(long.steps[1].tip?.text).toBe("Low tip");
    expect(long.realityChecks).toHaveLength(4);
    expect(long.commonErrors).toHaveLength(4);
    expect(long.takeaways).toHaveLength(5);
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
