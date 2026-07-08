import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { ProblemListItem, Step } from "@/lib/types";
import { buildProblemListWhere } from "@/lib/problem-filters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = buildProblemListWhere(
    req.nextUrl.searchParams.get("subject"),
    req.nextUrl.searchParams.get("difficulty")
  );

  const problems = await prisma.problems.findMany({
    where,
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      title: true,
      subject: true,
      topic: true,
      difficulty: true,
      solution_flow: true,
      created_at: true,
    },
  });

  // The home feed only renders each card's step-type icons and step count
  // (see ProblemCard), so strip the heavy per-step content (prompts, options,
  // feedback, claim/multiselect/build data) before sending. On the seeded set
  // this cuts the list payload ~96% (76 KB -> ~3 KB) and removes the need to
  // shuffle options here — the full, shuffled problem is fetched on /play/[id].
  const lite: ProblemListItem[] = problems.map((p) => {
    const steps = (p.solution_flow as { steps?: Step[] })?.steps ?? [];
    return {
      id: p.id,
      title: p.title,
      subject: p.subject as ProblemListItem["subject"],
      topic: p.topic,
      difficulty: p.difficulty as ProblemListItem["difficulty"],
      created_at: p.created_at.toISOString(),
      solution_flow: { steps: steps.map((s) => ({ type: s.type })) },
    };
  });

  return NextResponse.json(lite);
}
