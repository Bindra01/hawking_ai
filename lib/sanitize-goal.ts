/**
 * Strip the final answer from a problem's goal text so the goal card never
 * spoils the answer during play. Uses plain substring matching (not regex)
 * because LaTeX answers contain characters that break regex escaping.
 *
 * Safe to call on goals that don't contain the answer — returns them unchanged.
 */
export function sanitizeGoal(goal: string, finalAnswer: string | null): string {
  if (!goal || !finalAnswer) return goal;

  const answer = finalAnswer.trim();
  let cleaned = goal;

  // Strip the answer as a plain substring — try with/without $ delimiters
  for (const needle of [`$${answer}$`, `$${answer}`, `${answer}$`, answer]) {
    while (cleaned.includes(needle)) {
      cleaned = cleaned.split(needle).join("");
    }
  }

  // Handle "≈" prefix on numeric answers (e.g. "≈ 517 m/s")
  const approxAnswer = answer.startsWith("≈") ? answer.slice(1).trim() : null;
  if (approxAnswer) {
    for (const needle of [`$${approxAnswer}$`, approxAnswer]) {
      while (cleaned.includes(needle)) {
        cleaned = cleaned.split(needle).join("");
      }
    }
  }

  // Strip bare "Find: " prefix that becomes empty/redundant after removal
  cleaned = cleaned.replace(/^Find:\s*/i, "").trim();
  // Clean up leftover lone $ delimiters and whitespace
  cleaned = cleaned.replace(/^\$\s*$/, "").replace(/\s+/g, " ").trim();

  // If the goal was entirely the answer, use a generic fallback
  if (cleaned.length < 10) {
    cleaned = "Find the answer to the problem described above.";
  }

  return cleaned;
}
