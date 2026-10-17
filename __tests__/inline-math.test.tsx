import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SolutionView from "@/components/SolutionView";
import MathText from "@/components/MathText";
import { renderSolutionPdf } from "@/lib/solution-pdf";
import type { SolveSolution } from "@/lib/solve-types";
import { pdfCurveCount, pdfText } from "./helpers/pdf-text";

vi.mock("next/navigation", () => ({ usePathname: () => "/solve" }));

/** Prose exactly as the model emits it: `\( \)` delimiters, `$ $` delimiters, and bare commands. */
const solution: SolveSolution = {
  title: "Shell burst over the bunker",
  tags: ["Mechanics"],
  problem_statement: "A shell is fired with speed \\(u\\) at angle \\( \\theta \\) and explodes after time \\( T \\).",
  problem_options: ["A. $\\theta = 30^\\circ$", "B. \\(\\theta = 45^\\circ\\)"],
  framing_line: "Minimise the squared distance $D^2$ with respect to \\theta.",
  step1: {
    answer: "Projectile motion with constant acceleration \\(g\\) governs the shell until it explodes.",
    explanation: "Horizontal velocity \\( u\\cos\\theta \\) is constant while the vertical velocity changes at rate $g$.",
    tip: { text: "Keep \\( \\phi \\) and \\theta separate.", priority: "high" },
    warning: { text: "Do not confuse \\(d\\) with \\( D \\).", priority: "high" },
  },
  step2: { answer: "Given \\(u\\), \\(T\\), \\(d\\), and \\( \\phi \\).", explanation: "", tip: null, warning: null },
  step3: { answer: "Write \\(D^2(\\theta)\\) and set \\( \\frac{dD^2}{d\\theta} = 0 \\).", explanation: "", tip: null, warning: null },
  derivation: {
    blocks: [
      { type: "subsection", title: "Position at time \\(T\\)" },
      { type: "prose", text: "The horizontal distance is \\( x = uT\\cos\\theta \\) and the height is $y = uT\\sin\\theta - \\tfrac{1}{2}gT^2$." },
      { type: "equation", latex: "x = uT\\cos\\theta", annotation: "horizontal reach in time \\(T\\)" },
    ],
  },
  final_answer: { latex: "\\tan\\theta = \\tan\\phi + \\frac{gT^2}{2d}", display: "tan \\(\\theta\\) equals tan \\(\\phi\\) plus $gT^2/2d$", option: "" },
  reality_checks: [{ heading: "Units", title: "", text: "Both sides of \\( \\tan\\theta = \\tan\\phi + \\frac{gT^2}{2d} \\) are dimensionless.", priority: "high" }],
  common_errors: [{ heading: "Sign of \\(g\\)", title: "", text: "Taking \\(g\\) as negative in \\( y = uT\\sin\\theta - \\tfrac{1}{2}gT^2 \\).", priority: "high" }],
  takeaways: [{ heading: "Extremise first", title: "", text: "Differentiate $D^2$, not \\(D\\), to avoid square roots.", priority: "high" }],
};

const literalDelimiters = /\\\(|\\\)|\\\[|\\\]|\$/;
const literalCommands = /\\(theta|phi|cos|sin|frac|tfrac|tan|circ)\b/;

describe("inline math in prose", () => {
  it("renders \\( \\), $ $, and bare commands as KaTeX instead of literal text", () => {
    const html = renderToStaticMarkup(createElement(MathText, { text: "speed \\(u\\) at angle \\( \\theta \\) and $\\phi$ with \\psi" }));
    expect(html).not.toMatch(literalDelimiters);
    expect(html).not.toMatch(/\\theta|\\phi|\\psi/);
    expect(html).toContain("speed ");
    expect(html).toContain(" at angle ");
    expect((html.match(/class="katex"/g) ?? []).length).toBe(4);
    expect(html).toContain("θ");
    expect(html).toMatch(/[φϕ]/);
    expect(html).toContain("ψ");
  });

  it("keeps the gamified play feature's $ $ rendering unchanged", () => {
    const html = renderToStaticMarkup(createElement(MathText, { text: "Energy $E = mc^2$ and $$F = ma$$" }));
    expect(html).toContain("Energy ");
    expect((html.match(/class="katex"/g) ?? []).length).toBe(2);
    expect(html).toContain("katex-display");
  });

  it("shows no raw LaTeX anywhere in the Long or Short web view", () => {
    for (const format of ["long", "short"] as const) {
      const html = renderToStaticMarkup(createElement(SolutionView, { solution, initialFormat: format }));
      const visible = html.replace(/<[^>]+>/g, "");
      expect(visible).not.toMatch(literalDelimiters);
      expect(visible).not.toMatch(literalCommands);
      expect(html).toContain("speed ");
      expect(html).toContain(" and explodes after time ");
      expect(visible).toContain("θ");
    }
    const long = renderToStaticMarkup(createElement(SolutionView, { solution, initialFormat: "long" }));
    for (const fragment of ["Keep ", "Do not confuse ", "Position at time ", "Units", "Sign of ", "Both sides of ", "Extremise first", "tan ", " equals tan "]) {
      expect(long).toContain(fragment);
    }
  });

  it("prints no raw LaTeX in the Long or Short PDF and draws the math as vector glyphs", async () => {
    for (const format of ["long", "short"] as const) {
      const pdf = await renderSolutionPdf(solution, format);
      const text = pdfText(pdf);
      expect(text).not.toMatch(literalDelimiters);
      expect(text).not.toMatch(literalCommands);
      expect(text).toContain("A shell is fired with speed");
      expect(text).toContain("and explodes after time");
      expect(pdfCurveCount(pdf)).toBeGreaterThan(50);
    }
    const long = pdfText(await renderSolutionPdf(solution, "long"));
    for (const fragment of ["Keep", "and", "separate.", "Do not confuse", "Position at time", "Units", "Both sides of", "Extremise first", "Differentiate", "SHELL BURST OVER THE BUNKER"]) {
      expect(long).toContain(fragment);
    }
  });
});
