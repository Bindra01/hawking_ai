import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

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

  // Never reveal the final answer inside the goal card — strip it at read-time
  // so even older stored problems that had "Find: [answer]" goals are safe.
  // Uses plain substring matching (not regex) because LaTeX answers contain
  // characters that break regex escaping.
  if (problem.goal && problem.final_answer) {
    const answer = problem.final_answer.trim();
    let goal = problem.goal;
    for (const needle of [`$${answer}$`, `$${answer}`, `${answer}$`, answer]) {
      while (goal.includes(needle)) {
        goal = goal.split(needle).join("");
      }
    }
    const approxAnswer = answer.startsWith("≈") ? answer.slice(1).trim() : null;
    if (approxAnswer) {
      for (const needle of [`$${approxAnswer}$`, approxAnswer]) {
        while (goal.includes(needle)) {
          goal = goal.split(needle).join("");
        }
      }
    }
    goal = goal.replace(/^Find:\s*/i, "").trim();
    goal = goal.replace(/^\$\s*$/, "").replace(/\s+/g, " ").trim();
    if (goal.length < 10) {
      goal = "Find the answer to the problem described above.";
    }
    return NextResponse.json({ ...problem, goal });
  }

  return NextResponse.json(problem);
}
