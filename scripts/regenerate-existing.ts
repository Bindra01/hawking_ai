/**
 * Regenerate solution_flow for existing published problems.
 *
 * Usage:
 *   npx tsx scripts/regenerate-existing.ts                          # dry-run, local DB
 *   npx tsx scripts/regenerate-existing.ts --apply                  # apply to local DB
 *   npx tsx scripts/regenerate-existing.ts --db-url "postgres://…"  # use custom DB URL
 *   npx tsx scripts/regenerate-existing.ts --problem-id "abc-123"   # single problem
 *   npx tsx scripts/regenerate-existing.ts --output report.json     # save report to file
 */

import { PrismaClient } from "@prisma/client";
import { regenerateSteps, RegenerateStepsInput } from "../lib/generate-problem";
import * as fs from "fs";
import * as path from "path";

// ─── CLI arg parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function getFlagValue(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

const APPLY = getFlag("apply");
const DB_URL = getFlagValue("db-url");
const PROBLEM_ID = getFlagValue("problem-id");
const OUTPUT_PATH = getFlagValue("output");
const DELAY_MS = 3000; // 3 seconds between API calls

// ─── Setup ───────────────────────────────────────────────────────────────────

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is not set. Aborting.");
  process.exit(1);
}

// Override DATABASE_URL if --db-url is provided
if (DB_URL) {
  process.env.DATABASE_URL = DB_URL;
}

const prisma = new PrismaClient();

interface ProblemRow {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  scenario: string;
  goal: string;
  final_answer: string;
  solution_flow: unknown;
}

interface AuditResult {
  id: string;
  title: string;
  passed: boolean;
  issues: string[];
  oldStepCount: number;
  newStepCount: number;
  oldStepTypes: string[];
  newStepTypes: string[];
  newSolutionFlow?: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function auditSolutionFlow(
  problem: ProblemRow,
  newFlow: { steps: Array<{ type: string; options: Array<{ correct: boolean; feedback: string; distractor_type?: string; text: string }> }> }
): AuditResult {
  const oldFlow = problem.solution_flow as { steps: Array<{ type: string }> };
  const result: AuditResult = {
    id: problem.id,
    title: problem.title,
    passed: true,
    issues: [],
    oldStepCount: oldFlow?.steps?.length ?? 0,
    newStepCount: newFlow.steps.length,
    oldStepTypes: oldFlow?.steps?.map((s) => s.type) ?? [],
    newStepTypes: newFlow.steps.map((s) => s.type),
    newSolutionFlow: newFlow,
  };

  // Check step count
  if (newFlow.steps.length < 4 || newFlow.steps.length > 7) {
    result.issues.push(`Step count ${newFlow.steps.length} outside 4-7 range`);
    result.passed = false;
  }

  // Check last step is sanity
  if (newFlow.steps[newFlow.steps.length - 1]?.type !== "sanity") {
    result.issues.push(`Last step is "${newFlow.steps[newFlow.steps.length - 1]?.type}", not "sanity"`);
    result.passed = false;
  }

  for (let i = 0; i < newFlow.steps.length; i++) {
    const step = newFlow.steps[i];

    // Check distractor_type on wrong options
    for (const opt of step.options) {
      if (!opt.correct && !opt.distractor_type) {
        result.issues.push(`Step ${i}: wrong option missing distractor_type`);
      }
    }

    // Check wrong feedback length (aligned with validateAndNormalize threshold of 50 chars)
    for (const opt of step.options) {
      if (!opt.correct) {
        const len = opt.feedback.trim().length;
        if (len < 50) {
          result.issues.push(`Step ${i}: wrong feedback only ${len} chars (need 50+)`);
          result.passed = false;
        }
      }
    }
  }

  // Check if final answer is referenced in the step chain
  const finalAnswer = problem.final_answer.toLowerCase().trim();
  const allCorrectTexts = newFlow.steps
    .flatMap((s) => s.options.filter((o) => o.correct).map((o) => o.text.toLowerCase() + " " + o.feedback.toLowerCase()));
  const answerReferenced = allCorrectTexts.some((t) => {
    // Check for numeric/symbolic containment (fuzzy)
    const shortAnswer = finalAnswer.replace(/[^a-z0-9./-]/g, "");
    return t.includes(shortAnswer) || t.includes(finalAnswer);
  });
  if (!answerReferenced) {
    result.issues.push(`Final answer "${problem.final_answer}" not clearly referenced in any correct option`);
    // Warning, not a hard fail — the answer may be derived implicitly
  }

  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Hawking AI — Problem Regeneration Script ===");
  console.log(`Mode: ${APPLY ? "APPLY (will write to DB)" : "DRY-RUN (no DB writes)"}`);
  if (DB_URL) {
    // Redact credentials from URL for logging
    try {
      const parsed = new URL(DB_URL);
      console.log(`Custom DB: ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
    } catch {
      console.log("Custom DB URL: [provided]");
    }
  }
  console.log("");

  // 1. Preflight: fetch target problems
  const whereClause: Record<string, unknown> = { status: "published" };
  if (PROBLEM_ID) {
    whereClause.id = PROBLEM_ID;
  }

  const problems = (await prisma.problems.findMany({
    where: whereClause,
    orderBy: { created_at: "asc" },
  })) as unknown as ProblemRow[];

  if (problems.length === 0) {
    console.error("ERROR: No published problems found matching criteria. Aborting.");
    process.exit(1);
  }

  // Check for attempts
  const attemptCounts = await prisma.attempts.groupBy({
    by: ["problem_id"],
    _count: { id: true },
    where: { problem_id: { in: problems.map((p) => p.id) } },
  });

  const problemsWithAttempts = attemptCounts.filter((a) => a._count.id > 0);
  if (problemsWithAttempts.length > 0) {
    console.error(`ERROR: ${problemsWithAttempts.length} problem(s) have existing attempts. Aborting.`);
    console.error("Problem IDs with attempts:", problemsWithAttempts.map((a) => a.problem_id));
    console.error("Cannot regenerate problems with existing attempts.");
    process.exit(1);
  }

  console.log(`Found ${problems.length} published problem(s), 0 with attempts. Proceeding.\n`);

  // 2. Backup current solution_flow values
  const backupDir = "/code/.generated_artifacts";
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `backup-solution-flows-${timestamp}.json`);
  const backupData = problems.map((p) => ({
    id: p.id,
    title: p.title,
    solution_flow: p.solution_flow,
  }));
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`Backup saved to: ${backupPath}\n`);

  // 3. Regeneration loop
  const results: AuditResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    console.log(`[${i + 1}/${problems.length}] ${problem.title}`);
    console.log(`  Subject: ${problem.subject} | Topic: ${problem.topic} | Difficulty: ${problem.difficulty}`);

    try {
      const input: RegenerateStepsInput = {
        title: problem.title,
        subject: problem.subject,
        topic: problem.topic,
        difficulty: problem.difficulty,
        scenario: problem.scenario,
        goal: problem.goal,
        final_answer: problem.final_answer,
      };

      const newFlow = await regenerateSteps(input);
      const audit = auditSolutionFlow(problem, newFlow as { steps: Array<{ type: string; options: Array<{ correct: boolean; feedback: string; distractor_type?: string; text: string }> }> });
      results.push(audit);

      if (audit.passed) {
        console.log(`  ✓ PASS — ${audit.newStepCount} steps: ${audit.newStepTypes.join(" → ")}`);
        if (audit.issues.length > 0) {
          console.log(`  ⚠ Warnings: ${audit.issues.join("; ")}`);
        }
        succeeded++;
      } else {
        console.log(`  ✗ FAIL — ${audit.issues.join("; ")}`);
        failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ERROR — ${msg}`);
      results.push({
        id: problem.id,
        title: problem.title,
        passed: false,
        issues: [`Generation error: ${msg}`],
        oldStepCount: (problem.solution_flow as { steps: unknown[] })?.steps?.length ?? 0,
        newStepCount: 0,
        oldStepTypes: [],
        newStepTypes: [],
      });
      failed++;
    }

    // Delay between API calls to avoid rate limits
    if (i < problems.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // 4. Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Total: ${problems.length} | Passed: ${succeeded} | Failed: ${failed}`);

  // 5. Apply if requested
  if (APPLY) {
    const toApply = results.filter((r) => r.passed && r.newSolutionFlow);
    if (toApply.length === 0) {
      console.log("\nNo problems passed audit. Nothing to apply.");
    } else {
      console.log(`\nApplying ${toApply.length} problem(s) to database...`);
      for (const r of toApply) {
        await prisma.problems.update({
          where: { id: r.id },
          data: { solution_flow: r.newSolutionFlow as object },
        });
        console.log(`  Updated: ${r.title}`);
      }
      console.log(`Done. ${toApply.length} problem(s) updated.`);
    }
  } else {
    console.log("\nDry-run complete. Use --apply to write changes to the database.");
  }

  // 6. Save report if requested
  if (OUTPUT_PATH) {
    const reportData = results.map((r) => ({
      id: r.id,
      title: r.title,
      passed: r.passed,
      issues: r.issues,
      oldStepCount: r.oldStepCount,
      newStepCount: r.newStepCount,
      oldStepTypes: r.oldStepTypes,
      newStepTypes: r.newStepTypes,
    }));
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(reportData, null, 2));
    console.log(`\nReport saved to: ${OUTPUT_PATH}`);
  }

  await prisma.$disconnect();
  process.exit(APPLY && failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
