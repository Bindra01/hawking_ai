import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming, ResponseInputContent } from "openai/resources/responses/responses";
import type { SolveSolution } from "@/lib/solve-types";
import { cleanLatexSource, hasRequiredFormatRatio, isLatexSource, solutionWordCounts } from "@/lib/solution-format";

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
  required: ["answer", "explanation", "tip", "warning"],
  properties: {
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
      required: ["blocks"],
      properties: {
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

/** Accuracy rules from docs/specs/HAWKING-SOLUTION-PROMPT-ACCURACY.md, kept verbatim. */
export const ACCURACY_REQUIREMENTS = `====================================================
ACCURACY REQUIREMENTS — follow all of these strictly
====================================================

RULE 1 — DERIVE BEFORE WRITING.
Before generating any JSON or structured output, work through the
problem completely in your internal reasoning. Identify the principle,
set up the equations, carry out the algebra, and reach the final
numerical answer. Only then write the structured solution. Never
generate the JSON structure and fill in the physics simultaneously —
this causes errors that cascade through the entire solution because
you are solving and formatting at the same time.

RULE 2 — VERIFY THE ANSWER BEFORE WRITING IT.
After reaching a numerical result, run at least two of these checks
before writing the output:
  - DIMENSIONS: do the units of the answer match what was asked for?
  - LIMITING CASES: what happens when a parameter → 0 or → ∞?
    Does the answer behave as physics demands?
  - SIGN: is the sign of the result physically reasonable?
  - MAGNITUDE: is the number in the right ballpark for this type
    of problem?
If any check fails, find the error and fix it before writing anything.
A wrong answer presented confidently is worse than no answer.

RULE 3 — NEVER GUESS A FORMULA.
If you are not certain of a formula or derivation step, do not proceed
and fill in a plausible-looking result. Instead, flag the uncertainty
explicitly. An honest flag is far less damaging than a confident error
that a student trusts and learns from.

RULE 4 — VERIFY ALGEBRA LINE BY LINE.
After each line of algebra, confirm that it follows from the previous
line. Do not skip steps. A skipped step that "looks right" is the most
common source of physics solution errors.

RULE 5 — CONVERT TO SI UNITS AT THE START.
Convert all given quantities to SI units before writing the first
equation. Do not mix cm with m, eV with J, or g with kg mid-calculation.
State the converted values explicitly so errors are visible.

RULE 6 — USE THESE EXACT PHYSICAL CONSTANTS.
Do not use approximate or remembered values. Use these:
  h  = 6.626 × 10⁻³⁴ J·s      (Planck's constant)
  c  = 3.0   × 10⁸  m/s        (speed of light)
  e  = 1.602 × 10⁻¹⁹ C         (electron charge)
  g  = 10 m/s² unless specified  (use 9.8 if problem states it)
  ε₀ = 8.85  × 10⁻¹² F/m       (permittivity of free space)
  k  = 9.0   × 10⁹  N·m²/C²    (Coulomb's constant = 1/4πε₀)
  mₑ = 9.11  × 10⁻³¹ kg        (electron mass)
  mₚ = 1.67  × 10⁻²⁷ kg        (proton mass)
  Nₐ = 6.022 × 10²³ mol⁻¹      (Avogadro's number)
  R  = 8.314 J/(mol·K)          (universal gas constant)
  kB = 1.38  × 10⁻²³ J/K       (Boltzmann's constant)
  σ  = 5.67  × 10⁻⁸ W/(m²·K⁴) (Stefan–Boltzmann constant)
====================================================`;

/** The physics call answers with this prefix instead of a solution when the problem cannot be solved as given. */
export const CLARIFICATION_SENTINEL = "CLARIFICATION NEEDED:";

/** Call 1: solve the physics in plain text. No JSON, no Hawking formatting. */
export const PHYSICS_PROMPT = `${ACCURACY_REQUIREMENTS}

You are an expert physics problem solver. Your only job in this call
is to solve the problem completely and correctly.

Work through the problem step by step:
1. Identify the governing principle or law.
2. State all given quantities (converted to SI units).
3. Set up the equations.
4. Carry out the algebra and arithmetic, showing every step.
5. State the final answer with units.
6. Verify with at least two checks (dimensions, limiting cases,
   sign, or magnitude).

Do not format the output. Do not produce JSON. Write your working
in plain text as a physicist would on a whiteboard. Your only goal
is a correct, verified answer.

Read the student's exact problem from text, an image, or a PDF. If the input is unreadable, incomplete, or genuinely ambiguous, do not solve it. Reply with exactly one line that starts with "${CLARIFICATION_SENTINEL}" followed by one specific question. Never guess missing values or geometry.`;

const HAWKING_FORMAT_RULES = `Write all teaching prose as Hawking AI, a patient expert physics teacher. Read the student's exact problem from text, an image, or a PDF so the problem statement and any answer options are copied faithfully.

If the input is unreadable, incomplete, or genuinely ambiguous, or the verified working does not contain a complete solution, set needs_clarification=true, ask one specific question, and set solution=null. Never guess missing values or geometry.

Otherwise, set needs_clarification=false and generate ONE complete, full-depth Long solution as structured JSON. Never generate separate Short and Long solutions. The renderer creates both formats from this same JSON.

Follow these rules strictly:
- Copy every number, formula, unit, and the final answer exactly from the verified working. Restructure the working; never recompute it. If the working flags an uncertainty, keep that flag visible in the matching explanation or warning instead of resolving it yourself.
- Teach directly to a student. The Long format is a patient five-minute lesson, not a terse answer key.
- Every conceptual step has a concise answer of one or two sentences, then a separate focused explanation of 80–140 words. Never fold the teaching prose into the answer.
- The step labels are fixed by the app and are never part of your output. step1 is the RECALL THE PRINCIPLE move: name the law or principle that governs the problem and why. step2 is the WHAT GOES IN move: the given data, variables, setup, and the unknown. step3 is the MAP THE DERIVATION move: a one-paragraph preview of the solution path before executing it. Put problem-specific detail only in answer and explanation fields.
- framing_line is an optional one-line Short setup naming the mathematical approach. Keep it empty when the approach is obvious.
- Steps 4–6 form one continuous calculation. Store every mathematical move as an equation block. Each equation annotation must be a short 3–8 word note. Use prose and subsection blocks only for Long teaching context; never hide a necessary calculation in them.
- Use LaTeX without dollar delimiters in latex fields. Everywhere else write plain English and wrap every symbol, variable, or formula in $...$ (for example "the launch angle $\\theta$"). Never use \\( \\), \\[ \\], or bare LaTeX commands outside $...$.
- final_answer.display is a short plain-language reading of the answer, such as "20 m/s" or "tan θ equals tan φ plus gT² over 2d". Never put LaTeX commands or \\displaystyle in it.
- final_answer.option is the matching option label only when problem_options is non-empty. Otherwise return an empty string, never a sentence.
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

/** Call 2: restructure the verified working into the Hawking JSON. No re-solving. */
export const FORMAT_PROMPT = `You are a formatter for the Hawking physics learning app. You will
receive a fully worked and verified physics solution. Your job is
to format it as a Hawking solution JSON.

CRITICAL: Do not re-solve the problem. Do not change any of the
physics, algebra, or numerical answers. Take the verified working
you are given and restructure it into the Hawking format exactly.
If you change a number or a formula, that is a failure.

${HAWKING_FORMAT_RULES}`;

const PHYSICS_MAX_OUTPUT_TOKENS = 4_000;
const FORMAT_MAX_OUTPUT_TOKENS = 6_000;
/** Time held back from the physics call so the formatting call still has a chance to finish. */
const FORMAT_RESERVE_MS = 8_000;

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

export type SolveProviderErrorReason = "quota" | "rate_limit" | "auth";

/** The model provider refused the request for a reason a retry inside one solve cannot fix. */
export class SolveProviderError extends Error {
  constructor(public readonly reason: SolveProviderErrorReason) {
    super(`The Solve model provider refused the request (${reason}).`);
    this.name = "SolveProviderError";
  }
}

/** Maps an OpenAI 401/403/429 failure to a SolveProviderError; returns null for every other error. */
export function classifyProviderError(error: unknown): SolveProviderError | null {
  if (!(error instanceof Error)) return null;
  const { status, code, type } = error as Error & { status?: unknown; code?: unknown; type?: unknown };
  if (status === 401 || status === 403) return new SolveProviderError("auth");
  if (status !== 429) return null;
  const marker = `${typeof type === "string" ? type : ""} ${typeof code === "string" ? code : ""}`;
  const outOfCredits = marker.includes("insufficient_quota") || marker.includes("credit_balance_exhausted") || marker.includes("billing");
  return new SolveProviderError(outOfCredits ? "quota" : "rate_limit");
}

type SolveCallContext = {
  model: string;
  modality: "image" | "pdf" | "text";
  /** Absolute time by which the whole solve, both calls included, must finish. */
  deadline: number;
};

/**
 * Solves a problem in two model calls that share one deadline: a plain-text physics call that
 * derives and verifies the answer, then a formatting call that restructures that working into
 * the Hawking JSON without re-solving it.
 */
export async function generateSolution(
  content: ResponseInputContent[],
  options: { timeoutMs?: number; model?: string } = {}
): Promise<SolveGenerationResult> {
  const context: SolveCallContext = {
    model: options.model || process.env.OPENAI_SOLVE_MODEL || "gpt-4.1",
    modality: content.some((item) => item.type === "input_image")
      ? "image"
      : content.some((item) => item.type === "input_file") ? "pdf" : "text",
    deadline: Date.now() + (options.timeoutMs ?? 55_000),
  };

  const working = await runPhysicsCall(content, context);
  const clarification = readClarification(working);
  if (clarification !== null) {
    return { needs_clarification: true, clarification_question: clarification, solution: null };
  }
  return runFormatCall(content, working, context);
}

async function runPhysicsCall(content: ResponseInputContent[], context: SolveCallContext): Promise<string> {
  const remainingMs = context.deadline - Date.now();
  if (remainingMs <= 0) throw new SolveUpstreamTimeoutError();
  const budgetMs = remainingMs - Math.min(FORMAT_RESERVE_MS, Math.floor(remainingMs / 2));
  const response = await callModel({
    model: context.model,
    instructions: PHYSICS_PROMPT,
    input: [{ role: "user", content }],
    max_output_tokens: PHYSICS_MAX_OUTPUT_TOKENS,
  }, budgetMs, { stage: "physics", attempt: 1, context });

  const working = (response.output_text ?? "").trim();
  if (!working) throw new SolveUpstreamOutputError(`The physics call returned no working. Response status: ${response.status}.`);
  if (response.status === "incomplete") throw new SolveUpstreamOutputError("The physics working was cut off before the final answer.");
  return working;
}

async function runFormatCall(
  content: ResponseInputContent[],
  working: string,
  context: SolveCallContext
): Promise<SolveGenerationResult> {
  let lastError: unknown;
  const input: ResponseCreateParamsNonStreaming["input"] = [{
    role: "user",
    content: [...content, { type: "input_text", text: `Here is the verified solution to format:\n\n${working}` }],
  }];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remainingMs = context.deadline - Date.now();
    if (remainingMs <= 0) throw new SolveUpstreamTimeoutError();
    const response = await callModel({
      model: context.model,
      instructions: attempt === 0
        ? FORMAT_PROMPT
        : `${FORMAT_PROMPT}\n\nThe previous provider output was unusable. Return complete valid JSON and finish every required field.`,
      input,
      max_output_tokens: FORMAT_MAX_OUTPUT_TOKENS,
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
    }, remainingMs, { stage: "format", attempt: attempt + 1, context });

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

async function callModel(
  request: ResponseCreateParamsNonStreaming,
  budgetMs: number,
  details: { stage: "physics" | "format"; attempt: number; context: SolveCallContext }
) {
  const startedAt = Date.now();
  const { context, ...log } = details;
  const logFields = { ...log, model: context.model, modality: context.modality };
  try {
    const response = await getClient().responses.create(
      { ...request, ...(supportsTemperature(context.model) ? { temperature: 0 } : {}) },
      { signal: AbortSignal.timeout(budgetMs), maxRetries: 0 }
    );
    console.info("Solve model call completed", { ...logFields, elapsedMs: Date.now() - startedAt });
    return response;
  } catch (error) {
    console.error("Solve model call failed", { ...logFields, elapsedMs: Date.now() - startedAt, error });
    if (isAbortError(error) || Date.now() >= context.deadline) throw new SolveUpstreamTimeoutError();
    throw classifyProviderError(error) ?? error;
  }
}

/** Reasoning models (o-series, gpt-5 family) reject the temperature parameter; every other model gets temperature 0. */
function supportsTemperature(model: string): boolean {
  return !/^(o\d|gpt-5)/i.test(model);
}

/** Returns the clarification question when the physics call declined to solve, otherwise null. */
function readClarification(working: string): string | null {
  if (!working.toUpperCase().startsWith(CLARIFICATION_SENTINEL)) return null;
  const question = working
    .slice(CLARIFICATION_SENTINEL.length)
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!question) throw new SolveUpstreamOutputError("The model asked for clarification without a question.");
  return question;
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
  return {
    ...value,
    derivation: { ...value.derivation, blocks },
    final_answer: normalizeFinalAnswer(value.final_answer, Array.isArray(value.problem_options) && value.problem_options.length > 0),
  };
}

function normalizeFinalAnswer(value: unknown, hasOptions: boolean): unknown {
  if (!isRecord(value) || typeof value.latex !== "string" || typeof value.display !== "string") return value;
  let display = value.display.trim();
  if (isLatexSource(display)) {
    display = cleanLatexSource(display);
    if (normalizeLatex(display) === normalizeLatex(cleanLatexSource(value.latex))) display = "";
  }
  const option = hasOptions && typeof value.option === "string" ? value.option : "";
  return { ...value, display, option };
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
    ["answer", "explanation"].every((field) => typeof value[field] === "string") &&
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
