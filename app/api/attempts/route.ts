import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

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

  const attempt = await prisma.attempts.create({
    data: {
      user_id: dbUser.id,
      problem_id,
      steps_correct,
      steps_total,
      xp_earned,
      stars,
    },
  });

  // Update user XP
  await prisma.users.update({
    where: { id: dbUser.id },
    data: { total_xp: { increment: xp_earned } },
  });

  return NextResponse.json(attempt);
}
