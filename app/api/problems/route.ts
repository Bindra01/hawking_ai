import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subject = req.nextUrl.searchParams.get("subject");
  const where = subject ? { subject } : {};

  const problems = await prisma.problems.findMany({
    where,
    orderBy: { created_at: "asc" },
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
      created_at: true,
    },
  });

  return NextResponse.json(problems);
}
