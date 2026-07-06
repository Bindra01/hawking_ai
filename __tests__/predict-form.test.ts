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
});
