import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the OpenAI client so we can drive the retry loop deterministically and
// inspect the `messages` array each attempt receives. The mock is hoisted by
// vitest, so the create spy is declared via a factory-local variable.
const createMock = vi.fn();
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: () => ({
    chat: { completions: { create: createMock } },
  }),
}));

// Import AFTER the mock is registered.
import { generateProblem, regenerateSteps, __TEST_EXAMPLES } from "@/lib/generate-problem";

function completion(content: string) {
  return { choices: [{ message: { content } }] };
}

// A problem the second (retry) attempt returns; the class_11 example is known to
// pass validateAndNormalize, so it terminates the retry loop cleanly.
const VALID_PROBLEM = {
  title: "T",
  subject: "thermodynamics",
  topic: "Kinetic Theory",
  difficulty: "class_11",
  scenario: __TEST_EXAMPLES.EXAMPLE_CLASS_11.scenario,
  goal: __TEST_EXAMPLES.EXAMPLE_CLASS_11.goal,
  final_answer: __TEST_EXAMPLES.EXAMPLE_CLASS_11.final_answer,
  diagram_type: null,
  solution_flow: __TEST_EXAMPLES.EXAMPLE_CLASS_11.solution_flow,
};

// Build a problem whose terminal "form" step is a predict contract with the
// given final answer + predict payload (deep-cloned from the class_11 example so
// mutation is isolated per test). Used to drive first-attempt predict rejections.
function badPredictProblem(
  finalAnswer: string,
  predict: Record<string, unknown>,
  meta: { subject: string; topic: string; difficulty: string }
) {
  const p = JSON.parse(
    JSON.stringify({
      title: "T",
      ...meta,
      scenario: __TEST_EXAMPLES.EXAMPLE_CLASS_11.scenario,
      goal: __TEST_EXAMPLES.EXAMPLE_CLASS_11.goal,
      final_answer: finalAnswer,
      diagram_type: null,
      solution_flow: __TEST_EXAMPLES.EXAMPLE_CLASS_11.solution_flow,
    })
  );
  const steps = p.solution_flow.steps;
  const form = steps[steps.length - 1];
  delete form.build;
  form.predict = predict;
  return p;
}

describe("generation retry loop injects the prior validation error (self-correcting re-roll)", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("generateProblem: second attempt's messages include the correction turn after a first failure", async () => {
    // A valid problem the second attempt returns (the class_11 example is known
    // to pass validateAndNormalize).
    const validProblem = {
      title: "T",
      subject: "thermodynamics",
      topic: "Kinetic Theory",
      difficulty: "class_11",
      scenario: __TEST_EXAMPLES.EXAMPLE_CLASS_11.scenario,
      goal: __TEST_EXAMPLES.EXAMPLE_CLASS_11.goal,
      final_answer: __TEST_EXAMPLES.EXAMPLE_CLASS_11.final_answer,
      diagram_type: null,
      solution_flow: __TEST_EXAMPLES.EXAMPLE_CLASS_11.solution_flow,
    };

    createMock
      // First attempt: unparseable JSON → forces lastError, drives a retry.
      .mockResolvedValueOnce(completion("this is not json"))
      // Second attempt: valid problem.
      .mockResolvedValueOnce(completion(JSON.stringify(validProblem)));

    await generateProblem("thermodynamics", "Kinetic Theory", "class_11");

    expect(createMock).toHaveBeenCalledTimes(2);
    const firstMessages = createMock.mock.calls[0][0].messages;
    const secondMessages = createMock.mock.calls[1][0].messages;

    // First attempt: only system + user, no correction turn.
    expect(firstMessages).toHaveLength(2);
    // Second attempt: system + user + assistant + user(correction).
    expect(secondMessages.length).toBeGreaterThan(2);
    const lastTurn = secondMessages[secondMessages.length - 1];
    expect(lastTurn.role).toBe("user");
    expect(lastTurn.content).toMatch(/previous attempt was REJECTED/i);
  });

  it("correction turn echoes the specific prior error AND names the too-few-variables predict-ineligibility case", async () => {
    // First attempt: a terminal predict step with a single graded variable —
    // reproduces the user-reported "predict.variables must have 2-8 entries,
    // got 1" rejection. The second attempt returns a valid problem. We assert
    // the correction turn both echoes that exact error and steers toward the
    // equation contract for the <2-distinct-free-variables reason.
    const bad = badPredictProblem(
      "$I_d = I$",
      {
        target: "I_d",
        correctFormula: "$I_d = I$",
        variables: [{ symbol: "I", label: "the current", role: "numerator" }],
      },
      { subject: "electrodynamics", topic: "Displacement Current", difficulty: "college" }
    );

    createMock
      .mockResolvedValueOnce(completion(JSON.stringify(bad)))
      .mockResolvedValueOnce(completion(JSON.stringify(VALID_PROBLEM)));

    await generateProblem("electrodynamics", "Displacement Current", "college");

    expect(createMock).toHaveBeenCalledTimes(2);
    const secondMessages = createMock.mock.calls[1][0].messages;
    const correction = secondMessages[secondMessages.length - 1].content as string;
    // Echoes the exact validation error the model must fix.
    expect(correction).toMatch(/must have 2-8 entries, got 1/);
    // Names the too-few-variables predict-ineligibility reason.
    expect(correction).toMatch(/fewer than 2 distinct free physical quantities/i);
  });

  it("does NOT steer off predict when the rejection is UNRELATED to predict eligibility", async () => {
    // A non-eligibility failure (here: unparseable JSON) must NOT tell the model
    // to switch the terminal step to the equation contract — otherwise an
    // unrelated error needlessly converts an eligible predict answer to equation.
    createMock
      .mockResolvedValueOnce(completion("this is not json"))
      .mockResolvedValueOnce(completion(JSON.stringify(VALID_PROBLEM)));

    await generateProblem("electrodynamics", "Coulomb's Law", "class_12");

    const secondMessages = createMock.mock.calls[1][0].messages;
    const correction = secondMessages[secondMessages.length - 1].content as string;
    expect(correction).toMatch(/Keep the SAME step types and terminal contract/);
    expect(correction).not.toMatch(/Author that terminal step on the "equation" contract/);
  });

  it("DOES steer to the equation contract when the rejection IS a predict-ineligibility error", async () => {
    // Single-variable predict → 'predict.variables must have 2-8 entries, got 1'
    // is a genuine eligibility rejection; the steer to equation should appear.
    const bad = badPredictProblem(
      "$I_d = I$",
      {
        target: "I_d",
        correctFormula: "$I_d = I$",
        variables: [{ symbol: "I", label: "the current", role: "numerator" }],
      },
      { subject: "electrodynamics", topic: "Displacement Current", difficulty: "college" }
    );
    createMock
      .mockResolvedValueOnce(completion(JSON.stringify(bad)))
      .mockResolvedValueOnce(completion(JSON.stringify(VALID_PROBLEM)));

    await generateProblem("electrodynamics", "Displacement Current", "college");

    const secondMessages = createMock.mock.calls[1][0].messages;
    const correction = secondMessages[secondMessages.length - 1].content as string;
    expect(correction).toMatch(/Author that terminal step on the "equation" contract/);
    expect(correction).not.toMatch(/Keep the SAME step types and terminal contract/);
  });

  it("includes a STRUCTURAL equation-terminal form-step exemplar on the ineligibility steer", async () => {
    // All three full few-shot examples now use a predict terminal, so the model
    // has no structural equation-terminal shape to imitate on the fallback path.
    // Prose alone is ~0% adherence for GPT-4o, which caused non-ratio class_11
    // answers (roots/sums/trig) to exhaust retries and hard-fail. The steer must
    // therefore carry a compact equation-contract "form" step JSON to copy.
    const bad = badPredictProblem(
      "$v_{rms} = \\sqrt{\\frac{3RT}{M}}$",
      {
        target: "v_{rms}",
        correctFormula: "$v_{rms} = \\sqrt{\\frac{3RT}{M}}$",
        variables: [
          { symbol: "R", label: "gas constant", role: "numerator" },
          { symbol: "T", label: "temperature", role: "numerator" },
        ],
      },
      { subject: "thermodynamics", topic: "Kinetic Theory", difficulty: "class_11" }
    );
    createMock
      .mockResolvedValueOnce(completion(JSON.stringify(bad)))
      .mockResolvedValueOnce(completion(JSON.stringify(VALID_PROBLEM)));

    await generateProblem("thermodynamics", "Kinetic Theory", "class_11");

    const secondMessages = createMock.mock.calls[1][0].messages;
    const correction = secondMessages[secondMessages.length - 1].content as string;
    // The steer names the equation contract AND carries a copyable JSON shape
    // with an equation contract (build.equation) on a terminal form step.
    expect(correction).toMatch(/Author that terminal step on the "equation" contract/);
    expect(correction).toMatch(/EXACT shape the "equation"-contract terminal/);
    expect(correction).toMatch(/"build"/);
    expect(correction).toMatch(/"equation"/);
    expect(correction).toMatch(/"lhs_terms"/);
    // And the exemplar must NOT carry a predict payload (that would defeat the
    // purpose of demonstrating the equation fallback).
    const snippetStart = correction.indexOf("EXACT shape");
    expect(correction.slice(snippetStart)).not.toMatch(/"predict"/);
  });

  it("DOES steer to equation when a predict answer is ADDITIVE ('unexpected operator')", async () => {
    // Parallel resistance $R = \frac{R_1 R_2}{R_1 + R_2}$ has a top-level `+` in
    // the denominator, so canonicalPredictFormula throws "unexpected operator".
    // That is a genuine ineligibility (an additive answer can never be a monomial
    // ratio), so the retry MUST steer the terminal step to the equation contract.
    const bad = badPredictProblem(
      "$R = \\frac{R_1 R_2}{R_1 + R_2}$",
      {
        target: "R",
        correctFormula: "$R = \\frac{R_1 R_2}{R_1 + R_2}$",
        variables: [
          { symbol: "R_1", label: "first resistance", role: "numerator" },
          { symbol: "R_2", label: "second resistance", role: "numerator" },
        ],
      },
      { subject: "electrodynamics", topic: "Ohm's Law", difficulty: "college" }
    );
    createMock
      .mockResolvedValueOnce(completion(JSON.stringify(bad)))
      .mockResolvedValueOnce(completion(JSON.stringify(VALID_PROBLEM)));

    await generateProblem("electrodynamics", "Ohm's Law", "college");

    const secondMessages = createMock.mock.calls[1][0].messages;
    const correction = secondMessages[secondMessages.length - 1].content as string;
    expect(correction).toMatch(/unexpected operator/);
    expect(correction).toMatch(/Author that terminal step on the "equation" contract/);
    expect(correction).not.toMatch(/Keep the SAME step types and terminal contract/);
  });

  it("DOES steer to equation when a predict answer is a ROOT/PAREN shape ('unconsumed input')", async () => {
    // $P = \frac{(V_b - V_d)^2}{R}$ has a parenthesized difference the factor
    // grammar cannot consume, so canonicalPredictFormula throws "unconsumed
    // input". That is a genuine ineligibility, so steer to the equation contract.
    const bad = badPredictProblem(
      "$P = \\frac{(V_b - V_d)^2}{R}$",
      {
        target: "P",
        correctFormula: "$P = \\frac{(V_b - V_d)^2}{R}$",
        variables: [
          { symbol: "V_b", label: "potential at b", role: "numerator" },
          { symbol: "R", label: "resistance", role: "denominator" },
        ],
      },
      { subject: "electrodynamics", topic: "Ohm's Law", difficulty: "college" }
    );
    createMock
      .mockResolvedValueOnce(completion(JSON.stringify(bad)))
      .mockResolvedValueOnce(completion(JSON.stringify(VALID_PROBLEM)));

    await generateProblem("electrodynamics", "Ohm's Law", "college");

    const secondMessages = createMock.mock.calls[1][0].messages;
    const correction = secondMessages[secondMessages.length - 1].content as string;
    expect(correction).toMatch(/unconsumed input/);
    expect(correction).toMatch(/Author that terminal step on the "equation" contract/);
    expect(correction).not.toMatch(/Keep the SAME step types and terminal contract/);
  });

  it("regenerateSteps: also injects the correction turn on retry", async () => {
    const validSteps = { steps: __TEST_EXAMPLES.EXAMPLE_CLASS_11.solution_flow.steps };

    createMock
      .mockResolvedValueOnce(completion("still not json"))
      .mockResolvedValueOnce(completion(JSON.stringify(validSteps)));

    await regenerateSteps({
      title: "T",
      subject: "thermodynamics",
      topic: "Kinetic Theory",
      difficulty: "class_11",
      scenario: __TEST_EXAMPLES.EXAMPLE_CLASS_11.scenario,
      goal: __TEST_EXAMPLES.EXAMPLE_CLASS_11.goal,
      final_answer: __TEST_EXAMPLES.EXAMPLE_CLASS_11.final_answer,
    });

    expect(createMock).toHaveBeenCalledTimes(2);
    const secondMessages = createMock.mock.calls[1][0].messages;
    expect(secondMessages.length).toBeGreaterThan(2);
    expect(secondMessages[secondMessages.length - 1].content).toMatch(
      /previous attempt was REJECTED/i
    );
  });
});
