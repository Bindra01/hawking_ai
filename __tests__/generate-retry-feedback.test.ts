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
    const badPredictProblem = JSON.parse(
      JSON.stringify({
        title: "T",
        subject: "electrodynamics",
        topic: "Displacement Current",
        difficulty: "college",
        scenario: __TEST_EXAMPLES.EXAMPLE_CLASS_11.scenario,
        goal: __TEST_EXAMPLES.EXAMPLE_CLASS_11.goal,
        final_answer: "$I_d = I$",
        diagram_type: null,
        solution_flow: __TEST_EXAMPLES.EXAMPLE_CLASS_11.solution_flow,
      })
    );
    // Mutate the terminal form step into a single-variable predict contract.
    const badSteps = badPredictProblem.solution_flow.steps;
    const form = badSteps[badSteps.length - 1];
    delete form.build;
    form.predict = {
      target: "I_d",
      correctFormula: "$I_d = I$",
      variables: [{ symbol: "I", label: "the current", role: "numerator" }],
    };

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
      .mockResolvedValueOnce(completion(JSON.stringify(badPredictProblem)))
      .mockResolvedValueOnce(completion(JSON.stringify(validProblem)));

    await generateProblem("electrodynamics", "Displacement Current", "college");

    expect(createMock).toHaveBeenCalledTimes(2);
    const secondMessages = createMock.mock.calls[1][0].messages;
    const correction = secondMessages[secondMessages.length - 1].content as string;
    // Echoes the exact validation error the model must fix.
    expect(correction).toMatch(/must have 2-8 entries, got 1/);
    // Names the too-few-variables predict-ineligibility reason.
    expect(correction).toMatch(/fewer than 2 distinct free physical quantities/i);
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
