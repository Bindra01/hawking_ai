/**
 * check-predict-generation.ts — standalone generation contract check for the
 * predict-the-dependence "Assemble the Form" step.
 *
 * Calls the REAL generateProblem() (which runs validateAndNormalize internally)
 * for a spread of symbolic monomial-ratio topics plus a numeric topic, then
 * asserts the predict contract holds where expected:
 *
 *   - A monomial-ratio problem's terminal `form` step carries a valid `predict`
 *     contract whose assembled ground truth CANONICALLY equals `correctFormula`
 *     (and, when the final_answer is itself symbolic, also the final_answer).
 *     Per decision #1028 predict applies even when the final_answer is a
 *     plugged-in NUMBER, as long as the SYMBOLIC form is a clean monomial ratio.
 *   - An additive / root / trig problem's terminal `form` step keeps the
 *     `equation` (build) contract — never `predict`.
 *   - Every generated problem passes validateAndNormalize (implicit — generateProblem
 *     throws otherwise).
 *
 * No Prisma / DATABASE_URL needed; only OPENAI_API_KEY. Run from repo root:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/check-predict-generation.ts
 *
 * Prints a per-problem PASS/FAIL line and exits non-zero on any failure.
 */

import { generateProblem } from "../lib/generate-problem";
import {
  assemblePredictFormula,
  canonicalPredictFormula,
  canonicalFormulaEquals,
} from "../lib/predict-form";
import { getStepFormat, type Step } from "../lib/types";

type Difficulty = "class_11" | "class_12" | "college";

interface Case {
  subject: string;
  topic: string;
  difficulty: Difficulty;
  // "predict" = expect a monomial-ratio predict contract on the terminal form;
  // "either"  = symbolic-leaning but the exact answer shape may be numeric or
  //             additive, so accept whichever contract the generator emits (still
  //             validated for internal consistency);
  // "build"   = expect a numeric/additive equation (build) contract.
  expect: "predict" | "either" | "build";
}

const CASES: Case[] = [
  // Symbolic monomial-ratio answers — should emit a predict contract.
  { subject: "electrodynamics", topic: "Ohm's Law and Resistance", difficulty: "class_12", expect: "predict" },
  { subject: "electrodynamics", topic: "Magnetic Force on a Moving Charge", difficulty: "class_12", expect: "predict" },
  { subject: "electrodynamics", topic: "Resistivity and Conductance", difficulty: "class_12", expect: "either" },
  // Numeric-answer topic whose SYMBOLIC form is a monomial ratio distinct from
  // its upstream governing law (setup qvB = mv²/r vs form r = mv/(qB)) — per
  // decision #1028 this should now be eligible for predict even though the
  // final_answer is a plugged-in number. Marked "either" because the exact
  // answer shape (and whether the model plugs in numbers) is at its discretion.
  { subject: "electrodynamics", topic: "Magnetic Force on a Moving Charge", difficulty: "class_11", expect: "either" },
  // RMS speed is a ROOT (√(3RT/M)) — not a monomial ratio, keeps equation/build.
  { subject: "thermodynamics", topic: "Kinetic Theory", difficulty: "class_11", expect: "build" },
];

/** Assert a condition; throw a labeled error on failure. */
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

/**
 * Validate the internal consistency of a predict contract on a terminal form
 * step: assembled ground truth == correctFormula == final_answer, canonically.
 */
function checkPredictContract(step: Step, finalAnswer: string): void {
  const predict = step.predict;
  assert(!!predict, "terminal form step is missing its predict contract");
  if (!predict) return;

  assert(!step.build, "predict form step must NOT also carry a build contract");
  assert(
    predict.variables.length >= 2 && predict.variables.length <= 8,
    `predict.variables out of range: ${predict.variables.length}`
  );

  const entries = predict.variables.map((v) => ({
    factor: v.factor ?? v.symbol,
    role: v.role,
  }));
  const assembled = assemblePredictFormula(predict.target, entries, {
    numerator: predict.numeratorConstants,
    denominator: predict.denominatorConstants,
  });

  const assembledCanon = canonicalPredictFormula(assembled);
  const correctCanon = canonicalPredictFormula(predict.correctFormula);

  assert(
    canonicalFormulaEquals(assembledCanon, correctCanon),
    `assembled "${assembled}" != correctFormula "${predict.correctFormula}"`
  );
  // final_answer may legitimately be a plugged-in NUMBER (predict is scoped to
  // the symbolic dependence). Skip the cross-check ONLY for a plugged-in number,
  // detected the same way as validatePredictStep: examine the value after an
  // optional "<symbol> =" prefix (strip $, ≈/\approx) — if it begins with a
  // numeric literal it is a plugged-in number, otherwise it is symbolic and must
  // parse as the same monomial ratio.
  const answerValue = finalAnswer
    .slice(finalAnswer.indexOf("=") + 1)
    .replace(/\$/g, "")
    .replace(/\\approx|\\sim|\\simeq|\\approxeq|[≈~]/g, "")
    .trim();
  const isPluggedInNumber = /^[+\-]?\d/.test(answerValue);
  const finalCanon = isPluggedInNumber ? null : canonicalPredictFormula(finalAnswer);
  if (finalCanon !== null) {
    assert(
      canonicalFormulaEquals(assembledCanon, finalCanon),
      `assembled "${assembled}" != final_answer "${finalAnswer}"`
    );
  }
}

async function runCase(c: Case): Promise<boolean> {
  const label = `${c.subject} / ${c.topic} [${c.difficulty}] (expect ${c.expect})`;
  try {
    const problem = await generateProblem(c.subject, c.topic, c.difficulty);
    const steps = problem.solution_flow.steps as unknown as Step[];
    const form = steps[steps.length - 1];
    assert(form.type === "form", `terminal step is "${form.type}", expected "form"`);

    const format = getStepFormat(form);

    if (c.expect === "predict") {
      assert(
        format === "predict",
        `expected a predict contract but terminal form resolved to "${format}"`
      );
      checkPredictContract(form, problem.final_answer);
    } else if (c.expect === "build") {
      assert(
        format === "build" && !form.predict,
        `expected a build (equation) contract but got "${format}" (predict present: ${!!form.predict})`
      );
    } else {
      // "either": whichever contract, validate its internal consistency.
      if (format === "predict") {
        checkPredictContract(form, problem.final_answer);
      } else {
        assert(
          format === "build" && !form.predict,
          `terminal form resolved to unexpected format "${format}"`
        );
      }
    }

    console.log(`PASS  ${label}  -> ${format}  (answer: ${problem.final_answer})`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL  ${label}\n      ${msg}`);
    return false;
  }
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set; cannot run generation check.");
    process.exit(1);
  }

  let allPassed = true;
  for (const c of CASES) {
    const ok = await runCase(c);
    allPassed = allPassed && ok;
  }

  if (!allPassed) {
    console.error("\nOne or more predict-generation checks FAILED.");
    process.exit(1);
  }
  console.log("\nAll predict-generation checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
