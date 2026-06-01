export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import PlayScreen from "@/components/PlayScreen";
import { Problem } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlayPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }

  const { id } = await params;
  const problem = await prisma.problems.findUnique({ where: { id } });
  if (!problem) notFound();

  return (
    <PlayScreen
      problem={{
        id: problem.id,
        title: problem.title,
        subject: problem.subject as Problem["subject"],
        topic: problem.topic,
        difficulty: problem.difficulty as Problem["difficulty"],
        scenario: problem.scenario,
        goal: problem.goal,
        final_answer: problem.final_answer,
        diagram_type: problem.diagram_type,
        solution_flow: problem.solution_flow as unknown as Problem["solution_flow"],
        status: problem.status as Problem["status"],
        created_at: problem.created_at.toISOString(),
      }}
    />
  );
}
