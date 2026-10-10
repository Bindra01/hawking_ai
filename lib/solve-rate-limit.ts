interface UsageWindow {
  day: string;
  dailyCount: number;
  minuteStartedAt: number;
  minuteCount: number;
  concurrent: number;
  lastSeenAt: number;
}

const usageByUser = new Map<string, UsageWindow>();
const MAX_DAILY = Number(process.env.SOLVE_DAILY_LIMIT || 20);
const MAX_PER_MINUTE = Number(process.env.SOLVE_MINUTE_LIMIT || 4);
const MAX_CONCURRENT = Number(process.env.SOLVE_CONCURRENT_LIMIT || 1);
const MAX_TRACKED_USERS = 10_000;

export type SolveLimitResult =
  | { allowed: true; release: () => void }
  | { allowed: false; status: 429; message: string; retryAfterSeconds: number };

function prune(now: number) {
  if (usageByUser.size < MAX_TRACKED_USERS) return;
  const staleBefore = now - 48 * 60 * 60 * 1000;
  for (const [userId, usage] of usageByUser) {
    if (usage.concurrent === 0 && usage.lastSeenAt < staleBefore) usageByUser.delete(userId);
  }
}

export function acquireSolveSlot(userId: string, now = Date.now()): SolveLimitResult {
  prune(now);
  const day = new Date(now).toISOString().slice(0, 10);
  const current = usageByUser.get(userId) ?? {
    day,
    dailyCount: 0,
    minuteStartedAt: now,
    minuteCount: 0,
    concurrent: 0,
    lastSeenAt: now,
  };

  if (current.day !== day) {
    current.day = day;
    current.dailyCount = 0;
  }
  if (now - current.minuteStartedAt >= 60_000) {
    current.minuteStartedAt = now;
    current.minuteCount = 0;
  }
  current.lastSeenAt = now;
  usageByUser.set(userId, current);

  if (current.concurrent >= MAX_CONCURRENT) {
    return { allowed: false, status: 429, message: "One solution is already being generated. Please wait for it to finish.", retryAfterSeconds: 15 };
  }
  if (current.minuteCount >= MAX_PER_MINUTE) {
    const retryAfterSeconds = Math.max(1, Math.ceil((60_000 - (now - current.minuteStartedAt)) / 1000));
    return { allowed: false, status: 429, message: "You reached the short-term Solve limit. Please wait one minute.", retryAfterSeconds };
  }
  if (current.dailyCount >= MAX_DAILY) {
    const tomorrow = Date.parse(`${day}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
    return { allowed: false, status: 429, message: "You reached today’s Solve limit. Please try again tomorrow.", retryAfterSeconds: Math.max(1, Math.ceil((tomorrow - now) / 1000)) };
  }

  current.concurrent += 1;
  current.minuteCount += 1;
  current.dailyCount += 1;
  let released = false;
  return {
    allowed: true,
    release: () => {
      if (released) return;
      released = true;
      current.concurrent = Math.max(0, current.concurrent - 1);
      current.lastSeenAt = Date.now();
    },
  };
}
