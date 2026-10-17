import { afterEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import {
  ACCURACY_REQUIREMENTS,
  CLARIFICATION_SENTINEL,
  classifyProviderError,
  FORMAT_PROMPT,
  generateSolution,
  parseSolveGenerationResult,
  PHYSICS_PROMPT,
  SolveProviderError,
  SolveUpstreamOutputError,
  SolveUpstreamTimeoutError,
} from "@/lib/generate-solution";

afterEach(() => {
  vi.restoreAllMocks();
});

type CreateRequest = {
  model: string;
  instructions: string;
  temperature?: number;
  max_output_tokens: number;
  input: Array<{ role: string; content: Array<Record<string, unknown>> }>;
  text?: { format?: { type: string; schema: unknown } };
};

const WORKING = "Principle: Newton's second law.\nGiven: F = 40 N, m = 2 kg.\na = F/m = 20 m/s^2, v = a t = 20 m/s.\nChecks: dimensions m/s, magnitude plausible.";

/** Mocks the physics call with plain working, then each formatting attempt with the given JSON text. */
function mockSolve(...formatOutputs: string[]) {
  const create = vi.spyOn(OpenAI.Responses.prototype, "create")
    .mockResolvedValueOnce({ output_text: WORKING, status: "completed" } as never);
  for (const output of formatOutputs) create.mockResolvedValueOnce({ output_text: output, status: "completed" } as never);
  return create;
}

function requestOf(create: ReturnType<typeof mockSolve>, index: number): CreateRequest {
  return create.mock.calls[index][0] as unknown as CreateRequest;
}

describe("parseSolveGenerationResult", () => {
  const longTeaching = "This teaching detail explains the physical meaning and connects each equation to the next step. ".repeat(20);
  const validSolution = {
    title: "Constant acceleration",
    tags: ["Mechanics"],
    problem_statement: "Find the speed.",
    problem_options: [],
    framing_line: "Use Newton's second law.",
    step1: { answer: "F = ma", explanation: longTeaching, tip: null, warning: null },
    step2: { answer: "m = 2 kg", explanation: longTeaching, tip: null, warning: null },
    step3: { answer: "Find a, then v", explanation: longTeaching, tip: null, warning: null },
    derivation: { blocks: [
      { type: "equation", latex: "a=F/m", annotation: "solve for the acceleration" },
      { type: "equation", latex: "v=20\\,m/s", annotation: "substitute values and calculate speed" },
    ] },
    final_answer: { latex: "v=20\\,m/s", display: "20 m/s", option: "" },
    reality_checks: [
      { heading: "Units", title: "Dimensions", text: "The units are speed.", priority: "high" },
      { heading: "Direction", title: "Sign", text: "The speed is positive.", priority: "high" },
      { heading: "Limit", title: "Time", text: "Zero time gives zero speed.", priority: "low" },
      { heading: "Scale", title: "Force", text: "More force gives more speed.", priority: "low" },
    ],
    common_errors: [
      { heading: "Force", title: "Mass", text: "Do not omit mass.", priority: "high" },
      { heading: "Initial", title: "Velocity", text: "Include initial speed.", priority: "high" },
      { heading: "Units", title: "Seconds", text: "Use seconds.", priority: "low" },
      { heading: "Vector", title: "Direction", text: "Track direction.", priority: "low" },
    ],
    takeaways: [
      { heading: "Method", title: "Sequence", text: "Find acceleration first.", priority: "high" },
      { heading: "Dynamics", title: "Newton", text: "Use F = ma.", priority: "high" },
      { heading: "Kinematics", title: "Speed", text: "Then use v = u + at.", priority: "high" },
      { heading: "Units", title: "SI", text: "Keep SI units.", priority: "low" },
      { heading: "Check", title: "Scale", text: "Check proportionality.", priority: "low" },
    ],
  };

  it("accepts a complete structured solution", () => {
    const result = parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: validSolution,
    }));
    expect(result.needs_clarification).toBe(false);
  });

  it("blanks a final display that only repeats the final LaTeX and drops a stray option", () => {
    const result = parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: {
        ...validSolution,
        final_answer: { latex: "v=20\\,m/s", display: "\\displaystyle v = 20 \\, m/s", option: "Use the relation derived from minimizing the distance." },
      },
    }), { enforceFormatRatio: false });

    expect(result.solution?.final_answer).toEqual({ latex: "v=20\\,m/s", display: "", option: "" });
  });

  it("strips \\displaystyle from a LaTeX display that differs from the final LaTeX", () => {
    const result = parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: {
        ...validSolution,
        final_answer: { latex: "v=20\\,m/s", display: "$\\displaystyle v = \\frac{40}{2}\\,m/s$", option: "" },
      },
    }), { enforceFormatRatio: false });

    expect(result.solution?.final_answer.display).toBe("v = \\frac{40}{2}\\,m/s");
  });

  it("keeps a plain display and the option when the problem has options", () => {
    const result = parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: {
        ...validSolution,
        problem_options: ["(A) 10 m/s", "(B) 20 m/s"],
        final_answer: { latex: "v=20\\,m/s", display: " 20 m/s ", option: "(B)" },
      },
    }), { enforceFormatRatio: false });

    expect(result.solution?.final_answer).toEqual({ latex: "v=20\\,m/s", display: "20 m/s", option: "(B)" });
  });

  it("can return a valid solution when only the format ratio misses the quality target", () => {
    const thinLongSolution = {
      ...validSolution,
      step1: { ...validSolution.step1, explanation: "Brief explanation." },
      step2: { ...validSolution.step2, explanation: "Brief explanation." },
      step3: { ...validSolution.step3, explanation: "Brief explanation." },
      derivation: {
        ...validSolution.derivation,
        blocks: [...Array.from({ length: 149 }, (_, index) => ({ type: "equation", latex: `x_${index}=1`, annotation: "shared derivation step" })), { type: "equation", latex: "v=20\\,m/s", annotation: "state the final calculated speed" }],
      },
    };
    const output = JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: thinLongSolution,
    });

    expect(() => parseSolveGenerationResult(output)).toThrow(/insufficient Long-format depth/);
    expect(parseSolveGenerationResult(output, { enforceFormatRatio: false })).toMatchObject({
      needs_clarification: false,
      solution: thinLongSolution,
    });
  });

  it("returns and logs a below-target solution through generateSolution", async () => {
    const thinLongSolution = {
      ...validSolution,
      step1: { ...validSolution.step1, explanation: "Brief explanation." },
      step2: { ...validSolution.step2, explanation: "Brief explanation." },
      step3: { ...validSolution.step3, explanation: "Brief explanation." },
      derivation: {
        ...validSolution.derivation,
        blocks: [...Array.from({ length: 149 }, (_, index) => ({ type: "equation", latex: `x_${index}=1`, annotation: "shared derivation step" })), { type: "equation", latex: "v=20\\,m/s", annotation: "state the final calculated speed" }],
      },
    };
    const output = JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: thinLongSolution,
    });
    mockSolve(output);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(generateSolution([{ type: "input_text", text: "Solve this." }])).resolves.toMatchObject({
      needs_clarification: false,
      solution: thinLongSolution,
    });
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(/insufficient Long-format depth/));
  });

  it("solves in a plain-text physics call, then formats that working at temperature 0", async () => {
    const create = mockSolve(JSON.stringify({ needs_clarification: false, clarification_question: "", solution: validSolution }));
    const problem = [{ type: "input_text" as const, text: "Solve this physics problem:\n\nA 2 kg block is pushed with 40 N for 1 s." }];

    await expect(generateSolution(problem)).resolves.toMatchObject({ needs_clarification: false, solution: validSolution });

    expect(create).toHaveBeenCalledTimes(2);
    const physics = requestOf(create, 0);
    expect(physics.instructions).toBe(PHYSICS_PROMPT);
    expect(physics.instructions.startsWith(ACCURACY_REQUIREMENTS)).toBe(true);
    expect(physics.instructions).toContain("Do not produce JSON.");
    expect(physics.temperature).toBe(0);
    expect(physics.max_output_tokens).toBe(4_000);
    expect(physics.text).toBeUndefined();
    expect(physics.input).toEqual([{ role: "user", content: problem }]);

    const format = requestOf(create, 1);
    expect(format.instructions).toBe(FORMAT_PROMPT);
    expect(format.instructions).toContain("Do not re-solve the problem.");
    expect(format.instructions).toContain("The step labels are fixed by the app");
    expect(format.instructions).toContain("SHORT is a worked derivation only");
    expect(format.temperature).toBe(0);
    expect(format.max_output_tokens).toBe(6_000);
    expect(format.text?.format?.type).toBe("json_schema");
    expect(format.input).toEqual([{
      role: "user",
      content: [...problem, { type: "input_text", text: `Here is the verified solution to format:\n\n${WORKING}` }],
    }]);
    expect(create).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({ signal: expect.any(AbortSignal), maxRetries: 0 }));
    expect(create).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ signal: expect.any(AbortSignal), maxRetries: 0 }));
  });

  it("gives the physics call the exact constants and every accuracy rule", () => {
    for (const rule of ["RULE 1 — DERIVE BEFORE WRITING.", "RULE 2 — VERIFY THE ANSWER BEFORE WRITING IT.", "RULE 3 — NEVER GUESS A FORMULA.", "RULE 4 — VERIFY ALGEBRA LINE BY LINE.", "RULE 5 — CONVERT TO SI UNITS AT THE START.", "RULE 6 — USE THESE EXACT PHYSICAL CONSTANTS."]) {
      expect(PHYSICS_PROMPT).toContain(rule);
    }
    for (const constant of ["h  = 6.626 × 10⁻³⁴ J·s", "c  = 3.0   × 10⁸  m/s", "e  = 1.602 × 10⁻¹⁹ C", "g  = 10 m/s² unless specified", "ε₀ = 8.85  × 10⁻¹² F/m", "k  = 9.0   × 10⁹  N·m²/C²", "mₑ = 9.11  × 10⁻³¹ kg", "mₚ = 1.67  × 10⁻²⁷ kg", "Nₐ = 6.022 × 10²³ mol⁻¹", "R  = 8.314 J/(mol·K)", "kB = 1.38  × 10⁻²³ J/K", "σ  = 5.67  × 10⁻⁸ W/(m²·K⁴)"]) {
      expect(PHYSICS_PROMPT).toContain(constant);
    }
    expect(FORMAT_PROMPT).not.toContain("ACCURACY REQUIREMENTS");
  });

  it("uses the selected vision model for both calls", async () => {
    const create = mockSolve(JSON.stringify({ needs_clarification: false, clarification_question: "", solution: validSolution }));

    await generateSolution(
      [{ type: "input_image", image_url: "data:image/png;base64,AA==", detail: "low" }],
      { model: "gpt-4.1-mini" }
    );

    expect(requestOf(create, 0)).toMatchObject({ model: "gpt-4.1-mini", temperature: 0, max_output_tokens: 4_000 });
    expect(requestOf(create, 1)).toMatchObject({ model: "gpt-4.1-mini", temperature: 0, max_output_tokens: 6_000 });
  });

  it("omits temperature for reasoning models that reject it", async () => {
    const create = mockSolve(JSON.stringify({ needs_clarification: false, clarification_question: "", solution: validSolution }));

    await generateSolution([{ type: "input_text", text: "Solve this." }], { model: "o4-mini" });

    expect(requestOf(create, 0)).not.toHaveProperty("temperature");
    expect(requestOf(create, 1)).not.toHaveProperty("temperature");
  });

  it("returns a clarification from the physics call without a formatting call", async () => {
    const create = vi.spyOn(OpenAI.Responses.prototype, "create").mockResolvedValueOnce({
      output_text: `${CLARIFICATION_SENTINEL} What is the mass of the block?\n`,
      status: "completed",
    } as never);

    await expect(generateSolution([{ type: "input_text", text: "Solve this." }])).resolves.toEqual({
      needs_clarification: true,
      clarification_question: "What is the mass of the block?",
      solution: null,
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["no working", { output_text: "", status: "completed" }, /returned no working/],
    ["cut-off working", { output_text: "a = F/m =", status: "incomplete" }, /cut off/],
    ["an empty clarification", { output_text: `${CLARIFICATION_SENTINEL}   `, status: "completed" }, /without a question/],
  ])("fails with an output error when the physics call returns %s", async (_label, response, message) => {
    const create = vi.spyOn(OpenAI.Responses.prototype, "create").mockResolvedValueOnce(response as never);

    const failure = generateSolution([{ type: "input_text", text: "Solve this." }]);
    await expect(failure).rejects.toBeInstanceOf(SolveUpstreamOutputError);
    await expect(failure).rejects.toThrow(message);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("sends OpenAI a schema that cannot carry a step label", async () => {
    const create = mockSolve(JSON.stringify({ needs_clarification: false, clarification_question: "", solution: validSolution }));

    await generateSolution([{ type: "input_text", text: "Solve this." }]);

    const request = create.mock.calls[1][0] as { text: { format: { schema: unknown } } };
    const names: string[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      if (record.properties && typeof record.properties === "object") names.push(...Object.keys(record.properties as object));
      if (Array.isArray(record.required)) names.push(...(record.required as string[]));
      Object.values(record).forEach(walk);
    };
    walk(request.text.format.schema);

    expect(names).toContain("answer");
    expect(names).toContain("explanation");
    expect(names).toContain("blocks");
    expect(names).not.toContain("label");
  });

  it("fails fast with a quota provider error when OpenAI reports no credits", async () => {
    const create = vi.spyOn(OpenAI.Responses.prototype, "create").mockRejectedValue(
      Object.assign(new Error("429 You have no credits remaining."), { status: 429, type: "insufficient_quota", code: "credit_balance_exhausted" })
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const failure = generateSolution([{ type: "input_text", text: "Solve this." }], { timeoutMs: 5_000 });
    await expect(failure).rejects.toBeInstanceOf(SolveProviderError);
    await expect(failure).rejects.toMatchObject({ reason: "quota" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("classifies provider refusals by status and leaves other errors alone", () => {
    expect(classifyProviderError(Object.assign(new Error("429"), { status: 429, type: "requests", code: "rate_limit_exceeded" }))).toMatchObject({ reason: "rate_limit" });
    expect(classifyProviderError(Object.assign(new Error("401"), { status: 401, code: "invalid_api_key" }))).toMatchObject({ reason: "auth" });
    expect(classifyProviderError(Object.assign(new Error("500"), { status: 500 }))).toBeNull();
    expect(classifyProviderError(new Error("socket hang up"))).toBeNull();
  });

  it("maps an aborted provider request to the Solve timeout error", async () => {
    const aborted = new Error("Request was aborted");
    aborted.name = "APIUserAbortError";
    vi.spyOn(OpenAI.Responses.prototype, "create").mockRejectedValue(aborted);

    await expect(generateSolution(
      [{ type: "input_image", image_url: "data:image/png;base64,AA==", detail: "low" }],
      { timeoutMs: 10_000 }
    )).rejects.toBeInstanceOf(SolveUpstreamTimeoutError);
  });

  it("maps a formatting call that aborts after the physics call to the Solve timeout error", async () => {
    const aborted = new Error("Request was aborted");
    aborted.name = "APIUserAbortError";
    const create = vi.spyOn(OpenAI.Responses.prototype, "create")
      .mockResolvedValueOnce({ output_text: WORKING, status: "completed" } as never)
      .mockRejectedValueOnce(aborted);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(generateSolution([{ type: "input_text", text: "Solve this." }], { timeoutMs: 10_000 }))
      .rejects.toBeInstanceOf(SolveUpstreamTimeoutError);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries only the formatting call, with the same working, when the provider returns malformed JSON", async () => {
    const create = mockSolve(
      '{"broken":',
      JSON.stringify({ needs_clarification: false, clarification_question: "", solution: validSolution })
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(generateSolution([{ type: "input_text", text: "Solve this." }])).resolves.toMatchObject({
      needs_clarification: false,
      solution: validSolution,
    });
    expect(create).toHaveBeenCalledTimes(3);
    const retry = requestOf(create, 2);
    expect(retry.instructions).toContain("The previous provider output was unusable.");
    expect(retry.text?.format?.type).toBe("json_schema");
    expect(retry.input[0].content.at(-1)).toEqual({ type: "input_text", text: `Here is the verified solution to format:\n\n${WORKING}` });
  });

  it("stops after one bounded formatting retry for invalid structured output", async () => {
    const invalidPriorities = { ...validSolution, reality_checks: validSolution.reality_checks.map((item) => ({ ...item, priority: "high" })) };
    const invalidOutput = JSON.stringify({ needs_clarification: false, clarification_question: "", solution: invalidPriorities });
    const create = mockSolve(invalidOutput, invalidOutput);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(generateSolution([{ type: "input_text", text: "Solve this." }])).rejects.toThrow(/invalid structured solution/);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("normalizes provider annotation length and appends the exact final equation", () => {
    const providerSolution = {
      ...validSolution,
      derivation: {
        ...validSolution.derivation,
        blocks: [
          { type: "equation", latex: "a=F/m", annotation: "Acceleration" },
          { type: "equation", latex: "at=20\\,m/s", annotation: "substitute all known values into the constant acceleration relation now" },
        ],
      },
    };
    const result = parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: providerSolution,
    }), { enforceFormatRatio: false });

    expect(result.solution?.derivation.blocks).toEqual([
      expect.objectContaining({ annotation: "continue the calculation carefully" }),
      expect.objectContaining({ annotation: "substitute all known values into the constant acceleration" }),
      expect.objectContaining({ latex: validSolution.final_answer.latex, annotation: "state the final calculated answer" }),
    ]);
  });

  it("rejects a contradictory terminal equation for the final quantity", () => {
    const contradictory = {
      ...validSolution,
      derivation: {
        ...validSolution.derivation,
        blocks: validSolution.derivation.blocks.map((block, index) =>
          index === validSolution.derivation.blocks.length - 1 ? { ...block, latex: "v=999" } : block
        ),
      },
    };

    expect(() => parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: contradictory,
    }))).toThrow(/invalid structured solution/);
  });

  it.each([undefined, null, { prose: "not an annotation" }])("rejects a non-string equation annotation", (annotation) => {
    const invalid = {
      ...validSolution,
      derivation: {
        ...validSolution.derivation,
        blocks: validSolution.derivation.blocks.map((block, index) =>
          index === 0 ? { ...block, annotation } : block
        ),
      },
    };

    expect(() => parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution: invalid,
    }))).toThrow(/invalid structured solution/);
  });

  it("accepts a clarification response", () => {
    expect(parseSolveGenerationResult(JSON.stringify({
      needs_clarification: true,
      clarification_question: "What is the block mass?",
      solution: null,
    }))).toEqual({
      needs_clarification: true,
      clarification_question: "What is the block mass?",
      solution: null,
    });
  });

  it.each([
    "not json",
    JSON.stringify({}),
    JSON.stringify({ needs_clarification: true, clarification_question: "", solution: null }),
    JSON.stringify({ needs_clarification: false, clarification_question: "", solution: null }),
  ])("rejects invalid structured output", (output) => {
    expect(() => parseSolveGenerationResult(output)).toThrow();
  });

  it.each([
    { ...validSolution, derivation: { blocks: [null] } },
    { ...validSolution, derivation: { blocks: [{ type: "unknown" }] } },
    { ...validSolution, derivation: { blocks: [
      { type: "equation", latex: "", annotation: "invalid empty equation value" },
      { type: "equation", latex: "v=20\\,m/s", annotation: "state the final calculated speed" },
    ] } },
    { ...validSolution, step1: { ...validSolution.step1, tip: { text: {}, priority: "high" } } },
    { ...validSolution, reality_checks: [{ heading: {}, text: "Check", priority: "high" }] },
    { ...validSolution, reality_checks: validSolution.reality_checks.map((item) => ({ ...item, priority: "high" })) },
  ])("rejects malformed nested solution data", (solution) => {
    expect(() => parseSolveGenerationResult(JSON.stringify({
      needs_clarification: false,
      clarification_question: "",
      solution,
    }))).toThrow();
  });
});
