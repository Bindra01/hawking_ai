export type Subject = "mechanics" | "electrodynamics" | "thermodynamics" | "quantum_mechanics";
export type Difficulty = "class_11" | "class_12" | "college";
export type StepType = "trap" | "identify" | "principle" | "setup" | "sanity" | "connect" | "why" | "solve" | "approach" | "depends" | "scale" | "limit" | "form";
export type ProblemStatus = "draft" | "approved" | "published" | "rejected";

/**
 * The interaction mechanic a step renders with. Derived deterministically from
 * the step's `type` (see `formatForType`) — the LLM never picks this directly.
 */
export type StepFormat = "mcq" | "claim" | "multiselect" | "build";

export interface StepOption {
  text: string;
  correct: boolean;
  feedback: string;
  distractor_type?: "misconception" | "procedural_slip" | "half_right";
}

/** Claim-or-Trap mechanic: one bold statement, the student taps "sound right" or "it's a trap". */
export interface ClaimData {
  statement: string;
  /** When true, the correct answer is "IT'S A TRAP". */
  isTrap: boolean;
  /** Feedback shown when the student taps "IT'S A TRAP". */
  feedbackTrap: string;
  /** Feedback shown when the student taps "SOUND RIGHT". */
  feedbackSound: string;
}

export interface MultiSelectItem {
  text: string;
  /** Whether this quantity actually matters for the problem. */
  matters: boolean;
}

/** Multi-select mechanic: tap the quantities/items that actually matter. */
export interface MultiSelectData {
  items: MultiSelectItem[];
  feedbackCorrect: string;
  feedbackWrong: string;
}

/** Build mechanic: tap tiles into order to construct the equation/setup. */
export interface BuildData {
  /** Tray tokens (LaTeX/text). Must be unique; includes distractor tiles. */
  tiles: string[];
  /** One or more accepted ordered arrangements; each is a subset of `tiles`. */
  accepted: string[][];
  /** Misconception feedback keyed to specific distractor tiles. */
  distractors: { tile: string; feedback: string }[];
  feedbackCorrect: string;
  feedbackWrong: string;
}

export interface Step {
  type: StepType;
  /** Optional; when absent the renderer resolves it via `getStepFormat`. */
  format?: StepFormat;
  label: string;
  icon: string;
  prompt: string;
  /** Present for `mcq` steps (exactly 4 options). */
  options?: StepOption[];
  claim?: ClaimData;
  multiselect?: MultiSelectData;
  build?: BuildData;
  tip: string;
}

export const VALID_STEP_TYPES: StepType[] = [
  "trap",
  "identify",
  "principle",
  "setup",
  "connect",
  "why",
  "solve",
  "sanity",
  "approach",
  "depends",
  "scale",
  "limit",
  "form",
];

/**
 * Step types that remain renderable for already-stored legacy/seeded problems
 * but must NEVER be emitted by new generation. The generator's hard block and
 * the regeneration auditor both reject a flow containing any of these.
 * `solve` (PREDICT THE FORM) was retired alongside `connect`/`sanity` when the
 * terminal beat became the `form` (ASSEMBLE THE FORM) build step.
 */
export const LEGACY_ONLY_STEP_TYPES: StepType[] = ["connect", "sanity", "solve"];

/**
 * Canonical step-type → format map. Used by the generator and by validation,
 * which always overwrites `step.format` from the step's `type`.
 */
export function formatForType(type: StepType): StepFormat {
  switch (type) {
    case "trap":
      return "claim";
    case "identify":
      return "multiselect";
    case "setup":
      return "build";
    case "depends":
      return "multiselect";
    case "scale":
      return "mcq";
    case "limit":
      return "claim";
    case "form":
      return "build";
    case "principle":
    case "connect":
    case "why":
    case "solve":
    case "sanity":
    case "approach":
      return "mcq";
    default:
      return "mcq";
  }
}

/**
 * Shape-aware runtime resolver. Reads the data actually present on a step so
 * that legacy/unregenerated MCQ steps (which have `options` but no `format`)
 * still render as `mcq` instead of being mis-resolved from their `type`.
 */
export function getStepFormat(step: Step): StepFormat {
  if (step.format) return step.format;
  if (step.claim) return "claim";
  if (step.multiselect) return "multiselect";
  if (step.build) return "build";
  if (step.options && step.options.length > 0) return "mcq";
  return VALID_STEP_TYPES.includes(step.type) ? formatForType(step.type) : "mcq";
}

export interface SolutionFlow {
  steps: Step[];
}

export interface Problem {
  id: string;
  title: string;
  subject: Subject;
  topic: string;
  difficulty: Difficulty;
  scenario: string;
  goal: string;
  final_answer: string;
  diagram_type?: string | null;
  solution_flow: SolutionFlow;
  status: ProblemStatus;
  created_at: string;
}

/**
 * Lightweight shape returned by `GET /api/problems` for the home feed. The
 * list only needs enough to render each card (title/subject/topic/difficulty
 * + the step-type icons and step count), so the heavy per-step content
 * (prompts, options, feedback, claim/multiselect/build data) and the
 * scenario/goal/final_answer fields are omitted. The full `Problem` is fetched
 * on demand by `/play/[id]`.
 */
export interface ProblemListItem {
  id: string;
  title: string;
  subject: Subject;
  topic: string;
  difficulty: Difficulty;
  created_at: string;
  solution_flow: { steps: Pick<Step, "type">[] };
}

export interface GenerateRequest {
  subject: Subject;
  topic: string;
  difficulty: Difficulty;
  count?: number;
}

export interface Attempt {
  id: string;
  user_id: string;
  problem_id: string;
  steps_correct: number;
  steps_total: number;
  xp_earned: number;
  stars: number;
  completed_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date?: string | null;
  created_at: string;
}

export interface ProfileStats {
  total_xp: number;
  current_streak: number;
  problems_solved: number;
  subject_counts: Record<Subject, number>;
}
