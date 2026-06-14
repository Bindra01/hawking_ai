import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

/**
 * Admin-only roster of students.
 *
 * Returns one row per registered user with the fields an admin needs to track
 * sign-ups and engagement: email, name, signup date, last login, total XP, and
 * the number of problems they have attempted. Gated by isAdmin() so only
 * configured admin emails can read the student list.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user.email ?? undefined)) {
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
  }

  const users = await prisma.users.findMany({
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      total_xp: true,
      current_streak: true,
      last_login: true,
      created_at: true,
      _count: { select: { attempts: true } },
    },
  });

  const students = users.map(({ _count, ...u }) => ({
    ...u,
    problems_attempted: _count.attempts,
  }));

  return NextResponse.json(students);
}
