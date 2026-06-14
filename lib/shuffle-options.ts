import { Step, getStepFormat } from "@/lib/types";

/**
 * Shuffles the options in each `mcq` step of a problem's solution_flow
 * so the correct answer isn't always at index 0.
 * Uses Fisher-Yates shuffle.
 *
 * Format-aware: only `mcq` steps carry an `options` array, so non-mcq steps
 * (claim / multiselect / build) are returned unchanged. Their ordering is
 * shuffled once at generation time and never re-shuffled at read time.
 */
export function shuffleStepOptions<
  T extends { solution_flow: { steps: Step[] } }
>(problem: T): T {
  const flow = problem.solution_flow;
  const shuffledSteps = flow.steps.map((step) => {
    // Only mcq steps have options to shuffle; leave every other shape intact.
    if (getStepFormat(step) !== "mcq" || !step.options) {
      return step;
    }
    const options = [...step.options];
    // Fisher-Yates shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { ...step, options };
  });
  return {
    ...problem,
    solution_flow: { ...flow, steps: shuffledSteps },
  };
}
