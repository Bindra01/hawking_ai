import { highPriority, showCallout, type SolveFormat, type SolveSolution, type SolveStep } from "@/lib/solve-types";

export interface ProjectedStep extends SolveStep {
  explanation: string;
}

export function projectSolution(solution: SolveSolution, format: SolveFormat) {
  const projectStep = (step: SolveStep): ProjectedStep => ({
    ...step,
    explanation: format === "long" ? step.explanation : "",
    tip: showCallout(step.tip, format) ? step.tip : null,
    warning: showCallout(step.warning, format) ? step.warning : null,
  });

  return {
    framingLine: format === "long" ? solution.framing_line : "",
    steps: [projectStep(solution.step1), projectStep(solution.step2), projectStep(solution.step3)] as const,
    realityChecks: format === "short" ? highPriority(solution.reality_checks, 2) : solution.reality_checks,
    commonErrors: format === "short" ? highPriority(solution.common_errors, 2) : solution.common_errors,
    takeaways: format === "short" ? highPriority(solution.takeaways, 3) : solution.takeaways,
  };
}

export function solutionWordCounts(solution: SolveSolution) {
  return {
    short: projectedWordCount(solution, "short"),
    long: projectedWordCount(solution, "long"),
  };
}

export function hasRequiredFormatRatio(shortWords: number, longWords: number): boolean {
  return shortWords > 0 && longWords / shortWords >= 2.5;
}

function projectedWordCount(solution: SolveSolution, format: SolveFormat): number {
  const projected = projectSolution(solution, format);
  const derivation = solution.derivation.blocks.flatMap((block) =>
    Object.values(block).filter((value): value is string => typeof value === "string")
  );
  const steps = projected.steps.flatMap((step) => [
    step.label, step.answer, step.explanation, step.tip?.text ?? "", step.warning?.text ?? "",
  ]);
  const items = [...projected.realityChecks, ...projected.commonErrors, ...projected.takeaways]
    .flatMap((item) => [item.heading ?? "", item.title ?? "", item.text]);

  return wordCount([
    solution.title, ...solution.tags, solution.problem_statement, ...solution.problem_options,
    projected.framingLine, ...steps, solution.derivation.label, ...derivation,
    solution.final_answer.latex, solution.final_answer.display, solution.final_answer.option ?? "", ...items,
  ].join(" "));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
