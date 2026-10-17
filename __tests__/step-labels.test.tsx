import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SolutionView from "@/components/SolutionView";
import { renderSolutionPdf } from "@/lib/solution-pdf";
import { STEP_LABELS, type SolveSolution } from "@/lib/solve-types";
import { pdfText } from "./helpers/pdf-text";

vi.mock("next/navigation", () => ({ usePathname: () => "/solve" }));

const item = (text: string, priority: "high" | "low") => ({ heading: text, title: text, text, priority });

/** Free-text titles the model used to invent. They must never reach the page or the PDF. */
const inventedLabels = {
  step1: "Recall the principle of projectile motion and explosion timing",
  step2: "Substitute given parameters and express distance to bunker",
  step3: "Find angle θ that minimizes the squared distance D²",
  derivation: "Derive the optimal launch angle",
};

function solutionFor(topic: string): SolveSolution {
  // Legacy saved solutions may still carry `label` keys; renderers must ignore them.
  const legacy = (label: string, answer: string) => ({ label, answer, explanation: `${topic} explanation.`, tip: null, warning: null });
  return {
    title: `${topic} problem`,
    tags: ["Mechanics"],
    problem_statement: `A ${topic} question.`,
    problem_options: [],
    framing_line: `Set up the ${topic}.`,
    step1: legacy(inventedLabels.step1, `${topic} law`),
    step2: legacy(inventedLabels.step2, `${topic} inputs`),
    step3: legacy(inventedLabels.step3, `${topic} plan`),
    derivation: {
      label: inventedLabels.derivation,
      blocks: [{ type: "equation", latex: "F=ma", annotation: `apply to ${topic}` }],
    },
    final_answer: { latex: "v=20", display: "20 m/s", option: "" },
    reality_checks: [item("R1", "high")],
    common_errors: [item("E1", "high")],
    takeaways: [item("T1", "high")],
  } as SolveSolution;
}

function stepHeadings(html: string): string[] {
  return [...html.matchAll(/<div class="step-heading">.*?<h2[^>]*>(.*?)<\/h2>/g)].map((match) => match[1]);
}

describe("fixed step labels", () => {
  it("is the closed set of Hawking labels", () => {
    expect(STEP_LABELS).toEqual({
      step1: "RECALL THE PRINCIPLE",
      step2: "WHAT GOES IN",
      step3: "MAP THE DERIVATION",
      derivation: "SET UP · DERIVE · ASSEMBLE",
    });
  });

  it("contains no problem-specific words", () => {
    const forbidden = /projectile|angle|bunker|distance|parameters|θ|D²|substitute|minimi|explosion/i;
    for (const label of Object.values(STEP_LABELS)) {
      expect(label).not.toMatch(forbidden);
      expect(label).toMatch(/^[A-Z ·]+$/);
    }
  });

  it("renders the same labels on the web for every problem and ignores invented titles", () => {
    const expected = [STEP_LABELS.step1, STEP_LABELS.step2, STEP_LABELS.step3, STEP_LABELS.derivation];
    const pages = ["projectile", "capacitor"].map((topic) =>
      renderToStaticMarkup(createElement(SolutionView, { solution: solutionFor(topic), initialFormat: "long" })),
    );

    for (const html of pages) {
      expect(stepHeadings(html)).toEqual(expected);
      expect(html).toContain("STEP 1");
      expect(html).toContain("STEP 2");
      expect(html).toContain("STEP 3");
      expect(html).toContain("STEPS 4→6");
      for (const invented of Object.values(inventedLabels)) {
        expect(html).not.toContain(invented);
      }
    }
  });

  it("renders no step labels in the Short format", () => {
    const html = renderToStaticMarkup(createElement(SolutionView, { solution: solutionFor("projectile"), initialFormat: "short" }));
    expect(stepHeadings(html)).toEqual([]);
    for (const label of Object.values(STEP_LABELS)) {
      expect(html).not.toContain(label);
    }
  });

  it("prints the fixed labels in the Long PDF and none in the Short PDF", async () => {
    const long = pdfText(await renderSolutionPdf(solutionFor("projectile"), "long"));
    for (const label of Object.values(STEP_LABELS)) {
      expect(long).toContain(label);
    }
    for (const invented of Object.values(inventedLabels)) {
      expect(long).not.toContain(invented);
    }

    const short = pdfText(await renderSolutionPdf(solutionFor("projectile"), "short"));
    for (const label of Object.values(STEP_LABELS)) {
      expect(short).not.toContain(label);
    }
  });
});
