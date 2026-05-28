export const XP_CORRECT = 20;
export const XP_WRONG = 5;
export const XP_BONUS_ALL_CORRECT = 30;

export function calcXP(correct: number, total: number): number {
  const base = correct * XP_CORRECT + (total - correct) * XP_WRONG;
  const bonus = correct === total ? XP_BONUS_ALL_CORRECT : 0;
  return base + bonus;
}

export function calcStars(correct: number, total: number): number {
  const pct = correct / total;
  if (pct >= 0.8) return 3;
  if (pct >= 0.5) return 2;
  return 1;
}
