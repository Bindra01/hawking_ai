import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user.email ?? undefined)) {
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const where = status ? { status } : {};

  const problems = await prisma.problems.findMany({
    where,
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      title: true,
      subject: true,
      topic: true,
      difficulty: true,
      scenario: true,
      goal: true,
      final_answer: true,
      diagram_type: true,
      solution_flow: true,
      status: true,
      created_at: true,
    },
  });

  return NextResponse.json(problems);
}
