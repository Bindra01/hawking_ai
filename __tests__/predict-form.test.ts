import { describe, it, expect } from "vitest";
import {
  assemblePredictFormula,
  canonicalPredictFormula,
  canonicalFormulaEquals,
  roleForChoice,
  type PredictEntry,
} from "@/lib/predict-form";

// The worked spec example uses V = I ρ L / A (Ohm's law form): current I and
// resistivity ρ and length L on top, area A underneath.
function ohmEntries(overrides: Record<string, PredictEntry["role"]> = {}): PredictEntry[] {
  const base: Record<string, PredictEntry["role"]> = {
    I: "numerator",
    "\\rho": "numerator",
    L: "numerator",
    A: "denominator",
  };
  const merged: Record<string, PredictEntry["role"]> = { ...base, ...overrides };
  return Object.keys(merged).map((factor) => ({
    factor,
    role: merged[factor],
  }));
}

describe("assemblePredictFormula — spec worked examples", () => {
  it("all-correct assembles $V = \\frac{I \\rho L}{A}$", () => {
    const s = assemblePredictFormula("V", ohmEntries());
    expect(s).toBe("$V = \\frac{I \\rho L}{A}$");
  });

  it("area-backwards (A → numerator) assembles $V = I \\rho L A$", () => {
    const s = assemblePredictFormula("V", ohmEntries({ A: "numerator" }));
    expect(s).toBe("$V = I \\rho L A$");
  });

  it("resistivity No-effect (ρ omitted) assembles $V = \\frac{I L}{A}$", () => {
    const entries: PredictEntry[] = [
      { factor: "I", role: "numerator" },
      { factor: "\\rho", role: null },
      { factor: "L", role: "numerator" },
      { factor: "A", role: "denominator" },
    ];
    const s = assemblePredictFormula("V", entries);
    expect(s).toBe("$V = \\frac{I L}{A}$");
  });
});

describe("assemblePredictFormula — edge cases", () => {
  it("no numerator factor forces numerator '1' ($V = \\frac{1}{A}$)", () => {
    const entries: PredictEntry[] = [
      { factor: "I", role: null },
      { factor: "\\rho", role: null },
      { factor: "L", role: null },
      { factor: "A", role: "denominator" },
    ];
    expect(assemblePredictFormula("V", entries)).toBe("$V = \\frac{1}{A}$");
  });

  it("all No-effect assembles $V = 1$", () => {
    const entries: PredictEntry[] = [
      { factor: "I", role: null },
      { factor: "\\rho", role: null },
      { factor: "L", role: null },
      { factor: "A", role: null },
    ];
    expect(assemblePredictFormula("V", entries)).toBe("$V = 1$");
  });

  it("joins LaTeX factors with a single space (no \\rhoL mis-parse)", () => {
    const entries: PredictEntry[] = [
      { factor: "I", role: "numerator" },
      { factor: "\\rho", role: "numerator" },
      { factor: "L", role: "numerator" },
    ];
    expect(assemblePredictFormula("V", entries)).toBe("$V = I \\rho L$");
  });

  it("renders fixed constants regardless of student choices (E_n case)", () => {
    const entries: PredictEntry[] = [
      { factor: "n^2", role: "numerator" },
      { factor: "m", role: "denominator" },
      { factor: "L^2", role: "denominator" },
    ];
    const s = assemblePredictFormula("E_n", entries, {
      numerator: ["\\pi^2", "\\hbar^2"],
      denominator: ["2"],
    });
    // Assert via the per-side commutative canonicalizer, not exact string.
    expect(
      canonicalFormulaEquals(
        canonicalPredictFormula(s),
        canonicalPredictFormula("$E_n = \\frac{n^2\\pi^2\\hbar^2}{2mL^2}$")
      )
    ).toBe(true);
  });
});

describe("roleForChoice", () => {
  it("maps up → numerator, down → denominator, none → null", () => {
    expect(roleForChoice("up")).toBe("numerator");
    expect(roleForChoice("down")).toBe("denominator");
    expect(roleForChoice("none")).toBeNull();
  });
});

describe("canonicalPredictFormula — order invariance", () => {
  it("treats numerator factor order as irrelevant", () => {
    expect(
      canonicalFormulaEquals(
        canonicalPredictFormula("$V = \\frac{I \\rho L}{A}$"),
        canonicalPredictFormula("$V = \\frac{\\rho L I}{A}$")
      )
    ).toBe(true);
  });

  it("normalizes spacing and ^{x} brace variants (E_n)", () => {
    const unspaced = canonicalPredictFormula("E_n=\\frac{n^2\\pi^2\\hbar^2}{2mL^2}");
    const spaced = canonicalPredictFormula("$E_n = \\frac{n^2 \\pi^2 \\hbar^2}{2 m L^2}$");
    const braced = canonicalPredictFormula("$E_n = \\frac{n^{2} \\pi^{2} \\hbar^{2}}{2 m L^{2}}$");
    expect(canonicalFormulaEquals(unspaced, spaced)).toBe(true);
    expect(canonicalFormulaEquals(spaced, braced)).toBe(true);
  });

  it("treats multi-digit constants as whole tokens (12 != 21)", () => {
    // A multi-digit number must tokenize as ONE factor, not split into
    // commutative single digits — otherwise "12" and "21" would both sort to
    // ["1","2"] and compare equal, shipping a wrong "Correct form".
    expect(
      canonicalFormulaEquals(
        canonicalPredictFormula("$x = 12$"),
        canonicalPredictFormula("$x = 21$")
      )
    ).toBe(false);
  });

  it("keeps a multi-digit power as a single factor (L^{10})", () => {
    const braced = canonicalPredictFormula("$y = L^{10}$");
    const unspaced = canonicalPredictFormula("$y = L^10$");
    expect(braced.numFactors).toEqual(["L^10"]);
    expect(canonicalFormulaEquals(braced, unspaced)).toBe(true);
  });

  it("differing factor SETS are not equal", () => {
    expect(
      canonicalFormulaEquals(
        canonicalPredictFormula("$V = \\frac{I \\rho L}{A}$"),
        canonicalPredictFormula("$V = \\frac{I \\rho L A}{A}$")
      )
    ).toBe(false);
  });
});

describe("canonicalPredictFormula — rejects non-monomial-ratios", () => {
  it("throws on an additive right-hand side", () => {
    expect(() => canonicalPredictFormula("$T = x + y$")).toThrow();
  });

  it("throws on more than one '='", () => {
    expect(() => canonicalPredictFormula("$a = b = c$")).toThrow();
  });

  it("throws on a missing '='", () => {
    expect(() => canonicalPredictFormula("$x y$")).toThrow();
  });

  it("an additive form is never equal to a monomial product form", () => {
    // $T = x + y$ throws, so a product form can never be canonically confused
    // with it; guard the throw explicitly.
    expect(() => canonicalPredictFormula("$T = x + y$")).toThrow();
    const product = canonicalPredictFormula("$T = x y$");
    expect(product.numFactors).toEqual(["x", "y"]);
  });

  // Calculus operators (derivatives, differentials, integrals) are rates/limits,
  // not products/quotients of powers of free quantities — they must never be
  // accepted as monomial ratios. Regression: the displacement current
  // $I_d = \varepsilon_0 \frac{d\Phi_E}{dt}$ was surfacing a hard
  // "Generation failed" because the model chose a predict contract for it.
  it("throws on the displacement-current derivative form (reported bug)", () => {
    expect(() =>
      canonicalPredictFormula("$I_d = \\varepsilon_0 \\frac{d\\Phi_E}{dt}$")
    ).toThrow(/monomial ratio/);
  });

  it("throws on a bare Leibniz derivative d.../d... that would otherwise mis-tokenize", () => {
    // Without an explicit guard this parses as [d,p]/[d,t], silently grading the
    // differential `d` as a physical variable — assert it throws instead.
    expect(() => canonicalPredictFormula("$F = \\frac{dp}{dt}$")).toThrow(
      /derivative/
    );
  });

  it("throws on a SPACED Leibniz derivative d p / d t", () => {
    expect(() => canonicalPredictFormula("$F = \\frac{d p}{d t}$")).toThrow(
      /derivative/
    );
  });

  it("throws on a higher-order derivative d^2x / dt^2 (and braced order)", () => {
    expect(() => canonicalPredictFormula("$a = \\frac{d^2x}{dt^2}$")).toThrow(
      /derivative/
    );
    expect(() =>
      canonicalPredictFormula("$a = \\frac{d^{2}x}{dt^{2}}$")
    ).toThrow(/derivative/);
  });

  it("throws on the bare derivative operator d / dt", () => {
    expect(() => canonicalPredictFormula("$x = \\frac{d}{dt}$")).toThrow(
      /derivative/
    );
  });

  it("throws on an integral right-hand side", () => {
    expect(() => canonicalPredictFormula("$W = \\int F dx$")).toThrow(
      /calculus operator/
    );
  });

  it("throws on a gradient (\\nabla) right-hand side", () => {
    expect(() => canonicalPredictFormula("$E = -\\nabla V$")).toThrow(
      /calculus operator/
    );
  });

  it("accepts subscripted physical symbols as single factors (reported bug: \\varepsilon_0)", () => {
    // $I_d = \frac{I A}{\varepsilon_0}$ is a legitimate monomial ratio; the
    // subscript in vacuum permittivity must NOT be read as an operator.
    const r = canonicalPredictFormula("$I_d = \\frac{I A}{\\varepsilon_0}$");
    expect(r.numFactors).toEqual(["A", "I"]);
    expect(r.denFactors).toEqual(["\\varepsilon_0"]);
  });

  it("accepts multi-character and command subscripts (k_B, v_{rms}, \\mu_0)", () => {
    expect(canonicalPredictFormula("$p = k_B T$").numFactors).toEqual([
      "T",
      "k_B",
    ]);
    expect(canonicalPredictFormula("$v = v_{rms}$").numFactors).toEqual([
      "v_rms",
    ]);
    const f = canonicalPredictFormula("$B = \\frac{\\mu_0 I}{r}$");
    expect(f.numFactors).toEqual(["I", "\\mu_0"]);
    expect(f.denFactors).toEqual(["r"]);
  });

  it("accepts sub+superscript in EITHER order (v_{rms}^2, x^2_0)", () => {
    expect(canonicalPredictFormula("$y = v_{rms}^2$").numFactors).toEqual([
      "v_rms^2",
    ]);
    expect(canonicalPredictFormula("$y = x^2_0$").numFactors).toEqual([
      "x^2_0",
    ]);
  });

  it("keeps subscripted symbols DISTINCT (x_1 != x_2)", () => {
    const a = canonicalPredictFormula("$y = \\frac{x_1}{x_2}$");
    const b = canonicalPredictFormula("$y = \\frac{x_2}{x_1}$");
    expect(canonicalFormulaEquals(a, b)).toBe(false);
    // and x_1 x_2 must not collapse to x_1 x_1
    const c = canonicalPredictFormula("$y = x_1 x_2$");
    const d = canonicalPredictFormula("$y = x_1 x_1$");
    expect(canonicalFormulaEquals(c, d)).toBe(false);
  });

  it("strips typographic command wrappers in subscripts (m_{\\mathrm{e}}, R_{\\mathrm{eq}})", () => {
    // Electron mass and equivalent resistance in conventional physics
    // typography must canonicalize to the same token as their plain forms.
    const a = canonicalPredictFormula("$p = m_{\\mathrm{e}} v$");
    expect(a.numFactors).toEqual(["m_e", "v"]);
    expect(
      canonicalFormulaEquals(a, canonicalPredictFormula("$p = m_e v$"))
    ).toBe(true);
    expect(
      canonicalPredictFormula("$V = I R_{\\mathrm{eq}}$").numFactors
    ).toEqual(["I", "R_eq"]);
  });

  it("does NOT flatten an embedded-script subscript into a squared symbol (false-equivalence guard)", () => {
    // v_{rms^2} (the ^2 lives INSIDE the subscript) is a different LaTeX
    // structure from v_{rms}^2 (the whole symbol squared) and must not be
    // silently canonicalized to the same token.
    expect(() => canonicalPredictFormula("$y = v_{rms^2}$")).toThrow();
    expect(canonicalPredictFormula("$y = v_{rms}^2$").numFactors).toEqual([
      "v_rms^2",
    ]);
  });

  it("strips vector/accent decorations (\\vec{E}, \\hat{n}, \\dot{x}) — identity-preserving", () => {
    // Vector/accent notation is pervasive in E&M/mechanics answers and must not
    // crash a valid monomial ratio; the decoration does not change identity.
    const a = canonicalPredictFormula("$F = q \\vec{E}$");
    expect(a.numFactors).toEqual(["E", "q"]);
    expect(
      canonicalFormulaEquals(a, canonicalPredictFormula("$F = q E$"))
    ).toBe(true);
    expect(canonicalPredictFormula("$p = m \\vec{v}$").numFactors).toEqual([
      "m",
      "v",
    ]);
    // decoration + subscript combine correctly
    expect(canonicalPredictFormula("$F = q \\vec{E}_0$").numFactors).toEqual([
      "E_0",
      "q",
    ]);
  });

  it("accepts and normalizes prime notation (v', v^{\\prime})", () => {
    expect(canonicalPredictFormula("$u = v'$").numFactors).toEqual(["v'"]);
    expect(
      canonicalFormulaEquals(
        canonicalPredictFormula("$u = v'$"),
        canonicalPredictFormula("$u = v^{\\prime}$")
      )
    ).toBe(true);
  });

  it("a ratio of two subscripted distances d_1/d_2 parses (not treated as a derivative)", () => {
    const r = canonicalPredictFormula("$R = \\frac{d_1}{d_2}$");
    expect(r.numFactors).toEqual(["d_1"]);
    expect(r.denFactors).toEqual(["d_2"]);
  });

  it("still accepts a genuine monomial ratio that merely contains the letter d", () => {
    // A real variable named `d` (e.g. distance/separation) must NOT be
    // false-rejected — only the derivative d.../d... shape and calculus
    // operators are excluded.
    const r = canonicalPredictFormula("$E = \\frac{q}{d}$");
    expect(r.numFactors).toEqual(["q"]);
    expect(r.denFactors).toEqual(["d"]);
  });
});
