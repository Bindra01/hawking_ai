import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { sanitizeGoal } from "@/lib/sanitize-goal";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const problem = await prisma.problems.findUnique({ where: { id } });
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Never reveal the final answer inside the goal card.
  const goal = sanitizeGoal(problem.goal, problem.final_answer);
  return NextResponse.json({ ...problem, goal });
}
