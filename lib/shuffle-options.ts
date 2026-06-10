/**
 * Shuffles the options in each step of a problem's solution_flow
 * so the correct answer isn't always at index 0.
 * Uses Fisher-Yates shuffle.
 */
export function shuffleStepOptions<
  T extends { solution_flow: { steps: { options: { correct: boolean }[] }[] } }
>(problem: T): T {
  const flow = problem.solution_flow;
  const shuffledSteps = flow.steps.map((step) => {
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
