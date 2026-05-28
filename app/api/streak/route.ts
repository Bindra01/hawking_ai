import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let dbUser = await prisma.users.findUnique({ where: { email: user.email! } });

  if (!dbUser) {
    dbUser = await prisma.users.create({
      data: {
        email: user.email!,
        name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      },
    });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const lastActive = dbUser.last_active_date
    ? new Date(dbUser.last_active_date)
    : null;

  let newStreak = dbUser.current_streak;

  if (lastActive) {
    const lastActiveDay = new Date(lastActive);
    lastActiveDay.setUTCHours(0, 0, 0, 0);

    const diffMs = today.getTime() - lastActiveDay.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays === 0) {
      // already counted today
      return NextResponse.json({ streak: newStreak });
    } else if (diffDays === 1) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const updated = await prisma.users.update({
    where: { id: dbUser.id },
    data: {
      current_streak: newStreak,
      longest_streak: Math.max(dbUser.longest_streak, newStreak),
      last_active_date: today,
    },
  });

  return NextResponse.json({ streak: updated.current_streak });
}
