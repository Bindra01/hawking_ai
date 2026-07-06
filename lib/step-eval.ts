import { getStepFormat, type Step } from "@/lib/types";
import {
  assemblePredictFormula,
  predictConstants,
  predictEntries,
  roleForChoice,
  type PredictChoice,
} from "@/lib/predict-form";

/**
 * A student's answer for a single step. One variant per format. The UI builds
 * the appropriate variant and hands it to {@link isAnswerReady}/{@link evaluateStep};
 * scoring stays one boolean per step.
 */
export type Answer =
  | { kind: "mcq"; index: number }
  | { kind: "claim"; saidTrap: boolean }
  | { kind: "multiselect"; indices: number[] }
  | { kind: "build"; order: number[] }
  | { kind: "predict"; choices: Record<string, PredictChoice> };

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
      // Ready as soon as the student has placed at least one tile. They are
      // free to assemble any number of tiles in any order and continue — the
      // arrangement is then graded right or wrong by evaluateStep. We still
      // require unique, in-range tile indices so the answer is well-formed.
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
    case "predict": {
      // Gate CHECK until EVERY variable row has a non-empty choice.
      if (!step.predict) return false;
      const { choices } = answer;
      return step.predict.variables.every((v) => {
        const c = choices[v.symbol];
        return c === "up" || c === "down" || c === "none";
      });
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

    case "predict": {
      if (answer.kind !== "predict" || !step.predict) {
        return { correct: false, feedback: "" };
      }
      // Compare BY ROLE PER VARIABLE (not by assembled-string equality). The
      // loop iterates ONLY variables — fixed constants are never graded. A
      // "none" choice on a real variable always mismatches (ground truth is
      // never "none").
      const correct = step.predict.variables.every(
        (v) => roleForChoice(answer.choices[v.symbol] ?? "none") === v.role
      );
      // The in-component panels are the feedback; keep the generic string empty.
      return { correct, feedback: "" };
    }

    default:
      return { correct: false, feedback: "" };
  }
}

/**
 * Human-readable description of what the student actually answered for a step.
 * Pure and total — never throws; returns documented fallback strings for any
 * missing/out-of-range/mismatched data. Format is resolved via
 * {@link getStepFormat}.
 */
export function describeAnswer(step: Step, answer: Answer | null): string {
  if (!answer) return "(no answer)";
  const format = getStepFormat(step);

  switch (format) {
    case "mcq": {
      if (answer.kind !== "mcq") return "(no answer)";
      if (
        !step.options ||
        answer.index < 0 ||
        answer.index >= step.options.length
      ) {
        return "(no answer)";
      }
      return step.options[answer.index].text;
    }

    case "claim": {
      if (answer.kind !== "claim" || !step.claim) return "(no answer)";
      return answer.saidTrap ? "said it's a trap" : "said it sounds right";
    }

    case "multiselect": {
      if (answer.kind !== "multiselect" || !step.multiselect) {
        return "(no answer)";
      }
      const items = step.multiselect.items;
      const texts = answer.indices
        .filter((i) => i >= 0 && i < items.length)
        .map((i) => items[i].text);
      if (texts.length === 0) return "(nothing selected)";
      return texts.join(", ");
    }

    case "build": {
      if (answer.kind !== "build" || !step.build) return "(no answer)";
      const tiles = step.build.tiles;
      const placed = answer.order
        .filter((i) => i >= 0 && i < tiles.length)
        .map((i) => tiles[i]);
      if (placed.length === 0) return "(empty)";
      return placed.join(" ");
    }

    case "predict": {
      if (answer.kind !== "predict" || !step.predict) return "(no answer)";
      const { student } = predictEntries(step, answer.choices);
      return assemblePredictFormula(
        step.predict.target,
        student,
        predictConstants(step)
      );
    }

    default:
      return "(no answer)";
  }
}

/**
 * Human-readable description of the correct answer for a step. Pure and total —
 * never throws; returns "" when the format-specific data is missing.
 */
export function describeCorrectAnswer(step: Step): string {
  const format = getStepFormat(step);

  switch (format) {
    case "mcq":
      return step.options?.find((o) => o.correct)?.text ?? "";

    case "claim": {
      if (!step.claim) return "";
      return step.claim.isTrap ? "it's a trap" : "it sounds right";
    }

    case "multiselect": {
      if (!step.multiselect) return "";
      return step.multiselect.items
        .filter((item) => item.matters === true)
        .map((item) => item.text)
        .join(", ");
    }

    case "build":
      return step.build?.accepted?.[0]?.join(" ") ?? "";

    case "predict":
      // Normalized-equal to the assembled ground truth by the Task 4 generator
      // assertion; used by the recap.
      return step.predict?.correctFormula ?? "";

    default:
      return "";
  }
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
