/**
 * One-off data normalization for the 14 manually-added / early-generated problems.
 * Fixes four display/rendering defects in the stored rows (IDs preserved):
 *
 *  Issue 1 — `goal` leaked the final answer (stored as "Find: <value>"). Rewritten
 *            to name the quantity sought, never its value.
 *  Issue 2 — build-step tiles mixed delimited ("$\\times$") and undelimited ("\\times",
 *            "=") LaTeX, so MathText rendered bare commands as literal text. Every
 *            tile (and every accepted arrangement entry + distractor.tile, which are
 *            matched by exact string equality in step-eval) is normalized to `$...$`.
 *  Issue 3 — `final_answer` had bare ("4 N") or unbalanced ("V_0 = 0.98$ V") LaTeX,
 *            surfacing literal underscores. Rewritten to balanced `$...$` LaTeX.
 *  Issue 4 — multiselect (identify) prompts were singular even when multiple items
 *            matter. Prompts for steps with >=2 matters:true items are rephrased plural.
 *
 * Safety: writes a timestamped backup of all rows BEFORE any write, applies all
 * updates in a single interactive transaction (session pooler), then reads back and
 * asserts the row count is unchanged and key fields are normalized.
 *
 * Usage:
 *   DRY (default): npx tsx scripts/normalize-display-fixes.ts
 *   APPLY:         npx tsx scripts/normalize-display-fixes.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const APPLY = process.argv.includes("--apply");

// Reads use the transaction pooler (pgbouncer) with prepared-statement workaround.
// Writes use the SESSION pooler (port 5432, no pgbouncer) for reliable interactive tx.
const base = process.env.PROD_DATABASE_URL!;
const readUrl = base.includes("?") ? base + "&pgbouncer=true&connection_limit=1" : base + "?pgbouncer=true&connection_limit=1";
const writeUrl = base.replace(":6543/", ":5432/");

// ─── Issue 1: goal names the quantity sought (NEVER its value) ────────────────
const GOAL: Record<string, string> = {
  "b9621a83-1b3c-43b5-aa79-369f80c92ce5": "Find the net force acting on the object",
  "a9b8f733-01a2-430a-a130-072b6c504942": "Find the ratio of the two particles' velocities",
  "02965b8a-44e4-4306-9838-b70c1a2b3956": "Find the escape velocity from the planet",
  "2bd7cb35-c4b8-4454-a071-54ba32d3d033": "Find the radius of the circular orbit",
  "cfd0c2bd-734f-43f6-8829-996048cfc0d4": "Find the point where the electric field vanishes",
  "ed296a06-05a3-42d4-b95c-2b558b675380": "Find the amplitude of the electric field at 5 m",
  "4b273a69-a2db-487f-a676-eb9e5e593685": "Find which frequencies are present in the field",
  "aa416099-d51b-41ce-89dd-9cdc7c0e58e7": "Find how far the piston moves",
  "31c80cf7-92fb-46bf-b391-942fa2efc1d2": "Find the temperature of the hydrogen (in °C)",
  "ca012851-8178-4352-bad4-b0a650216e1f": "Find the value of β/κ",
  "6c78516f-d26f-4872-a045-93e8c89215f3": "Find the ratio of the two orbital radii",
  "1a3bac02-43e3-40de-be2b-e0f868eec952": "Find the degeneracy of the 5th excited state",
  "f492383f-8b53-4d5d-a88f-149318867a1d": "Find the stopping potential $V_0$",
  "1d545dbd-56a2-403f-8e81-429531e9abef": "Find the work function $\\phi$ of the metal",
};

// ─── Issue 3: final_answer as balanced, well-formed LaTeX ─────────────────────
const FINAL_ANSWER: Record<string, string> = {
  "b9621a83-1b3c-43b5-aa79-369f80c92ce5": "$4\\,\\text{N}$",
  "a9b8f733-01a2-430a-a130-072b6c504942": "$\\sqrt{3} : 2$",
  "02965b8a-44e4-4306-9838-b70c1a2b3956": "$5.6\\,\\text{km/s}$",
  "2bd7cb35-c4b8-4454-a071-54ba32d3d033": "$(L^{2}/2mk)^{1/4}$",
  "cfd0c2bd-734f-43f6-8829-996048cfc0d4": "$(d/4,\\, 0,\\, 0)$",
  "ed296a06-05a3-42d4-b95c-2b558b675380": "$2.68\\,\\text{V/m}$",
  "4b273a69-a2db-487f-a676-eb9e5e593685": "$\\omega_{2},\\ \\omega_{2}+\\omega_{1},\\ \\omega_{2}-\\omega_{1}$",
  "aa416099-d51b-41ce-89dd-9cdc7c0e58e7": "$15.5\\,\\text{cm}$",
  "31c80cf7-92fb-46bf-b391-942fa2efc1d2": "$-253\\,^{\\circ}\\text{C}$",
  "ca012851-8178-4352-bad4-b0a650216e1f": "$(\\partial P/\\partial T)_V$",
  "6c78516f-d26f-4872-a045-93e8c89215f3": "$2/3$",
  "1a3bac02-43e3-40de-be2b-e0f868eec952": "$6$",
  "f492383f-8b53-4d5d-a88f-149318867a1d": "$V_0 = 0.98\\,\\text{V}$",
  "1d545dbd-56a2-403f-8e81-429531e9abef": "$\\phi = 1.01\\,\\text{eV}$",
};

// ─── Issue 4: plural multiselect prompts (only steps with >=2 matters:true) ───
// Keyed by problem id; only listed prompts are rewritten. Single-correct identify
// steps (matters===1) are intentionally left singular.
const MULTISELECT_PROMPT: Record<string, string> = {
  "b9621a83-1b3c-43b5-aa79-369f80c92ce5":
    "You're tempted to calculate force using mass and acceleration, but what are the key quantities we need to find first? Select all that apply.",
  "a9b8f733-01a2-430a-a130-072b6c504942":
    "Your first thought might be to compare the forces — but what are the key insights about the velocities needed for constant centripetal force? Select all that apply.",
  "2bd7cb35-c4b8-4454-a071-54ba32d3d033":
    "What are the key physical insights for finding the orbit radius in this potential U(r) = kr²? Select all that apply.",
  "cfd0c2bd-734f-43f6-8829-996048cfc0d4":
    "You might instinctively think to find the midpoint of the charges, but the electric field doesn't vanish there. What are the key parameters that determine where the field is zero? Select all that apply.",
  "ed296a06-05a3-42d4-b95c-2b558b675380":
    "To find the E-field amplitude, what are the crucial quantities here: the total power, efficiency, or distance? Select all that apply.",
  "4b273a69-a2db-487f-a676-eb9e5e593685":
    "Before diving into the math, identify the key terms in E = a(1 + cosω₁t)cosω₂t. What are the terms that tell you which frequencies are present? Select all that apply.",
  "ca012851-8178-4352-bad4-b0a650216e1f":
    "Before diving into equations, what are the key thermodynamic quantities we are really comparing here? Select all that apply.",
  "6c78516f-d26f-4872-a045-93e8c89215f3":
    "Focus on what's different between Li²⁺ and He⁺. What are the key factors that affect the orbit radius here? Select all that apply.",
  "1a3bac02-43e3-40de-be2b-e0f868eec952":
    "For the 5th excited state, what are the key quantum numbers you should focus on? Select all that apply.",
  "f492383f-8b53-4d5d-a88f-149318867a1d":
    "What are the key quantities that directly determine the stopping potential in the photoelectric effect? Select all that apply.",
};

// Wrap a build tile in balanced `$...$`, stripping any existing delimiters first.
function wrapTile(s: string): string {
  let t = s.trim();
  if (t.startsWith("$$") && t.endsWith("$$")) t = t.slice(2, -2).trim();
  else if (t.startsWith("$") && t.endsWith("$")) t = t.slice(1, -1).trim();
  return "$" + t + "$";
}

function normalizeBuild(build: any) {
  if (!build) return;
  if (Array.isArray(build.tiles)) build.tiles = build.tiles.map(wrapTile);
  if (Array.isArray(build.accepted))
    build.accepted = build.accepted.map((arr: string[]) => arr.map(wrapTile));
  if (Array.isArray(build.distractors))
    build.distractors = build.distractors.map((d: any) => ({ ...d, tile: wrapTile(d.tile) }));
}

async function main() {
  const readClient = new PrismaClient({ datasources: { db: { url: readUrl } } });
  const rows: any[] = await readClient.$queryRawUnsafe(
    `SELECT id, goal, final_answer, solution_flow FROM problems ORDER BY created_at ASC`
  );
  console.log(`Loaded ${rows.length} problems.`);

  // Backup BEFORE any write.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = "/code/.generated_artifacts";
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `backup-display-fixes-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(rows, null, 2));
  console.log(`Backup written: ${backupPath}`);

  // Build the per-row update set.
  type Upd = { id: string; goal: string; final_answer: string; solution_flow: any };
  const updates: Upd[] = [];
  for (const r of rows) {
    const sf = typeof r.solution_flow === "string" ? JSON.parse(r.solution_flow) : r.solution_flow;
    const steps = sf?.steps ?? sf;
    let msApplied = 0;
    let buildApplied = 0;
    for (const s of steps) {
      if (s.format === "build" || s.type === "setup") {
        if (s.build) { normalizeBuild(s.build); buildApplied++; }
      }
      if (s.format === "multiselect" || s.type === "identify") {
        const matters = (s.multiselect?.items ?? []).filter((i: any) => i.matters).length;
        const newPrompt = MULTISELECT_PROMPT[r.id];
        if (matters >= 2 && newPrompt) { s.prompt = newPrompt; msApplied++; }
      }
    }
    const goal = GOAL[r.id] ?? r.goal;
    const final_answer = FINAL_ANSWER[r.id] ?? r.final_answer;
    updates.push({ id: r.id, goal, final_answer, solution_flow: sf });
    console.log(`- ${r.id}: goal="${goal}" ans="${final_answer}" build=${buildApplied} ms=${msApplied}`);
  }

  await readClient.$disconnect();

  if (!APPLY) {
    console.log("\nDRY RUN. Re-run with --apply to write changes.");
    return;
  }

  const writeClient = new PrismaClient({ datasources: { db: { url: writeUrl } } });
  await writeClient.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.$executeRawUnsafe(
        `UPDATE problems SET goal = $1, final_answer = $2, solution_flow = $3::jsonb WHERE id = $4::uuid`,
        u.goal,
        u.final_answer,
        JSON.stringify(u.solution_flow),
        u.id
      );
    }
  });
  console.log(`\nApplied ${updates.length} updates.`);

  // Read-back verification — asserts (throws) on any failure so a partial or
  // incorrect migration cannot exit successfully. Verifies all four fixes,
  // including the build-tile and multiselect-prompt changes in solution_flow.
  const verifyClient = new PrismaClient({ datasources: { db: { url: readUrl } } });
  const after: any[] = await verifyClient.$queryRawUnsafe(
    `SELECT id, goal, final_answer, solution_flow FROM problems ORDER BY created_at ASC`
  );
  console.log(`\nRead-back count: ${after.length} (expected ${rows.length})`);
  const problems: string[] = [];
  if (after.length !== rows.length) {
    problems.push(`row count changed: ${rows.length} -> ${after.length}`);
  }
  for (const r of after) {
    // Issue 1: goal must not leak a value via the old "Find: <value>" prefix.
    if (/^Find:\s/.test(r.goal)) problems.push(`${r.id}: goal still has "Find:" prefix -> ${r.goal}`);
    // Issue 3: final_answer must be balanced $...$ LaTeX.
    const dollars = (r.final_answer.match(/\$/g) || []).length;
    if (dollars === 0 || dollars % 2 !== 0) problems.push(`${r.id}: final_answer not balanced $...$ -> ${r.final_answer}`);

    const sf = typeof r.solution_flow === "string" ? JSON.parse(r.solution_flow) : r.solution_flow;
    for (const s of sf?.steps ?? sf) {
      // Issue 2: every build tile / accepted entry / distractor must be $...$-wrapped.
      if (s.build) {
        const allTiles = [
          ...s.build.tiles,
          ...(s.build.accepted ?? []).flat(),
          ...(s.build.distractors ?? []).map((d: any) => d.tile),
        ];
        for (const t of allTiles) {
          if (!(typeof t === "string" && t.trim().startsWith("$") && t.trim().endsWith("$"))) {
            problems.push(`${r.id}: build tile not $...$-wrapped -> ${JSON.stringify(t)}`);
          }
        }
      }
      // Issue 4: multi-matter identify prompts must read plural ("Select all that apply").
      if ((s.format === "multiselect" || s.type === "identify") && MULTISELECT_PROMPT[r.id]) {
        const matters = (s.multiselect?.items ?? []).filter((i: any) => i.matters).length;
        if (matters >= 2 && s.prompt !== MULTISELECT_PROMPT[r.id]) {
          problems.push(`${r.id}: multiselect prompt not pluralized as expected`);
        }
      }
    }
  }
  await verifyClient.$disconnect();
  await writeClient.$disconnect();

  if (problems.length > 0) {
    console.error(`Read-back FAILED with ${problems.length} issue(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    throw new Error("Read-back verification failed; see issues above.");
  }
  console.log("Read-back OK: count unchanged, goals/final_answers/tiles/prompts all normalized.");
}

main().catch((e) => { console.error(e); process.exit(1); });
