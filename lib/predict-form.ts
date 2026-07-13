import type { PredictRole, Step } from "@/lib/types";

// Transcendental (non-algebraic) LaTeX functions: trig, inverse/hyperbolic trig,
// log, ln, lg (log base 10), exp. A quantity wrapped in one of these is not a
// product/quotient of powers, so an answer containing it is not a monomial ratio.
// The trailing `(?![A-Za-z])` is a TeX control-word boundary (a `\command` ends
// at the first non-letter): it lets `\sec` match in `g \sec\theta` but NOT inside
// a longer command like `\sech`, and — unlike `\b` — it still fires on `\sin2`,
// `\sin_0`, and `\log_{10}` where a non-letter (digit / `_`) follows the name.
const TRANSCENDENTAL_FN =
  /\\(?:sin|cos|tan|cot|sec|csc|cosec|sinh|cosh|tanh|coth|sech|csch|arcsin|arccos|arctan|arccot|arcsec|arccsc|log|ln|lg|exp)(?![A-Za-z])/;

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
 *      factor is a `\cmd`/letter/multi-digit base optionally carrying `_sub`
 *      and/or `^power` in any order (so `\varepsilon_0`, `k_B`, `v_rms` are
 *      single factors). If any character remains, or an operator is
 *      encountered, THROW.
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
  // Strip purely DECORATIVE command wrappers so a symbol dressed in physics
  // convention canonicalizes to the same token as its plain form. Two families,
  // both identity-preserving (they change rendering, not which quantity it is):
  //   - typography: `m_{\mathrm{e}}` → `m_{e}`, `R_{\mathrm{eq}}` → `R_{eq}`,
  //     `T_{\text{c}}` → `T_{c}`;
  //   - vector/accent decorations, ubiquitous in E&M/mechanics answers (fields,
  //     forces, momentum): `\vec{v}` → `v`, `\vec{E}` → `E`, `\hat{n}` → `n`,
  //     `\dot{x}` → `x`. Without this, `\frac{q}{\vec{E}}`-style monomial ratios
  //     would hard-fail with "unconsumed input", the same crash class users hit.
  // Run twice so a wrapper nested one level deep (e.g. inside a subscript brace)
  // is unwrapped before the brace-flattening pass below. (The needle is a fixed
  // command set, not user LaTeX, so a static RegExp is safe here.)
  const wrapperRe =
    /\\(?:mathrm|mathbf|mathsf|mathit|mathcal|text|rm|bf|it|vec|hat|bar|tilde|dot|ddot|overline|underline|boldsymbol)\{([^{}]*)\}/g;
  s = s.replace(wrapperRe, "$1").replace(wrapperRe, "$1");
  // Normalize prime notation to a bare `'` so `v'`, `v^{\prime}`, and `v^\prime`
  // (all the same physical quantity) canonicalize to one token.
  s = s.replace(/\^\{?\\prime\}?/g, "'").replace(/\\prime/g, "'");
  // Normalize EXPLICIT multiplication operators to a plain inter-factor space:
  // `\cdot` and `\times` mean "these factors are multiplied", which is exactly
  // what a space already denotes to the tokenizer. Without this, a legitimate
  // monomial ratio written with an explicit dot (e.g. Coulomb's law
  // `\frac{k \cdot q_1 q_2}{r^2}`) hard-fails with "unexpected operator". A
  // trailing/leading run of spaces is collapsed later.
  //
  // Use a negative lookahead for a following LETTER rather than a JS `\b`: a TeX
  // control word ends at the first non-letter, so `\cdot2`, `\times10^3`, and
  // `\times\alpha` ARE the operator (and must normalize), while `\cdotfoo` /
  // `\timesx` are different commands and must NOT be consumed. `\b` fails to
  // match between the trailing letter and a digit, so `\cdot2` would otherwise
  // survive and falsely trip "unexpected operator".
  s = s.replace(/\\(?:cdot|times)(?![A-Za-z])/g, " ");
  // Strip MAGNITUDE / absolute-value bars, keeping their contents. In a monomial
  // ratio the magnitude of a product is the product of magnitudes, so `|q_1 q_2|`
  // grades identically to `q_1 q_2` for dependence purposes. All bar forms —
  // bare `|`, `\left|`/`\right|`, `\lvert`/`\rvert` — become an inter-factor
  // space in one pass. (Identity-preserving for distinctness: the quantities
  // inside are unchanged.)
  s = s.replace(/\\left\s*\||\\right\s*\||\\lvert|\\rvert|\|/g, " ");
  // Flatten `^{x}` → `^x` and `_{x}` → `_x`, but ONLY when the brace body has no
  // embedded `_`/`^`. A nested-script body like `v_{rms^2}` is left braced (and
  // then rejected downstream) rather than silently flattened to the same token
  // as the structurally-different `v_{rms}^2` — this keeps the strict guard from
  // treating two different LaTeX structures as equal.
  s = s.replace(/\^\{([^{}_^]*)\}/g, "^$1").replace(/_\{([^{}_^]*)\}/g, "_$1");
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

  // 2b. reject CALCULUS operators outright. A derivative, differential, or
  // integral is a rate/limit, not a product/quotient of powers of free
  // quantities, so it can never be a monomial ratio. `\int`, `\oint`,
  // `\partial`, `\nabla`, `\sum`, `\prod` are unambiguous. The Leibniz
  // derivative `\frac{d...}{d...}` is trickier because the tokenizer would
  // otherwise read the differential `d` as an ordinary single-letter factor
  // (e.g. `\frac{dp}{dt}` → [d,p]/[d,t]), silently mis-grading `d` as a physical
  // variable; detect the classic shape where BOTH sides of a `\frac` begin with
  // a differential `d` glued (no space) directly to a symbol/command.
  if (/\\(?:int|oint|partial|nabla|sum|prod)\b/.test(rhs)) {
    throw new Error(
      `canonicalPredictFormula: RHS "${rhs}" contains a calculus operator and is not a single monomial ratio`
    );
  }
  // 2c. reject TRANSCENDENTAL functions (trig, inverse/hyperbolic trig, log, ln,
  // exp). A quantity wrapped in sin/cos/log/… is a non-algebraic function of its
  // argument, not a product/quotient of powers, so the answer is not a monomial
  // ratio and the "which quantity is in the numerator vs denominator" prediction
  // is meaningless for it. Without this guard the tokenizer would read `\sin`,
  // `\cos`, `\log`, … as ordinary `\cmd` factors and silently grade e.g.
  // `a = g\sin\theta` as a monomial ratio with factors [g, \sin, \theta].
  if (TRANSCENDENTAL_FN.test(rhs)) {
    throw new Error(
      `canonicalPredictFormula: RHS "${rhs}" contains a transcendental function (trig/log/exp) and is not a single monomial ratio`
    );
  }
  // Parse the `\frac{num}{den}` shape ONCE here; reused by the Leibniz guard
  // below and by step 3.
  const fracMatch = /^\\frac\{([^{}]*)\}\{([^{}]*)\}$/.exec(rhs);
  // A "differential" side of a derivative starts with `d` (optionally a
  // higher-order power like `d^2` / `d^{2}`), then either a symbol/command it
  // differentiates (`dt`, `d p`, `d\Phi`, `d^2x`), OR nothing at all (the bare
  // operator numerator in `\frac{d}{dt}`). This guard fires only when BOTH
  // sides of the `\frac` look like this, so a lone distance variable `d` on one
  // side (e.g. `\frac{q}{d}`) never trips it and still parses as a monomial
  // ratio. Note `startsWithDifferential` requires the char after `d` (and any
  // order power) to be a space, a LETTER, a command, or end-of-string — so a
  // subscripted distance like `d_1` does NOT look like a differential (its next
  // char is `_`), and a ratio of two distances `\frac{d_1}{d_2}` correctly
  // parses as a monomial ratio rather than tripping the derivative guard.
  const startsWithDifferential = (s: string) =>
    /^d(?:\^\{?\d+\}?)?(?:\s|[A-Za-z]|\\|$)/.test(s.trim());
  if (
    fracMatch &&
    startsWithDifferential(fracMatch[1]) &&
    startsWithDifferential(fracMatch[2])
  ) {
    throw new Error(
      `canonicalPredictFormula: RHS "${rhs}" is a derivative (d.../d...) and is not a single monomial ratio`
    );
  }

  // 3. parse RHS as \frac{num}{den} or a bare numerator.
  let numStr: string;
  let denStr: string;
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
 * a base (`\cmd` / multi-digit number / single letter) followed by zero or more
 * `_sub`/`^power` groups in any order (the subscript is kept as part of the
 * token, so `\varepsilon_0`, `k_B`, `v_rms` are single factors), plus optional
 * trailing prime marks. Throws on any operator or unconsumed character.
 */
function tokenizeFactors(side: string, original: string): string[] {
  const factors: string[] = [];
  let rest = side;
  // A factor is a BASE (\cmd | multi-digit number | single letter) followed by
  // zero or more sub/superscripts in any order (`_sub` / `^power`). The `\d+`
  // alternative MUST precede the single-char fallback so a multi-digit constant
  // like "12" tokenizes as ONE factor — otherwise "12" and "21" would both sort
  // to ["1","2"] and compare equal, letting a wrong "Correct form" ship.
  //
  // Subscripts are consumed as PART of the symbol (not treated as operators):
  // vacuum permittivity `\varepsilon_0`, Boltzmann's `k_B`, `v_rms`, `N_A`,
  // `x_1` are single physical quantities that routinely appear in perfectly
  // valid monomial ratios (e.g. $I_d = \frac{I A}{\varepsilon_0}$). Because the
  // whole subscript is kept in the token, distinctness is preserved — `x_1` and
  // `x_2` remain different factors and never compare equal. (Brace groups like
  // `_{rms}` / `^{10}` are already flattened to `_rms` / `^10` upstream.)
  const factorRe =
    /^(?:\\[a-zA-Z]+|\d+|[A-Za-z])'*(?:[_^](?:\\[a-zA-Z]+|[A-Za-z0-9]+)'*)*/;

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
