import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_DAILY = Number(process.env.SOLVE_DAILY_LIMIT || 20);
const MAX_PER_MINUTE = Number(process.env.SOLVE_MINUTE_LIMIT || 4);
const CONCURRENT_LEASE_MS = 90_000;

export type SolveLimitResult =
  | { allowed: true; release: () => Promise<void> }
  | { allowed: false; status: 429; message: string; retryAfterSeconds: number };

export async function acquireSolveSlot(userId: string, now = new Date()): Promise<SolveLimitResult> {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const minuteFloor = new Date(now);
  minuteFloor.setUTCSeconds(0, 0);
  const token = randomUUID();

  const decision = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const existing = await tx.solve_usage.findUnique({ where: { user_id: userId } });
    const sameDay = existing?.day.getTime() === day.getTime();
    const sameMinute = existing?.minute_started_at.getTime() === minuteFloor.getTime();
    const dailyCount = sameDay ? existing.daily_count : 0;
    const minuteCount = sameMinute ? existing.minute_count : 0;

    if (existing?.concurrent_until && existing.concurrent_until > now) {
      return {
        allowed: false as const,
        message: "One solution is already being generated. Please wait for it to finish.",
        retryAfterSeconds: Math.max(1, Math.ceil((existing.concurrent_until.getTime() - now.getTime()) / 1000)),
      };
    }
    if (minuteCount >= MAX_PER_MINUTE) {
      return {
        allowed: false as const,
        message: "You reached the short-term Solve limit. Please wait one minute.",
        retryAfterSeconds: Math.max(1, Math.ceil((minuteFloor.getTime() + 60_000 - now.getTime()) / 1000)),
      };
    }
    if (dailyCount >= MAX_DAILY) {
      const tomorrow = day.getTime() + 24 * 60 * 60 * 1000;
      return {
        allowed: false as const,
        message: "You reached today’s Solve limit. Please try again tomorrow.",
        retryAfterSeconds: Math.max(1, Math.ceil((tomorrow - now.getTime()) / 1000)),
      };
    }

    await tx.solve_usage.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        day,
        daily_count: 1,
        minute_started_at: minuteFloor,
        minute_count: 1,
        concurrent_token: token,
        concurrent_until: new Date(now.getTime() + CONCURRENT_LEASE_MS),
      },
      update: {
        day,
        daily_count: dailyCount + 1,
        minute_started_at: minuteFloor,
        minute_count: minuteCount + 1,
        concurrent_token: token,
        concurrent_until: new Date(now.getTime() + CONCURRENT_LEASE_MS),
        updated_at: now,
      },
    });
    return { allowed: true as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

  if (!decision.allowed) return { ...decision, status: 429 };

  return {
    allowed: true,
    release: async () => {
      await prisma.solve_usage.updateMany({
        where: { user_id: userId, concurrent_token: token },
        data: { concurrent_token: null, concurrent_until: null, updated_at: new Date() },
      });
    },
  };
}
