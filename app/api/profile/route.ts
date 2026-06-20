import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { VALID_SUBJECTS } from "@/lib/constants";

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

  const subject_counts: Record<string, number> = Object.fromEntries(
    VALID_SUBJECTS.map((s) => [s, 0])
  );

  // Count each problem once, even if it was attempted multiple times, and only
  // when it buckets into a known subject — so the "Solved" total always equals
  // the sum of the per-subject breakdown bars (every solved problem belongs to
  // exactly one subject).
  const solvedProblemIds = new Set<string>();
  for (const a of attempts) {
    const subject = a.problem?.subject;
    if (!a.problem_id || !subject) continue;
    if (!Object.hasOwn(subject_counts, subject)) continue;
    if (solvedProblemIds.has(a.problem_id)) continue;
    solvedProblemIds.add(a.problem_id);
    subject_counts[subject] += 1;
  }

  return NextResponse.json({
    total_xp: dbUser.total_xp,
    current_streak: dbUser.current_streak,
    problems_solved: solvedProblemIds.size,
    subject_counts,
    name: dbUser.name,
    avatar_url: dbUser.avatar_url,
    email: dbUser.email,
  });
}
