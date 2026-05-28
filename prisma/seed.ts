import { PrismaClient } from "@prisma/client";
import problems from "./hawking_flows_final.json";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing existing problems...");
  await prisma.attempts.deleteMany({});
  await prisma.problems.deleteMany({});

  console.log(`Seeding ${problems.length} problems...`);
  for (const p of problems) {
    await prisma.problems.create({
      data: {
        title: p.title,
        subject: p.subject,
        topic: p.topic,
        difficulty: p.difficulty,
        scenario: p.scenario,
        goal: p.goal,
        final_answer: p.final_answer,
        diagram_type: p.diagram_type ?? null,
        solution_flow: p.solution_flow as object,
      },
    });
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
