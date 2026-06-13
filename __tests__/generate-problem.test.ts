import { describe, it, expect, vi } from "vitest";
import { validateAndNormalize } from "@/lib/generate-problem";

// Helper to generate wrong feedback meeting the 50-char minimum
function wrongFeedback(detail: string = "you misapplied the formula"): string {
  return `This is incorrect because ${detail}. You should review the correct approach and apply it carefully here.`;
}

type Option = {
  text: string;
  correct: boolean;
  feedback: string;
  distractor_type?: "misconception" | "procedural_slip" | "half_right";
};

type Step = {
  type: string;
  label: string;
  icon: string;
  prompt: string;
  options: Option[];
  tip: string;
};

type TestProblem = {
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  scenario: string;
  goal: string;
  final_answer: string;
  diagram_type: null;
  solution_flow: { steps: Step[] };
};

// Helper to create a valid problem for mutation in tests
function makeValidProblem(): TestProblem {
  return {
    title: "Test Problem",
    subject: "mechanics",
    topic: "Kinematics",
    difficulty: "class_11",
    scenario: "A ball is thrown...",
    goal: "Find: 10 m/s",
    final_answer: "10 m/s",
    diagram_type: null as null,
    solution_flow: {
      steps: [
        {
          type: "trap",
          label: "SPOT THE TRAP",
          icon: "⚠️",
          prompt: "What is the trap?",
          options: [
            { text: "Correct answer choice", correct: true, feedback: "Yes, that is correct!" },
            { text: "Wrong answer one here", correct: false, feedback: wrongFeedback("you used the wrong units"), distractor_type: "misconception" as const },
            { text: "Wrong answer two here", correct: false, feedback: wrongFeedback("you confused velocity with acceleration"), distractor_type: "procedural_slip" as const },
            { text: "Wrong answer three here", correct: false, feedback: wrongFeedback("you applied a formula outside its valid range"), distractor_type: "half_right" as const },
          ],
          tip: "Watch out for traps",
        },
        {
          type: "setup",
          label: "SET UP",
          icon: "🔧",
          prompt: "Set up the equation",
          options: [
            { text: "Correct answer choice", correct: true, feedback: "Yes, that is correct!" },
            { text: "Wrong answer one here", correct: false, feedback: wrongFeedback("you set up the equation incorrectly"), distractor_type: "misconception" as const },
            { text: "Wrong answer two here", correct: false, feedback: wrongFeedback("you forgot to include the angle"), distractor_type: "half_right" as const },
            { text: "Wrong answer three here", correct: false, feedback: wrongFeedback("you used the wrong coordinate system"), distractor_type: "procedural_slip" as const },
          ],
          tip: "Be careful",
        },
        {
          type: "connect",
          label: "CONNECT",
          icon: "🧩",
          prompt: "Connect the dots",
          options: [
            { text: "Correct answer choice", correct: true, feedback: "Yes, that is correct!" },
            { text: "Wrong answer one here", correct: false, feedback: wrongFeedback("you missed the connection between equations"), distractor_type: "half_right" as const },
            { text: "Wrong answer two here", correct: false, feedback: wrongFeedback("you applied the wrong simplification"), distractor_type: "procedural_slip" as const },
            { text: "Wrong answer three here", correct: false, feedback: wrongFeedback("you forgot to account for the boundary condition"), distractor_type: "misconception" as const },
          ],
          tip: "Link ideas",
        },
        {
          type: "identify",
          label: "IDENTIFY",
          icon: "🎯",
          prompt: "What is the answer?",
          options: [
            { text: "Correct answer choice", correct: true, feedback: "Yes, that is correct!" },
            { text: "Wrong answer one here", correct: false, feedback: wrongFeedback("you identified the wrong variable as key"), distractor_type: "misconception" as const },
            { text: "Wrong answer two here", correct: false, feedback: wrongFeedback("you misread the problem constraints"), distractor_type: "procedural_slip" as const },
            { text: "Wrong answer three here", correct: false, feedback: wrongFeedback("you confused the dependent and independent variables"), distractor_type: "half_right" as const },
          ],
          tip: "Lock it in",
        },
        {
          type: "sanity",
          label: "SANITY CHECK",
          icon: "🧪",
          prompt: "Does this make sense?",
          options: [
            { text: "Correct answer choice", correct: true, feedback: "Yes, that is correct!" },
            { text: "Wrong answer one here", correct: false, feedback: wrongFeedback("the units don't match your conclusion"), distractor_type: "misconception" as const },
            { text: "Wrong answer two here", correct: false, feedback: wrongFeedback("the order of magnitude is way off"), distractor_type: "half_right" as const },
            { text: "Wrong answer three here", correct: false, feedback: wrongFeedback("the limiting case behavior is incorrect"), distractor_type: "procedural_slip" as const },
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
    const extraStep = { ...problem.solution_flow.steps[0] };
    // Add 3 more steps to get to 8
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
    ).toThrow('Last step must be type "sanity"');
  });

  it("throws when a step has wrong number of options (2 instead of 4)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options = [
      { text: "A correct option", correct: true, feedback: "Yes, that is correct!" },
      { text: "B wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 0 must have exactly 4 options, got 2");
  });

  it("throws when a step has 5 options", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].options = [
      { text: "A correct option", correct: true, feedback: "Yes, that is correct!" },
      { text: "B wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
      { text: "C wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "procedural_slip" as const },
      { text: "D wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "half_right" as const },
      { text: "E wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 1 must have exactly 4 options, got 5");
  });

  it("throws when a step has 3 options (too few)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].options = [
      { text: "A correct option", correct: true, feedback: "Yes, that is correct!" },
      { text: "B wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
      { text: "C wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "procedural_slip" as const },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 1 must have exactly 4 options, got 3");
  });

  it("throws when a step has zero correct options", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options = [
      { text: "A wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
      { text: "B wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "procedural_slip" as const },
      { text: "C wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "half_right" as const },
      { text: "D wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 0 must have exactly 1 correct option, got 0");
  });

  it("throws when a step has multiple correct options", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[2].options = [
      { text: "A correct option", correct: true, feedback: "Yes, that is correct!" },
      { text: "B correct option", correct: true, feedback: "Yes, that is also correct!" },
      { text: "C wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
      { text: "D wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "procedural_slip" as const },
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

  // ─── Wrong feedback minimum 50 chars ──────────────────────────────────────

  it("throws when wrong option feedback is below 50 chars", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options[1] = {
      text: "Wrong answer choice",
      correct: false,
      feedback: "Too short feedback, not enough detail.",
      distractor_type: "misconception" as const,
    };
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("wrong option with feedback below 50 chars");
  });

  // ─── Correct feedback minimum 20 chars ────────────────────────────────────

  it("accepts correct feedback at exactly 20 chars", () => {
    const problem = makeValidProblem();
    // "Right, well done!!!" is exactly 20 chars (with padding)
    problem.solution_flow.steps[0].options[0] = {
      text: "Correct answer choice",
      correct: true,
      feedback: "Right, well done!!!!",  // 20 chars
    };
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("throws when correct option feedback is below 20 chars", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options[0] = {
      text: "Correct answer choice",
      correct: true,
      feedback: "Yes! Good job!!",  // 15 chars — passes general check but below 20
    };
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("correct option with feedback below 20 chars");
  });

  // ─── distractor_type warnings (no throw) ──────────────────────────────────

  it("warns but does not throw when distractor_type is missing on wrong option", () => {
    const problem = makeValidProblem();
    // Remove distractor_type from a wrong option
    const wrongOpt = problem.solution_flow.steps[0].options[1];
    delete (wrongOpt as Record<string, unknown>).distractor_type;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing distractor_type")
    );

    warnSpy.mockRestore();
  });

  // ─── Option text length imbalance warnings (no throw) ─────────────────────

  it("warns but does not throw when option text lengths are imbalanced (3x ratio)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options = [
      { text: "Short", correct: true, feedback: "Yes, that is correct!" },
      { text: "This is a much much much much much much much longer wrong option answer text", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
      { text: "Medium wrong answer", correct: false, feedback: wrongFeedback(), distractor_type: "procedural_slip" as const },
      { text: "Another medium wrong", correct: false, feedback: wrongFeedback(), distractor_type: "half_right" as const },
    ];

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("option text length imbalance")
    );

    warnSpy.mockRestore();
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
