/**
 * Read-only audit: find published problems whose build steps contain tiles that
 * embed a relation operator (whole/partial equations) instead of atomic
 * fragments — the data-quality bug where a "build" step degrades into a
 * disguised multiple-choice. Makes NO writes.
 *
 * Usage:
 *   npx tsx scripts/audit-build-tiles.ts --db-url "postgres://…"          # audit
 *   npx tsx scripts/audit-build-tiles.ts --db-url "…" --output report.json
 *   npx tsx scripts/audit-build-tiles.ts --db-url "…" --ids-output ids.txt # newline-separated affected ids
 */

import { PrismaClient } from "@prisma/client";
import { tileHasEmbeddedRelation } from "../lib/generate-problem";
import * as fs from "fs";

const args = process.argv.slice(2);
function getFlagValue(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

const DB_URL = getFlagValue("db-url");
const OUTPUT_PATH = getFlagValue("output");
const IDS_OUTPUT = getFlagValue("ids-output");
if (DB_URL) process.env.DATABASE_URL = DB_URL;

const prisma = new PrismaClient();

interface ProblemRow {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  created_at: Date;
  solution_flow: unknown;
}

interface BadTile {
  stepIndex: number;
  tile: string;
}

interface Finding {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  badTiles: BadTile[];
}

function inspect(problem: ProblemRow): BadTile[] {
  const flow = problem.solution_flow as
    | { steps?: Array<{ type?: string; build?: { tiles?: unknown } }> }
    | null;
  const steps = flow?.steps ?? [];
  const bad: BadTile[] = [];
  steps.forEach((step, stepIndex) => {
    const tiles = step?.build?.tiles;
    if (!Array.isArray(tiles)) return;
    for (const tile of tiles) {
      if (typeof tile === "string" && tileHasEmbeddedRelation(tile)) {
        bad.push({ stepIndex, tile });
      }
    }
  });
  return bad;
}

async function main() {
  console.log("=== Hawking AI — Build-Tile Quality Audit (read-only) ===\n");

  const problems = (await prisma.problems.findMany({
    where: { status: "published" },
    orderBy: { created_at: "asc" },
  })) as unknown as ProblemRow[];

  console.log(`Scanned ${problems.length} published problem(s).\n`);

  const findings: Finding[] = [];
  let buildStepProblemCount = 0;

  for (const p of problems) {
    const flow = p.solution_flow as { steps?: Array<{ build?: unknown }> } | null;
    const hasBuild = (flow?.steps ?? []).some((s) => s?.build != null);
    if (hasBuild) buildStepProblemCount++;

    const badTiles = inspect(p);
    if (badTiles.length > 0) {
      findings.push({
        id: p.id,
        title: p.title,
        subject: p.subject,
        topic: p.topic,
        difficulty: p.difficulty,
        badTiles,
      });
    }
  }

  console.log(`Problems containing a build step: ${buildStepProblemCount}`);
  console.log(`Problems with embedded-relation tiles (AFFECTED): ${findings.length}\n`);

  for (const f of findings) {
    console.log(`✗ ${f.title}`);
    console.log(`  id=${f.id} | ${f.subject} / ${f.topic} / ${f.difficulty}`);
    for (const bt of f.badTiles) {
      console.log(`    step ${bt.stepIndex}: ${bt.tile}`);
    }
  }

  if (OUTPUT_PATH) {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(findings, null, 2));
    console.log(`\nReport saved to: ${OUTPUT_PATH}`);
  }
  if (IDS_OUTPUT) {
    fs.writeFileSync(IDS_OUTPUT, findings.map((f) => f.id).join("\n") + "\n");
    console.log(`Affected ids saved to: ${IDS_OUTPUT}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
