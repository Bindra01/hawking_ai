// Single source of truth for step-type → emoji icon mapping, shared across the
// play screen, problem card, and generation pipeline.
export const STEP_ICONS: Record<string, string> = {
  trap: "⚠️",
  identify: "🎯",
  principle: "⚡",
  setup: "🔧",
  sanity: "🧪",
  connect: "🧩",
  why: "💡",
};

export const DEFAULT_STEP_ICON = "•";

export function stepIcon(type: string): string {
  return STEP_ICONS[type] ?? DEFAULT_STEP_ICON;
}
