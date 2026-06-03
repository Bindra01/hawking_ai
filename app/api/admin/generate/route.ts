import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { generateProblem } from "@/lib/generate-problem";
import { isAdmin } from "@/lib/admin";
import { VALID_SUBJECTS, VALID_DIFFICULTIES } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user.email ?? undefined)) {
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { subject, topic, difficulty, count = 1 } = body;

    if (!subject || !topic || !difficulty) {
      return NextResponse.json(
        { error: "subject, topic, and difficulty are required" },
        { status: 400 }
      );
    }

    if (!VALID_SUBJECTS.includes(subject)) {
      return NextResponse.json(
        { error: `Invalid subject. Must be one of: ${VALID_SUBJECTS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json(
        { error: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(", ")}` },
        { status: 400 }
      );
    }

    const clampedCount = Math.min(Math.max(1, count), 5);
    const generated = [];

    for (let i = 0; i < clampedCount; i++) {
      const problem = await generateProblem(subject, topic, difficulty);

      const saved = await prisma.problems.create({
        data: {
          title: problem.title,
          subject: problem.subject,
          topic: problem.topic,
          difficulty: problem.difficulty,
          scenario: problem.scenario,
          goal: problem.goal,
          final_answer: problem.final_answer,
          diagram_type: null,
          solution_flow: problem.solution_flow as object,
          status: "draft",
        },
      });

      generated.push(saved);
    }

    return NextResponse.json({
      message: `Generated ${generated.length} problem(s) as drafts`,
      problems: generated,
    });
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 });
  }
}
