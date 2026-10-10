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

  if (!response.output_text) throw new Error("The model returned an empty response.");
  const parsed = JSON.parse(response.output_text) as SolveGenerationResult;
  if (parsed.needs_clarification || !parsed.solution) {
    return {
      needs_clarification: true,
      clarification_question: parsed.clarification_question || "Please provide a clearer problem statement.",
      solution: null,
    };
  }
  return { needs_clarification: false, clarification_question: "", solution: parsed.solution };
}
