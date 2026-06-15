/**
 * Regenerate solution_flow for existing published problems.
 *
 * Usage:
 *   npx tsx scripts/regenerate-existing.ts                          # dry-run, local DB
 *   npx tsx scripts/regenerate-existing.ts --apply                  # apply (update in place)
 *   npx tsx scripts/regenerate-existing.ts --apply --replace        # write new rows + delete old (appear as new; unlinks attempts)
 *   npx tsx scripts/regenerate-existing.ts --db-url "postgres://…"  # use custom DB URL
 *   npx tsx scripts/regenerate-existing.ts --problem-id "abc-123"   # single problem
 *   npx tsx scripts/regenerate-existing.ts --output report.json     # save report to file
 */

import { PrismaClient } from "@prisma/client";
import { regenerateSteps, RegenerateStepsInput } from "../lib/generate-problem";
import { Step, getStepFormat } from "../lib/types";
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
// In --replace mode, each regenerated problem is written as a NEW row (fresh id
// + created_at) and the old row is deleted, so the problem appears brand new and
// follows the gamified structure. This also lets us regenerate problems that have
// existing attempts: the attempts.problem_id FK is ON DELETE SET NULL, so deleting
// the old row unlinks (but never deletes) the student's attempt history.
const REPLACE = getFlag("replace");
const DB_URL = getFlagValue("db-url");
const PROBLEM_ID = getFlagValue("problem-id");
const OUTPUT_PATH = getFlagValue("output");
const DELAY_MS = 3000; // 3 seconds between API calls
// Number of additional regeneration attempts per problem when the audit fails.
// Stochastic build-step slips reliably recover on a fresh generation.
const MAX_REROLLS = 4;

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
  diagram_type: string | null;
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

function writeReport(results: AuditResult[], outputPath: string | undefined): void {
  if (!outputPath) return;
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
  fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
  console.log(`\nReport saved to: ${outputPath}`);
}

function auditSolutionFlow(
  problem: ProblemRow,
  newFlow: { steps: Step[] }
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
    const format = getStepFormat(step);

    switch (format) {
      case "mcq": {
        const options = step.options;
        if (!options || options.length !== 4) {
          result.issues.push(`Step ${i} (mcq): expected 4 options, got ${options?.length ?? 0}`);
          result.passed = false;
          break;
        }
        const correctCount = options.filter((o) => o.correct).length;
        if (correctCount !== 1) {
          result.issues.push(`Step ${i} (mcq): expected exactly 1 correct option, got ${correctCount}`);
          result.passed = false;
        }
        for (const opt of options) {
          // Check distractor_type on wrong options
          if (!opt.correct && !opt.distractor_type) {
            result.issues.push(`Step ${i} (mcq): wrong option missing distractor_type`);
          }
          // Check wrong feedback length (aligned with validateAndNormalize threshold of 50 chars)
          if (!opt.correct) {
            const len = opt.feedback.trim().length;
            if (len < 50) {
              result.issues.push(`Step ${i} (mcq): wrong feedback only ${len} chars (need 50+)`);
              result.passed = false;
            }
          }
        }
        break;
      }
      case "claim": {
        const claim = step.claim;
        if (!claim) {
          result.issues.push(`Step ${i} (claim): missing claim object`);
          result.passed = false;
          break;
        }
        if (!claim.statement || !claim.statement.trim()) {
          result.issues.push(`Step ${i} (claim): missing statement`);
          result.passed = false;
        }
        if (typeof claim.isTrap !== "boolean") {
          result.issues.push(`Step ${i} (claim): isTrap is not a boolean`);
          result.passed = false;
        }
        if (!claim.feedbackTrap || !claim.feedbackTrap.trim()) {
          result.issues.push(`Step ${i} (claim): missing feedbackTrap`);
          result.passed = false;
        }
        if (!claim.feedbackSound || !claim.feedbackSound.trim()) {
          result.issues.push(`Step ${i} (claim): missing feedbackSound`);
          result.passed = false;
        }
        break;
      }
      case "multiselect": {
        const ms = step.multiselect;
        if (!ms || !Array.isArray(ms.items) || ms.items.length === 0) {
          result.issues.push(`Step ${i} (multiselect): missing items`);
          result.passed = false;
          break;
        }
        const mattersCount = ms.items.filter((it) => it.matters === true).length;
        const notMattersCount = ms.items.filter((it) => it.matters === false).length;
        if (mattersCount < 1) {
          result.issues.push(`Step ${i} (multiselect): needs >=1 item that matters`);
          result.passed = false;
        }
        if (notMattersCount < 1) {
          result.issues.push(`Step ${i} (multiselect): needs >=1 item that does not matter`);
          result.passed = false;
        }
        break;
      }
      case "build": {
        const build = step.build;
        if (!build) {
          result.issues.push(`Step ${i} (build): missing build object`);
          result.passed = false;
          break;
        }
        if (!Array.isArray(build.tiles) || build.tiles.length === 0) {
          result.issues.push(`Step ${i} (build): missing tiles`);
          result.passed = false;
        }
        if (!Array.isArray(build.accepted) || build.accepted.length < 1) {
          result.issues.push(`Step ${i} (build): needs >=1 accepted arrangement`);
          result.passed = false;
        }
        if (!Array.isArray(build.distractors) || build.distractors.length < 1) {
          result.issues.push(`Step ${i} (build): needs >=1 distractor`);
          result.passed = false;
        }
        break;
      }
    }
  }

  // Check if final answer is referenced in the step chain (mcq correct options only;
  // other formats derive the answer implicitly so this remains a soft warning).
  const finalAnswer = problem.final_answer.toLowerCase().trim();
  const allCorrectTexts = newFlow.steps
    .filter((s) => getStepFormat(s) === "mcq")
    .flatMap((s) =>
      (s.options ?? [])
        .filter((o) => o.correct)
        .map((o) => o.text.toLowerCase() + " " + o.feedback.toLowerCase())
    );
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
  if (problemsWithAttempts.length > 0 && !REPLACE) {
    console.error(`ERROR: ${problemsWithAttempts.length} problem(s) have existing attempts. Aborting.`);
    console.error("Problem IDs with attempts:", problemsWithAttempts.map((a) => a.problem_id));
    console.error("Cannot regenerate problems with existing attempts. Use --replace to write new rows and delete the old ones (attempts are unlinked, not deleted).");
    process.exit(1);
  }

  const attemptNote = problemsWithAttempts.length > 0
    ? `${problemsWithAttempts.length} with attempts (will be unlinked via ON DELETE SET NULL in --replace mode)`
    : "0 with attempts";
  console.log(`Found ${problems.length} published problem(s), ${attemptNote}. Proceeding.\n`);

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

    const input: RegenerateStepsInput = {
      title: problem.title,
      subject: problem.subject,
      topic: problem.topic,
      difficulty: problem.difficulty,
      scenario: problem.scenario,
      goal: problem.goal,
      final_answer: problem.final_answer,
    };

    // Re-roll loop: a single regeneration occasionally produces a stochastic
    // model slip (most often a build/"setup" step whose tiles/accepted/distractors
    // are internally inconsistent). Re-generating from scratch reliably recovers,
    // so we re-roll up to MAX_REROLLS times until the audit passes.
    let finalResult: AuditResult | null = null;
    let lastErrorMsg = "";
    for (let roll = 0; roll <= MAX_REROLLS; roll++) {
      try {
        const newFlow = await regenerateSteps(input);
        const audit = auditSolutionFlow(problem, newFlow as unknown as { steps: Step[] });
        if (audit.passed) {
          finalResult = audit;
          break;
        }
        lastErrorMsg = audit.issues.join("; ");
        finalResult = audit; // keep the last failing audit if all rolls fail
        console.log(`  ↻ re-roll ${roll + 1}/${MAX_REROLLS} after FAIL — ${lastErrorMsg}`);
      } catch (err) {
        lastErrorMsg = err instanceof Error ? err.message : String(err);
        finalResult = {
          id: problem.id,
          title: problem.title,
          passed: false,
          issues: [`Generation error: ${lastErrorMsg}`],
          oldStepCount: (problem.solution_flow as { steps: unknown[] })?.steps?.length ?? 0,
          newStepCount: 0,
          oldStepTypes: [],
          newStepTypes: [],
        };
        console.log(`  ↻ re-roll ${roll + 1}/${MAX_REROLLS} after ERROR — ${lastErrorMsg}`);
      }
      if (roll < MAX_REROLLS) await sleep(DELAY_MS);
    }

    const result = finalResult!;
    results.push(result);
    if (result.passed) {
      console.log(`  ✓ PASS — ${result.newStepCount} steps: ${result.newStepTypes.join(" → ")}`);
      if (result.issues.length > 0) {
        console.log(`  ⚠ Warnings: ${result.issues.join("; ")}`);
      }
      succeeded++;
    } else {
      console.log(`  ✗ FAIL — ${result.issues.join("; ")}`);
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
    // Safety: never do a partial migration. If any problem failed the audit,
    // abort before writing anything so we don't end up with a mix of
    // regenerated and stale problems. (A single targeted --problem-id run is
    // exempt: the operator explicitly scoped it to one problem.)
    if (failed > 0 && !PROBLEM_ID) {
      console.error(
        `\nABORTING APPLY: ${failed} problem(s) failed the audit. ` +
          `Re-run until all ${problems.length} pass before applying (apply must be all-or-nothing).`
      );
      // Write the report for inspection, then exit non-zero.
      writeReport(results, OUTPUT_PATH);
      await prisma.$disconnect();
      process.exit(1);
    }

    const toApply = results.filter((r) => r.passed && r.newSolutionFlow);
    if (toApply.length === 0) {
      console.log("\nNo problems passed audit. Nothing to apply.");
    } else if (REPLACE) {
      // Replace mode: write each regenerated problem as a brand-new row (fresh id
      // + created_at = now, so it surfaces as new) and delete the old row in the
      // same transaction. The attempts FK is ON DELETE SET NULL, so any student
      // attempts on the old problem are unlinked, never deleted.
      console.log(`\nReplacing ${toApply.length} problem(s) (create new + delete old)...`);
      const byId = new Map(problems.map((p) => [p.id, p]));
      for (const r of toApply) {
        const src = byId.get(r.id);
        if (!src) continue;
        await prisma.$transaction(async (tx) => {
          const created = await tx.problems.create({
            data: {
              title: src.title,
              subject: src.subject,
              topic: src.topic,
              difficulty: src.difficulty,
              scenario: src.scenario,
              goal: src.goal,
              final_answer: src.final_answer,
              diagram_type: src.diagram_type,
              solution_flow: r.newSolutionFlow as object,
              status: "published",
            },
          });
          await tx.problems.delete({ where: { id: src.id } });
          console.log(`  Replaced: ${src.title} (old ${src.id} -> new ${created.id})`);
        });
      }
      console.log(`Done. ${toApply.length} problem(s) replaced.`);
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
    console.log(`\nDry-run complete. Use --apply${REPLACE ? " --replace" : ""} to write changes to the database.`);
  }

  // 6. Save report if requested
  writeReport(results, OUTPUT_PATH);

  await prisma.$disconnect();
  process.exit(APPLY && failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
