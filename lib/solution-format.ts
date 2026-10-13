import type { DerivationBlock, SolveFormat, SolveSolution, SolveStep } from "@/lib/solve-types";

export interface ProjectedStep extends SolveStep {
  explanation: string;
}

export function projectSolution(solution: SolveSolution, format: SolveFormat) {
  const projectStep = (step: SolveStep): ProjectedStep => ({
    ...step,
    explanation: format === "long" ? step.explanation : "",
    tip: format === "long" ? step.tip : null,
    warning: format === "long" ? step.warning : null,
  });

  return {
    showTeaching: format === "long",
    setupLine: solution.framing_line,
    steps: [projectStep(solution.step1), projectStep(solution.step2), projectStep(solution.step3)] as const,
    derivationBlocks: format === "short"
      ? solution.derivation.blocks.filter(isShortDerivationBlock)
      : solution.derivation.blocks,
    realityChecks: format === "long" ? solution.reality_checks : [],
    commonErrors: format === "long" ? solution.common_errors : [],
    takeaways: format === "long" ? solution.takeaways : [],
  };
}

function isShortDerivationBlock(block: DerivationBlock): boolean {
  return block.type === "equation";
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

/** True when a field meant for plain text contains LaTeX commands such as `\frac` or `\theta`. */
export function isLatexSource(text: string): boolean {
  return /\\[A-Za-z]+/.test(text);
}

/** Removes `\displaystyle` switches and surrounding `$` delimiters so a stray LaTeX string renders cleanly. */
export function cleanLatexSource(text: string): string {
  return text.replace(/\\displaystyle\b/g, "").replace(/^\s*\$+|\$+\s*$/g, "").trim();
}

function projectedWordCount(solution: SolveSolution, format: SolveFormat): number {
  const projected = projectSolution(solution, format);
  const derivation = projected.derivationBlocks.flatMap((block) =>
    Object.values(block).filter((value): value is string => typeof value === "string")
  );
  const steps = projected.showTeaching ? projected.steps.flatMap((step) => [
    step.label, step.answer, step.explanation, step.tip?.text ?? "", step.warning?.text ?? "",
  ]) : [];
  const items = [...projected.realityChecks, ...projected.commonErrors, ...projected.takeaways]
    .flatMap((item) => [item.heading ?? "", item.title ?? "", item.text]);

  return wordCount([
    solution.title, ...solution.tags, solution.problem_statement, ...solution.problem_options,
    projected.setupLine, ...steps, ...(projected.showTeaching ? [solution.derivation.label] : []), ...derivation,
    solution.final_answer.latex, solution.final_answer.display, solution.final_answer.option ?? "", ...items,
  ].join(" "));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
