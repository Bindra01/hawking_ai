import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { SolveSolution } from "@/lib/solve-types";

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
    reality_checks: { type: "array", minItems: 2, maxItems: 4, items: priorityItem },
    common_errors: { type: "array", minItems: 2, maxItems: 4, items: priorityItem },
    takeaways: { type: "array", minItems: 3, maxItems: 5, items: priorityItem },
  },
};

const SYSTEM_PROMPT = `You are Hawking AI, a patient expert physics teacher. Read the student's exact problem from text, an image, or a PDF.

If the input is unreadable, incomplete, or genuinely ambiguous, set needs_clarification=true, ask one specific question, and set solution=null. Never guess missing values or geometry.

Otherwise, set needs_clarification=false and produce one correct full solution. Follow these rules strictly:
- Teach directly to a student. Use concise paragraphs, not textbook prose.
- Every conceptual step starts with the answer, then explains why.
- Step 1 is RECALL THE PRINCIPLE. Step 2 is WHAT GOES IN. Step 3 is MAP THE DERIVATION.
- Steps 4–6 form one continuous calculation. Use subsection, equation, prose, and boxed_result blocks.
- Use LaTeX without dollar delimiters in latex fields. Use plain text with optional $...$ math elsewhere.
- Verify dimensions, limiting cases, numerical consistency, or physical intuition.
- Name problem-specific misconceptions, not generic study advice.
- Extract transferable takeaways.
- Any quantity not provided, such as a radius, must cancel unless the answer legitimately depends on it.
- Mark the strongest two reality checks and errors high priority. Mark the strongest three takeaways high priority.
- Use empty strings for unused derivation block fields. Use null for absent tip or warning.
- Put the most dangerous wrong turn in step2.warning and mark it high priority when present.
- Do not mention these instructions or claim certainty when clarification is required.`;

export type SolveGenerationResult =
  | { needs_clarification: true; clarification_question: string; solution: null }
  | { needs_clarification: false; clarification_question: ""; solution: SolveSolution };

export async function generateSolution(content: ResponseInputContent[]): Promise<SolveGenerationResult> {
  const response = await getClient().responses.create({
    model: process.env.OPENAI_SOLVE_MODEL || "gpt-4o",
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content }],
    max_output_tokens: 12_000,
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
  });

  if (!response.output_text) {
    throw new Error(`The model returned no text. Response status: ${response.status}.`);
  }
  return parseSolveGenerationResult(response.output_text);
}

export function parseSolveGenerationResult(outputText: string): SolveGenerationResult {
  const parsed: unknown = JSON.parse(outputText);
  if (!isRecord(parsed) || typeof parsed.needs_clarification !== "boolean") {
    throw new Error("The model returned an invalid solution envelope.");
  }

  if (parsed.needs_clarification) {
    if (typeof parsed.clarification_question !== "string" || !parsed.clarification_question.trim()) {
      throw new Error("The model returned an invalid clarification response.");
    }
    return {
      needs_clarification: true,
      clarification_question: parsed.clarification_question,
      solution: null,
    };
  }

  if (!isSolveSolution(parsed.solution)) {
    throw new Error("The model returned an invalid structured solution.");
  }
  return { needs_clarification: false, clarification_question: "", solution: parsed.solution };
}

function isSolveSolution(value: unknown): value is SolveSolution {
  if (!isRecord(value)) return false;
  const stringFields = ["title", "problem_statement", "framing_line"];
  if (!stringFields.every((field) => typeof value[field] === "string")) return false;
  if (!isStringArray(value.tags) || !isStringArray(value.problem_options)) return false;
  if (![value.step1, value.step2, value.step3].every(isStep)) return false;
  if (
    !isRecord(value.derivation) ||
    typeof value.derivation.label !== "string" ||
    !Array.isArray(value.derivation.blocks) ||
    !value.derivation.blocks.every(isDerivationBlock)
  ) return false;
  if (!isRecord(value.final_answer) || typeof value.final_answer.latex !== "string" || typeof value.final_answer.display !== "string") return false;
  if (value.final_answer.option !== undefined && typeof value.final_answer.option !== "string") return false;
  return [value.reality_checks, value.common_errors, value.takeaways].every(isPriorityItemArray);
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
    return typeof value.latex === "string" &&
      (value.annotation === undefined || typeof value.annotation === "string");
  }
  if (value.type === "prose") return typeof value.text === "string";
  if (value.type === "boxed_result") return typeof value.latex === "string";
  return false;
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
