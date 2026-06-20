/**
 * Practice-based daily streak.
 *
 * The streak counts consecutive UTC days on which the student has solved at
 * least one problem (right or wrong — completing the problem is what counts).
 * It advances only when a problem attempt is saved, never on a plain app
 * visit/login.
 *
 * Given the user's last active day and today (both UTC-midnight dates),
 * returns the new streak value:
 * - no prior activity            -> 1 (first day)
 * - already practiced today      -> unchanged
 * - practiced exactly yesterday  -> +1
 * - gap of 2+ days               -> reset to 1
 */
export function calcStreak(
  currentStreak: number,
  lastActiveDate: Date | null,
  today: Date
): number {
  if (!lastActiveDate) return 1;

  const lastActiveDay = toUtcMidnight(lastActiveDate);
  const todayMidnight = toUtcMidnight(today);

  const diffDays = Math.round(
    (todayMidnight.getTime() - lastActiveDay.getTime()) / MS_PER_DAY
  );

  if (diffDays <= 0) return currentStreak; // already counted today (or clock skew)
  if (diffDays === 1) return currentStreak + 1; // consecutive day
  return 1; // missed a day — start over
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function toUtcMidnight(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
