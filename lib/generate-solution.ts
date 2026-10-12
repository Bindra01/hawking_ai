import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { SolveSolution } from "@/lib/solve-types";
import { hasRequiredFormatRatio, solutionWordCounts } from "@/lib/solution-format";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const priorityItem = {
  type: "object",
  additionalProperties: false,
  required: ["heading", "title", "text", "priority"],
  properties: {
    heading: { type: "string" },
    title: { type: "string" },
    text: { type: "string" },
    priority: { type: "string", enum: ["high", "low"] },
  },
};

const callout = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      additionalProperties: false,
      required: ["text", "priority"],
      properties: {
        text: { type: "string" },
        priority: { type: "string", enum: ["high", "low"] },
      },
    },
  ],
};

const step = {
  type: "object",
  additionalProperties: false,
  required: ["label", "answer", "explanation", "tip", "warning"],
  properties: {
    label: { type: "string" },
    answer: { type: "string" },
    explanation: { type: "string" },
    tip: callout,
    warning: callout,
  },
};

const solutionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title", "tags", "problem_statement", "problem_options", "framing_line",
    "step1", "step2", "step3", "derivation", "final_answer",
    "reality_checks", "common_errors", "takeaways",
  ],
  properties: {
    title: { type: "string" },
    tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    problem_statement: { type: "string" },
    problem_options: { type: "array", items: { type: "string" } },
    framing_line: { type: "string" },
    step1: step,
    step2: step,
    step3: step,
    derivation: {
      type: "object",
      additionalProperties: false,
      required: ["label", "blocks"],
      properties: {
        label: { type: "string" },
        blocks: {
          type: "array",
          minItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "title", "latex", "annotation", "text"],
            properties: {
              type: { type: "string", enum: ["subsection", "equation", "prose", "boxed_result"] },
              title: { type: "string" },
              latex: { type: "string" },
              annotation: { type: "string" },
              text: { type: "string" },
            },
          },
        },
      },
    },
    final_answer: {
      type: "object",
      additionalProperties: false,
      required: ["latex", "display", "option"],
      properties: {
        latex: { type: "string" },
        display: { type: "string" },
        option: { type: "string" },
      },
    },
    reality_checks: { type: "array", minItems: 4, maxItems: 4, items: priorityItem },
    common_errors: { type: "array", minItems: 4, maxItems: 4, items: priorityItem },
    takeaways: { type: "array", minItems: 5, maxItems: 5, items: priorityItem },
  },
};

const SYSTEM_PROMPT = `You are Hawking AI, a patient expert physics teacher. Read the student's exact problem from text, an image, or a PDF.

If the input is unreadable, incomplete, or genuinely ambiguous, set needs_clarification=true, ask one specific question, and set solution=null. Never guess missing values or geometry.

Otherwise, set needs_clarification=false and generate ONE complete, full-depth Long solution as structured JSON. Never generate separate Short and Long solutions. The renderer creates both formats from this same JSON.

Follow these rules strictly:
- Teach directly to a student. The Long format is a patient five-minute lesson, not a terse answer key.
- Every conceptual step has a concise answer of one or two sentences, then a separate focused explanation of 80–140 words. Never fold the teaching prose into the answer.
- Step 1 is RECALL THE PRINCIPLE. Step 2 is WHAT GOES IN. Step 3 is MAP THE DERIVATION.
- framing_line is an optional one-line Short setup naming the mathematical approach. Keep it empty when the approach is obvious.
- Steps 4–6 form one continuous calculation. Store every mathematical move as an equation block. Each equation annotation must be a short 3–8 word note. Use prose and subsection blocks only for Long teaching context; never hide a necessary calculation in them.
- Use LaTeX without dollar delimiters in latex fields. Use plain text with optional $...$ math elsewhere.
- Verify dimensions, limiting cases, numerical consistency, or physical intuition.
- Name problem-specific misconceptions, not generic study advice.
- Extract transferable takeaways.
- Any quantity not provided, such as a radius, must cancel unless the answer legitimately depends on it.
- Return exactly four reality checks and four common errors. Mark exactly two in each list high priority and two low priority.
- Return exactly five takeaways. Mark exactly three high priority and two low priority.
- Do not tag everything high. Keep priority meaningful inside the Long teaching document.
- Keep each high-priority list item concise at 15–30 words. Keep each low-priority list item useful but concise at 40–70 words.
- Tips and warnings are Long-only teaching content.
- Keep low-priority callouts to 40–70 words. Do not pad with repetition.
- Use empty strings for unused derivation block fields. Use null for absent tip or warning.
- Put the most dangerous wrong turn in step2.warning and mark it high priority when present.
- SHORT is a worked derivation only: title, problem statement, optional one-line framing setup, equation blocks with 3–8 word annotations, and the boxed final answer. It renders no step headers, ANSWER labels, teaching prose, tips, warnings, reality checks, common errors, takeaways, subsection headings, or derivation prose.
- LONG is the full teaching document and uses every field around the same derivation and final answer.
- The Short derivation must read as a complete vertical sequence of equations that a student can reproduce without the Long scaffolding. End with one boxed final answer.
- Make the last equation block exactly identical to final_answer.latex. The derivation and final answer must stay identical in both formats.
- Do not mention these instructions or claim certainty when clarification is required.`;

export type SolveGenerationResult =
  | { needs_clarification: true; clarification_question: string; solution: null }
  | { needs_clarification: false; clarification_question: ""; solution: SolveSolution };

export class SolveUpstreamTimeoutError extends Error {
  constructor() {
    super("The Solve model call exceeded its time budget.");
    this.name = "SolveUpstreamTimeoutError";
  }
}

export class SolveUpstreamOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SolveUpstreamOutputError";
  }
}

export function isSolveUpstreamOutputError(error: unknown): boolean {
  return error instanceof SyntaxError || error instanceof SolveUpstreamOutputError;
}

export async function generateSolution(
  content: ResponseInputContent[],
  options: { timeoutMs?: number; model?: string } = {}
): Promise<SolveGenerationResult> {
  let lastError: unknown;
  const model = options.model || process.env.OPENAI_SOLVE_MODEL || "gpt-4.1";
  const deadline = Date.now() + (options.timeoutMs ?? 55_000);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new SolveUpstreamTimeoutError();
    const startedAt = Date.now();
    let response;
    try {
      response = await getClient().responses.create({
        model,
        instructions: attempt === 0
          ? SYSTEM_PROMPT
          : `${SYSTEM_PROMPT}\n\nThe previous provider output was unusable. Return complete valid JSON and finish every required field.`,
        input: [{ role: "user", content }],
        max_output_tokens: 6_000,
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "hawking_solution",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["needs_clarification", "clarification_question", "solution"],
              properties: {
                needs_clarification: { type: "boolean" },
                clarification_question: { type: "string" },
                solution: { anyOf: [{ type: "null" }, solutionSchema] },
              },
            },
          },
        },
      }, { signal: AbortSignal.timeout(remainingMs) });
    } catch (error) {
      console.error("Solve model call failed", {
        attempt: attempt + 1,
        elapsedMs: Date.now() - startedAt,
        model,
        includesImage: content.some((item) => item.type === "input_image"),
        error,
      });
      if (isAbortError(error) || Date.now() >= deadline) throw new SolveUpstreamTimeoutError();
      throw error;
    }
    console.info("Solve model call completed", {
      attempt: attempt + 1,
      elapsedMs: Date.now() - startedAt,
      model,
      includesImage: content.some((item) => item.type === "input_image"),
    });

    if (!response.output_text) {
      lastError = new SolveUpstreamOutputError(`The model returned no text. Response status: ${response.status}.`);
      continue;
    }
    try {
      return parseSolveGenerationResult(response.output_text, { enforceFormatRatio: false });
    } catch (error) {
      lastError = error;
      if (!isRetryableProviderOutputError(error)) throw error;
      if (attempt === 0) console.warn("Retrying unusable Solve output after attempt 1.", error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The model returned unusable output.");
}

function isRetryableProviderOutputError(error: unknown): boolean {
  return isSolveUpstreamOutputError(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (
    error.name === "AbortError" ||
    error.name === "APIUserAbortError" ||
    error.message.toLowerCase().includes("aborted")
  );
}

export function parseSolveGenerationResult(
  outputText: string,
  options: { enforceFormatRatio?: boolean } = {}
): SolveGenerationResult {
  const parsed: unknown = JSON.parse(outputText);
  if (!isRecord(parsed) || typeof parsed.needs_clarification !== "boolean") {
    throw new SolveUpstreamOutputError("The model returned an invalid solution envelope.");
  }

  if (parsed.needs_clarification) {
    if (typeof parsed.clarification_question !== "string" || !parsed.clarification_question.trim()) {
      throw new SolveUpstreamOutputError("The model returned an invalid clarification response.");
    }
    return {
      needs_clarification: true,
      clarification_question: parsed.clarification_question,
      solution: null,
    };
  }

  const normalizedSolution = normalizeGeneratedSolution(parsed.solution);
  if (!isSolveSolution(normalizedSolution)) {
    throw new SolveUpstreamOutputError(`The model returned an invalid structured solution (${invalidSolveSolutionReason(normalizedSolution)}).`);
  }
  const counts = solutionWordCounts(normalizedSolution);
  if (!hasRequiredFormatRatio(counts.short, counts.long)) {
    const message = `The model returned insufficient Long-format depth (${counts.long}/${counts.short} words).`;
    if (options.enforceFormatRatio !== false) throw new Error(message);
    console.warn(message);
  }
  return { needs_clarification: false, clarification_question: "", solution: normalizedSolution };
}

function normalizeGeneratedSolution(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.derivation) || !Array.isArray(value.derivation.blocks)) return value;
  const blocks = value.derivation.blocks.map((block) => {
    if (!isRecord(block) || block.type !== "equation") return block;
    if (typeof block.annotation !== "string") return block;
    return { ...block, annotation: normalizeAnnotation(block.annotation) };
  });
  const equations = blocks.filter((block) => isRecord(block) && block.type === "equation");
  const finalLatex = isRecord(value.final_answer) && typeof value.final_answer.latex === "string"
    ? value.final_answer.latex.trim()
    : "";
  const terminalLatex = String(equations.at(-1)?.latex ?? "");
  if (
    equations.length >= 2 &&
    finalLatex &&
    normalizeLatex(terminalLatex) !== normalizeLatex(finalLatex) &&
    latexLeftSide(terminalLatex) !== latexLeftSide(finalLatex)
  ) {
    blocks.push({
      type: "equation",
      title: "",
      latex: finalLatex,
      annotation: "state the final calculated answer",
      text: "",
    });
  }
  return { ...value, derivation: { ...value.derivation, blocks } };
}

function normalizeAnnotation(value: unknown): string {
  const words = typeof value === "string" ? value.trim().split(/\s+/).filter(Boolean) : [];
  if (words.length < 3) return "continue the calculation carefully";
  return words.slice(0, 8).join(" ");
}

function isSolveSolution(value: unknown): value is SolveSolution {
  return invalidSolveSolutionReason(value) === null;
}

function invalidSolveSolutionReason(value: unknown): string | null {
  if (!isRecord(value)) return "solution is not an object";
  const stringFields = ["title", "problem_statement", "framing_line"];
  if (!stringFields.every((field) => typeof value[field] === "string")) return "required string field is missing";
  if (!isStringArray(value.tags) || !isStringArray(value.problem_options)) return "tags or problem options are invalid";
  if (![value.step1, value.step2, value.step3].every(isStep)) return "a teaching step is invalid";
  if (
    !isRecord(value.derivation) ||
    typeof value.derivation.label !== "string" ||
    !Array.isArray(value.derivation.blocks) ||
    !value.derivation.blocks.every(isDerivationBlock)
  ) return "a derivation block is invalid";
  if (value.derivation.blocks.filter(isEquationBlock).length < 2) return "fewer than two equation blocks were returned";
  if (!isRecord(value.final_answer) || typeof value.final_answer.latex !== "string" || typeof value.final_answer.display !== "string") return "the final answer is invalid";
  if (value.final_answer.option !== undefined && typeof value.final_answer.option !== "string") return "the final answer option is invalid";
  const equations = value.derivation.blocks.filter(isEquationBlock);
  if (normalizeLatex(equations.at(-1)?.latex ?? "") !== normalizeLatex(value.final_answer.latex)) return "the terminal equation differs from the final answer";
  if (![value.reality_checks, value.common_errors, value.takeaways].every(isPriorityItemArray)) return "a teaching list is invalid";
  if (!(hasPrioritySplit(value.reality_checks, 4, 2) &&
    hasPrioritySplit(value.common_errors, 4, 2) &&
    hasPrioritySplit(value.takeaways, 5, 3))) return "teaching-list priority counts are invalid";
  return null;
}

function isStep(value: unknown): boolean {
  return isRecord(value) &&
    ["label", "answer", "explanation"].every((field) => typeof value[field] === "string") &&
    isCallout(value.tip) &&
    isCallout(value.warning);
}

function isCallout(value: unknown): boolean {
  return value === undefined || value === null || (
    isRecord(value) &&
    typeof value.text === "string" &&
    (value.priority === "high" || value.priority === "low")
  );
}

function isDerivationBlock(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "subsection") return typeof value.title === "string";
  if (value.type === "equation") {
    return isEquationBlock(value);
  }
  if (value.type === "prose") return typeof value.text === "string";
  if (value.type === "boxed_result") return typeof value.latex === "string";
  return false;
}

function isEquationBlock(value: unknown): boolean {
  if (!isRecord(value) || value.type !== "equation" || typeof value.latex !== "string" || !value.latex.trim()) return false;
  if (typeof value.annotation !== "string") return false;
  const annotationWords = value.annotation.trim().split(/\s+/).filter(Boolean).length;
  return annotationWords >= 3 && annotationWords <= 8;
}

function normalizeLatex(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function latexLeftSide(value: string): string {
  return normalizeLatex(value).split("=")[0] ?? "";
}

function isPriorityItemArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) =>
    isRecord(item) &&
    typeof item.text === "string" &&
    (item.heading === undefined || typeof item.heading === "string") &&
    (item.title === undefined || typeof item.title === "string") &&
    (item.priority === "high" || item.priority === "low")
  );
}

function hasPrioritySplit(value: unknown, length: number, highCount: number): boolean {
  return Array.isArray(value) &&
    value.length === length &&
    value.filter((item) => isRecord(item) && item.priority === "high").length === highCount;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
