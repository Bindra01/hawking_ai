import type { PredictRole, Step } from "@/lib/types";

/**
 * Pure helpers for the predict-the-dependence "Assemble the Form" step. No React
 * here — all branching logic (assembly, canonicalization) lives in this module so
 * it can be unit-tested independently of the renderer.
 */

/** The student's per-variable choice in the predict interaction. */
export type PredictChoice = "up" | "down" | "none";

/** An assembled factor plus the side of the ratio it lands on (null = omitted). */
export interface PredictEntry {
  factor: string;
  role: PredictRole | null;
}

/** Fixed constant factors that always render on a given side, regardless of picks. */
export interface PredictConstants {
  numerator?: string[];
  denominator?: string[];
}

/**
 * Map a student's choice to a ground-truth role, or null for "No effect".
 * `up` → numerator, `down` → denominator, `none` → null (omitted).
 */
export function roleForChoice(choice: PredictChoice): PredictRole | null {
  if (choice === "up") return "numerator";
  if (choice === "down") return "denominator";
  return null;
}

/**
 * Assemble a rendered monomial-ratio formula string from a target symbol, a list
 * of {factor, role} entries, and optional fixed constants.
 *
 * - numerator = constants.numerator ++ factors with role "numerator" (in order)
 * - denominator = constants.denominator ++ factors with role "denominator"
 * - entries with role null are omitted
 * - numerator is "1" when it would otherwise be empty
 *
 * ALL factors are joined with a SINGLE SPACE so LaTeX never mis-parses a command
 * followed by a letter (e.g. `["I", "\\rho", "L"]` → `"I \\rho L"`, which renders
 * `IρL` and never `\rhoL`). The result is `$…$`-wrapped so MathText renders it:
 * `"$<target> = <num>$"` when there is no denominator, else
 * `"$<target> = \\frac{<num>}{<den>}$"`.
 *
 * The exact space-join + `$…$` wrapping is what makes "Your form" and "Correct
 * form" normalized-identical when the roles match.
 */
export function assemblePredictFormula(
  target: string,
  entries: PredictEntry[],
  constants?: PredictConstants
): string {
  const numFactors: string[] = [...(constants?.numerator ?? [])];
  const denFactors: string[] = [...(constants?.denominator ?? [])];

  for (const entry of entries) {
    if (entry.role === "numerator") numFactors.push(entry.factor);
    else if (entry.role === "denominator") denFactors.push(entry.factor);
    // role === null → omitted entirely
  }

  const num = numFactors.length > 0 ? numFactors.join(" ") : "1";

  if (denFactors.length === 0) {
    return `$${target} = ${num}$`;
  }
  const den = denFactors.join(" ");
  return `$${target} = \\frac{${num}}{${den}}$`;
}

/** Read a step's fixed constants as arrays (defaulting to empty). */
export function predictConstants(step: Step): {
  numerator: string[];
  denominator: string[];
} {
  return {
    numerator: step.predict?.numeratorConstants ?? [],
    denominator: step.predict?.denominatorConstants ?? [],
  };
}

/**
 * Ground-truth entries from a step's predict variables and, when `choices` are
 * given, the student's entries keyed by variable symbol. `factor` falls back to
 * `symbol` when the generator omits it.
 */
export function predictEntries(
  step: Step,
  choices?: Record<string, PredictChoice>
): { groundTruth: PredictEntry[]; student: PredictEntry[] } {
  const variables = step.predict?.variables ?? [];
  const groundTruth: PredictEntry[] = variables.map((v) => ({
    factor: v.factor ?? v.symbol,
    role: v.role,
  }));
  const student: PredictEntry[] = choices
    ? variables.map((v) => ({
        factor: v.factor ?? v.symbol,
        role: roleForChoice(choices[v.symbol] ?? "none"),
      }))
    : [];
  return { groundTruth, student };
}

/** A parsed, order-invariant key for a monomial-ratio formula. */
export interface CanonicalFormula {
  target: string;
  numFactors: string[];
  denFactors: string[];
}

/**
 * STRICT parser that a formula is a pure monomial ratio. It is the core guard
 * behind the generator's equivalence assertion, so it FAILS on anything it
 * cannot fully account for (top-level +, -, \pm, unconsumed characters, more than
 * one `=`, …) rather than silently dropping tokens.
 *
 * Steps:
 *   1. strip `$` and ALL whitespace; normalize `^{x}`→`^x` and `_{x}`→`_x`.
 *   2. split on the FIRST `=` (throw if there is more than one `=`).
 *   3. parse the RHS as `\frac{num}{den}` or a bare numerator (den empty).
 *   4. tokenize each side by repeatedly consuming one factor from the front — a
 *      factor is `\cmd` optionally followed by `^power`, or a single letter/digit
 *      optionally followed by `^power`. If any character remains, or an operator
 *      is encountered, THROW.
 *   5. SORT each side's factors (multiplication commutes) → order-invariant key.
 *
 * This tolerance applies ONLY to the generator-time equivalence assertion; the
 * rendered strings shown to students keep their `$…$` + space-join form.
 */
export function canonicalPredictFormula(formula: string): CanonicalFormula {
  if (typeof formula !== "string" || formula.trim().length === 0) {
    throw new Error("canonicalPredictFormula: empty formula");
  }

  // 1. strip `$`; normalize brace groups on ^ and _; collapse runs of
  //    whitespace to a single space, then remove spaces that sit next to a
  //    STRUCTURAL token (`=`, `{`, `}`). Inter-factor spaces are PRESERVED as
  //    boundaries so `\rho L` tokenizes as [`\rho`, `L`] rather than the single
  //    greedy command `\rhoL` — otherwise `I \rho L` and `\rho L I` would not
  //    compare equal. Unspaced input (e.g. `n^2\pi^2\hbar^2`) still tokenizes
  //    because `^power` and `\command` boundaries break the factor regex.
  let s = formula.replace(/\$/g, "");
  s = s.replace(/\^\{([^{}]*)\}/g, "^$1").replace(/_\{([^{}]*)\}/g, "_$1");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\s*([={}])\s*/g, "$1");

  // 2. split on the FIRST `=`; reject more than one `=`.
  const eqCount = (s.match(/=/g) ?? []).length;
  if (eqCount > 1) {
    throw new Error(`canonicalPredictFormula: more than one "=" in "${formula}"`);
  }
  if (eqCount === 0) {
    throw new Error(`canonicalPredictFormula: missing "=" in "${formula}"`);
  }
  const eqIdx = s.indexOf("=");
  const target = s.slice(0, eqIdx);
  const rhs = s.slice(eqIdx + 1);
  if (target.length === 0) {
    throw new Error(`canonicalPredictFormula: empty target in "${formula}"`);
  }
  if (rhs.length === 0) {
    throw new Error(`canonicalPredictFormula: empty right-hand side in "${formula}"`);
  }

  // 3. parse RHS as \frac{num}{den} or a bare numerator.
  let numStr: string;
  let denStr: string;
  const fracMatch = /^\\frac\{([^{}]*)\}\{([^{}]*)\}$/.exec(rhs);
  if (fracMatch) {
    numStr = fracMatch[1];
    denStr = fracMatch[2];
  } else if (rhs.includes("\\frac")) {
    // A \frac that isn't the entire RHS (e.g. an additive term next to it) is
    // not a pure monomial ratio.
    throw new Error(
      `canonicalPredictFormula: RHS "${rhs}" is not a single monomial ratio`
    );
  } else {
    numStr = rhs;
    denStr = "";
  }

  const numFactors = numStr === "1" ? [] : tokenizeFactors(numStr, formula);
  const denFactors = denStr === "" ? [] : tokenizeFactors(denStr, formula);

  return {
    target,
    numFactors: numFactors.sort(),
    denFactors: denFactors.sort(),
  };
}

/**
 * Repeatedly consume one factor at a time from the front of `side`. A factor is
 * `\cmd` optionally followed by `^power`, or a single letter/digit optionally
 * followed by `^power`. Throws on any operator or unconsumed character.
 */
function tokenizeFactors(side: string, original: string): string[] {
  const factors: string[] = [];
  let rest = side;
  // \cmd | multi-digit number | single letter, each optionally followed by
  // ^power (a \cmd, a multi-digit number, or a single letter). The `\d+`
  // alternative MUST precede the single-char fallback so a multi-digit constant
  // like "12" tokenizes as ONE factor — otherwise "12" and "21" would both sort
  // to ["1","2"] and compare equal, letting a wrong "Correct form" ship.
  const factorRe = /^(?:\\[a-zA-Z]+|\d+|[A-Za-z])(?:\^(?:\\[a-zA-Z]+|\d+|[A-Za-z]))?/;

  while (rest.length > 0) {
    // Spaces are inter-factor boundaries (preserved by canonicalPredictFormula so
    // `\rho L` splits into two factors); skip them and continue.
    if (rest[0] === " ") {
      rest = rest.slice(1);
      continue;
    }
    // A top-level operator (or anything not starting a factor) is a hard fail:
    // additive answers must never masquerade as a monomial ratio.
    if (/^[+\-*/^_]/.test(rest) || rest.startsWith("\\pm") || rest.startsWith("\\cdot")) {
      throw new Error(
        `canonicalPredictFormula: unexpected operator in "${original}" near "${rest}"`
      );
    }
    const m = factorRe.exec(rest);
    if (!m) {
      throw new Error(
        `canonicalPredictFormula: unconsumed input in "${original}" near "${rest}"`
      );
    }
    factors.push(m[0]);
    rest = rest.slice(m[0].length);
  }
  return factors;
}

/**
 * Structural equality of two canonical keys (same target, same factor SETS on
 * each side after sorting).
 */
export function canonicalFormulaEquals(
  a: CanonicalFormula,
  b: CanonicalFormula
): boolean {
  return (
    a.target === b.target &&
    arraysEqual(a.numFactors, b.numFactors) &&
    arraysEqual(a.denFactors, b.denFactors)
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
