export type Priority = "high" | "low";

export interface PriorityItem {
  heading?: string;
  title?: string;
  text: string;
  priority: Priority;
}

export interface SolveCallout {
  text: string;
  priority: Priority;
}

/**
 * The fixed Hawking step labels. They are the teaching mechanism: every solution shows the same
 * four signposts, so the renderer supplies them and the model never generates them.
 */
export const STEP_LABELS = {
  step1: "RECALL THE PRINCIPLE",
  step2: "WHAT GOES IN",
  step3: "MAP THE DERIVATION",
  derivation: "SET UP · DERIVE · ASSEMBLE",
} as const;

export interface SolveStep {
  answer: string;
  explanation: string;
  tip?: SolveCallout | null;
  warning?: SolveCallout | null;
}

export type DerivationBlock =
  | { type: "subsection"; title: string }
  | { type: "equation"; latex: string; annotation?: string }
  | { type: "prose"; text: string }
  | { type: "boxed_result"; latex: string };

export interface SolveSolution {
  title: string;
  tags: string[];
  problem_statement: string;
  problem_options: string[];
  framing_line: string;
  step1: SolveStep;
  step2: SolveStep;
  step3: SolveStep;
  derivation: {
    blocks: DerivationBlock[];
  };
  final_answer: {
    latex: string;
    display: string;
    option?: string;
  };
  reality_checks: PriorityItem[];
  common_errors: PriorityItem[];
  takeaways: PriorityItem[];
}

export type SolveFormat = "short" | "long";

export function showCallout(callout: SolveCallout | null | undefined, format: SolveFormat): boolean {
  return Boolean(callout && (format === "long" || callout.priority === "high"));
}

export const HAWKING_FOOTER =
  "Please note: This solution is AI-based. But the solving method and technique is my input to the AI. I am building an app — an AI tutor called Hawking AI — which aims to solve hard physics problems in a step-by-step way. I am still working on this, so your feedback will be really helpful!";

export function highPriority(items: PriorityItem[], limit: number): PriorityItem[] {
  return items.filter((item) => item.priority === "high").slice(0, limit);
}
