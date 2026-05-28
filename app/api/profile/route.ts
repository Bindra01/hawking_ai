import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  const attempts = await prisma.attempts.findMany({
    where: { user_id: dbUser.id },
    include: { problem: { select: { subject: true } } },
  });

  const subject_counts: Record<string, number> = {
    mechanics: 0,
    electrodynamics: 0,
    thermodynamics: 0,
    quantum_mechanics: 0,
  };

  for (const a of attempts) {
    if (a.problem?.subject) {
      subject_counts[a.problem.subject] = (subject_counts[a.problem.subject] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    total_xp: dbUser.total_xp,
    current_streak: dbUser.current_streak,
    problems_solved: attempts.length,
    subject_counts,
    name: dbUser.name,
    avatar_url: dbUser.avatar_url,
    email: dbUser.email,
  });
}
