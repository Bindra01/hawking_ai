import { describe, it, expect } from "vitest";
import { validateAndNormalize } from "@/lib/generate-problem";

// Helper to create a valid problem for mutation in tests
function makeValidProblem() {
  return {
    title: "Test Problem",
    subject: "mechanics",
    topic: "Kinematics",
    difficulty: "class_11",
    scenario: "A ball is thrown...",
    goal: "Find: 10 m/s",
    final_answer: "10 m/s",
    diagram_type: null,
    solution_flow: {
      steps: [
        {
          type: "trap",
          label: "SPOT THE TRAP",
          icon: "⚠️",
          prompt: "What is the trap?",
          options: [
            { text: "Correct", correct: true, feedback: "Yes!" },
            { text: "Wrong 1", correct: false, feedback: "No" },
            { text: "Wrong 2", correct: false, feedback: "No" },
          ],
          tip: "Watch out for traps",
        },
        {
          type: "setup",
          label: "SET UP",
          icon: "🔧",
          prompt: "Set up the equation",
          options: [
            { text: "Correct", correct: true, feedback: "Yes!" },
            { text: "Wrong 1", correct: false, feedback: "No" },
            { text: "Wrong 2", correct: false, feedback: "No" },
          ],
          tip: "Be careful",
        },
        {
          type: "connect",
          label: "CONNECT",
          icon: "🧩",
          prompt: "Connect the dots",
          options: [
            { text: "Correct", correct: true, feedback: "Yes!" },
            { text: "Wrong 1", correct: false, feedback: "No" },
            { text: "Wrong 2", correct: false, feedback: "No" },
          ],
          tip: "Link ideas",
        },
        {
          type: "identify",
          label: "IDENTIFY",
          icon: "🎯",
          prompt: "What is the answer?",
          options: [
            { text: "Correct", correct: true, feedback: "Yes!" },
            { text: "Wrong 1", correct: false, feedback: "No" },
            { text: "Wrong 2", correct: false, feedback: "No" },
          ],
          tip: "Lock it in",
        },
        {
          type: "sanity",
          label: "SANITY CHECK",
          icon: "🧪",
          prompt: "Does this make sense?",
          options: [
            { text: "Correct", correct: true, feedback: "Yes!" },
            { text: "Wrong 1", correct: false, feedback: "No" },
            { text: "Wrong 2", correct: false, feedback: "No" },
          ],
          tip: "Always check",
        },
      ],
    },
  };
}

describe("validateAndNormalize", () => {
  it("accepts a valid problem without throwing", () => {
    const problem = makeValidProblem();
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("normalizes subject/topic/difficulty to match the request", () => {
    const problem = makeValidProblem();
    // LLM might return different casing or values
    problem.subject = "Mechanics";
    problem.topic = "kinematics";
    problem.difficulty = "Class 11";

    validateAndNormalize(problem, "electrodynamics", "Magnetism", "college");

    expect(problem.subject).toBe("electrodynamics");
    expect(problem.topic).toBe("Magnetism");
    expect(problem.difficulty).toBe("college");
    expect(problem.diagram_type).toBeNull();
  });

  it("throws when title is missing", () => {
    const problem = makeValidProblem();
    delete (problem as Record<string, unknown>).title;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("missing required field: title");
  });

  it("throws when scenario is missing", () => {
    const problem = makeValidProblem();
    delete (problem as Record<string, unknown>).scenario;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("missing required field: scenario");
  });

  it("throws when solution_flow is missing", () => {
    const problem = makeValidProblem();
    delete (problem as Record<string, unknown>).solution_flow;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("missing required field: solution_flow");
  });

  it("throws when there are too few steps (< 4)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps = problem.solution_flow.steps.slice(0, 3);
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Expected 4-7 steps, got 3");
  });

  it("throws when there are too many steps (> 7)", () => {
    const problem = makeValidProblem();
    // Add 3 more steps to get to 8
    const extraStep = { ...problem.solution_flow.steps[0] };
    problem.solution_flow.steps.push(extraStep, extraStep, extraStep);
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Expected 4-7 steps, got 8");
  });

  it("throws when last step is not sanity", () => {
    const problem = makeValidProblem();
    const steps = problem.solution_flow.steps;
    steps[steps.length - 1] = { ...steps[steps.length - 1], type: "trap" };
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Last step must be type 'sanity'");
  });

  it("throws when a step has wrong number of options (2 instead of 3)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options = [
      { text: "A", correct: true, feedback: "Yes" },
      { text: "B", correct: false, feedback: "No" },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 0 must have exactly 3 options, got 2");
  });

  it("throws when a step has 4 options", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].options = [
      { text: "A", correct: true, feedback: "Yes" },
      { text: "B", correct: false, feedback: "No" },
      { text: "C", correct: false, feedback: "No" },
      { text: "D", correct: false, feedback: "No" },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 1 must have exactly 3 options, got 4");
  });

  it("throws when a step has zero correct options", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options = [
      { text: "A", correct: false, feedback: "No" },
      { text: "B", correct: false, feedback: "No" },
      { text: "C", correct: false, feedback: "No" },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 0 must have exactly 1 correct option, got 0");
  });

  it("throws when a step has multiple correct options", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[2].options = [
      { text: "A", correct: true, feedback: "Yes" },
      { text: "B", correct: true, feedback: "Yes" },
      { text: "C", correct: false, feedback: "No" },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 2 must have exactly 1 correct option, got 2");
  });

  it("throws when a step is missing prompt", () => {
    const problem = makeValidProblem();
    delete (problem.solution_flow.steps[0] as Record<string, unknown>).prompt;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 0 missing required fields");
  });

  it("throws when a step is missing tip", () => {
    const problem = makeValidProblem();
    delete (problem.solution_flow.steps[0] as Record<string, unknown>).tip;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 0 missing required fields");
  });

  it("accepts a problem with exactly 4 steps (minimum)", () => {
    const problem = makeValidProblem();
    // Keep first 3 + sanity (last)
    problem.solution_flow.steps = [
      problem.solution_flow.steps[0],
      problem.solution_flow.steps[1],
      problem.solution_flow.steps[2],
      problem.solution_flow.steps[4], // sanity
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("accepts a problem with exactly 7 steps (maximum)", () => {
    const problem = makeValidProblem();
    const extraStep = { ...problem.solution_flow.steps[0] };
    // Insert 2 extra steps before the sanity step
    problem.solution_flow.steps.splice(4, 0, extraStep, extraStep);
    expect(problem.solution_flow.steps.length).toBe(7);
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });
});

describe("XP calculation", () => {
  it("calculates XP correctly", async () => {
    const { calcXP, calcStars } = await import("@/lib/xp");

    // All correct: 5 * 20 + 30 bonus = 130
    expect(calcXP(5, 5)).toBe(130);

    // 3 of 5 correct: 3*20 + 2*5 = 70
    expect(calcXP(3, 5)).toBe(70);

    // 0 correct: 0*20 + 5*5 = 25
    expect(calcXP(0, 5)).toBe(25);

    // Stars: >= 80% = 3, >= 50% = 2, else 1
    expect(calcStars(5, 5)).toBe(3); // 100%
    expect(calcStars(4, 5)).toBe(3); // 80%
    expect(calcStars(3, 5)).toBe(2); // 60%
    expect(calcStars(2, 5)).toBe(1); // 40% < 50% = 1 star
    expect(calcStars(1, 5)).toBe(1); // 20%
  });
});
