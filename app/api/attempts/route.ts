import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { calcStreak } from "@/lib/streak";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.users.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json([]);

  const attempts = await prisma.attempts.findMany({
    where: { user_id: dbUser.id },
    orderBy: { completed_at: "desc" },
  });

  return NextResponse.json(attempts);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.users.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const { problem_id, steps_correct, steps_total, xp_earned, stars } = body;

  // Solving a problem (right or wrong) is what advances the daily streak.
  // Normalize to UTC midnight up front so the value compared by calcStreak and
  // the value written to the @db.Date column are the same unambiguous day.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const newStreak = calcStreak(
    dbUser.current_streak,
    dbUser.last_active_date,
    today
  );

  // Record the attempt and award XP + advance the streak atomically, so we
  // never persist a solved attempt without its corresponding stat update.
  const [attempt] = await prisma.$transaction([
    prisma.attempts.create({
      data: {
        user_id: dbUser.id,
        problem_id,
        steps_correct,
        steps_total,
        xp_earned,
        stars,
      },
    }),
    prisma.users.update({
      where: { id: dbUser.id },
      data: {
        total_xp: { increment: xp_earned },
        current_streak: newStreak,
        longest_streak: Math.max(dbUser.longest_streak, newStreak),
        last_active_date: today,
      },
    }),
  ]);

  return NextResponse.json(attempt);
}
