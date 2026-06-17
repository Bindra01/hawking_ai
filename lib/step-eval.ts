import { getStepFormat, type Step } from "@/lib/types";

/**
 * A student's answer for a single step. One variant per format. The UI builds
 * the appropriate variant and hands it to {@link isAnswerReady}/{@link evaluateStep};
 * scoring stays one boolean per step.
 */
export type Answer =
  | { kind: "mcq"; index: number }
  | { kind: "claim"; saidTrap: boolean }
  | { kind: "multiselect"; indices: number[] }
  | { kind: "build"; order: number[] };

/**
 * Whether the student has supplied enough input for this step to be checkable.
 * Used to gate the CHECK button in the UI.
 */
export function isAnswerReady(step: Step, answer: Answer | null): boolean {
  if (!answer) return false;
  switch (answer.kind) {
    case "mcq":
      return answer.index >= 0;
    case "claim":
      return true;
    case "multiselect":
      return answer.indices.length >= 1;
    case "build": {
      // Ready as soon as the student has placed at least one valid tile. We
      // deliberately do NOT require the arrangement to match an accepted
      // length — the student is free to submit a short/wrong build and be
      // told it's incorrect. We still guard against malformed input (duplicate
      // or out-of-range tile indices) so evaluation has clean data.
      if (!step.build) return false;
      const { order } = answer;
      if (order.length < 1) return false;
      const unique = new Set(order);
      if (unique.size !== order.length) return false;
      if (order.some((i) => i < 0 || i >= step.build!.tiles.length)) {
        return false;
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * Evaluate a step's answer, returning whether it was correct plus the feedback
 * string to show. The format is resolved via {@link getStepFormat}; if the
 * expected format object is missing the step is treated as incorrect with empty
 * feedback rather than throwing.
 */
export function evaluateStep(
  step: Step,
  answer: Answer
): { correct: boolean; feedback: string } {
  const format = getStepFormat(step);

  switch (format) {
    case "mcq": {
      if (answer.kind !== "mcq") return { correct: false, feedback: "" };
      const opt = step.options?.[answer.index];
      return { correct: !!opt?.correct, feedback: opt?.feedback ?? "" };
    }

    case "claim": {
      if (answer.kind !== "claim" || !step.claim) {
        return { correct: false, feedback: "" };
      }
      const correct = answer.saidTrap === step.claim.isTrap;
      const feedback = answer.saidTrap
        ? step.claim.feedbackTrap
        : step.claim.feedbackSound;
      return { correct, feedback: feedback ?? "" };
    }

    case "multiselect": {
      if (answer.kind !== "multiselect" || !step.multiselect) {
        return { correct: false, feedback: "" };
      }
      const chosen = new Set(answer.indices);
      const correctSet = new Set<number>();
      step.multiselect.items.forEach((item, i) => {
        if (item.matters) correctSet.add(i);
      });
      const correct =
        chosen.size === correctSet.size &&
        [...correctSet].every((i) => chosen.has(i));
      const feedback = correct
        ? step.multiselect.feedbackCorrect
        : step.multiselect.feedbackWrong;
      return { correct, feedback: feedback ?? "" };
    }

    case "build": {
      if (answer.kind !== "build" || !step.build) {
        return { correct: false, feedback: "" };
      }
      const placed = answer.order.map((i) => step.build!.tiles[i]);
      const correct = step.build.accepted.some((arrangement) =>
        arraysEqual(arrangement, placed)
      );
      if (correct) {
        return { correct: true, feedback: step.build.feedbackCorrect ?? "" };
      }
      const distractor = step.build.distractors.find((d) =>
        placed.includes(d.tile)
      );
      return {
        correct: false,
        feedback: distractor ? distractor.feedback : step.build.feedbackWrong ?? "",
      };
    }

    default:
      return { correct: false, feedback: "" };
  }
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
