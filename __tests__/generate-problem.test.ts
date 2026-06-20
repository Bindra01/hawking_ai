import { describe, it, expect, vi } from "vitest";
import { validateAndNormalize } from "@/lib/generate-problem";

// Helper to generate wrong feedback meeting the 50-char minimum
function wrongFeedback(detail: string = "you misapplied the formula"): string {
  return `This is incorrect because ${detail}. You should review the correct approach and apply it carefully here.`;
}

// Helper to generate format feedback meeting the 40-char minimum
function longFeedback(detail: string = "this is the reasoning"): string {
  return `Here is the explanation: ${detail}, so review it carefully.`;
}

type Option = {
  text: string;
  correct: boolean;
  feedback: string;
  distractor_type?: "misconception" | "procedural_slip" | "half_right";
};

type ClaimData = {
  statement: string;
  isTrap: boolean;
  feedbackTrap: string;
  feedbackSound: string;
};

type MultiSelectData = {
  items: { text: string; matters: boolean }[];
  feedbackCorrect: string;
  feedbackWrong: string;
};

type BuildData = {
  tiles: string[];
  accepted: string[][];
  distractors: { tile: string; feedback: string }[];
  feedbackCorrect: string;
  feedbackWrong: string;
};

type Step = {
  type: string;
  format?: "mcq" | "claim" | "multiselect" | "build";
  label: string;
  icon: string;
  prompt: string;
  options?: Option[];
  claim?: ClaimData;
  multiselect?: MultiSelectData;
  build?: BuildData;
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

// ─── Per-format step factories ───────────────────────────────────────────────

// A valid MCQ step (principle/connect/why/sanity).
function makeMcqStep(type: string, prompt: string): Step {
  return {
    type,
    label: "STEP",
    icon: "⚡",
    prompt,
    options: [
      { text: "Correct answer choice", correct: true, feedback: "Yes, that is correct!" },
      { text: "Wrong answer one here", correct: false, feedback: wrongFeedback("you used the wrong units"), distractor_type: "misconception" as const },
      { text: "Wrong answer two here", correct: false, feedback: wrongFeedback("you confused velocity with acceleration"), distractor_type: "procedural_slip" as const },
      { text: "Wrong answer three here", correct: false, feedback: wrongFeedback("you applied a formula outside its valid range"), distractor_type: "half_right" as const },
    ],
    tip: "A useful rule of thumb",
  };
}

// A valid claim step (type "trap").
function makeClaimStep(prompt: string): Step {
  return {
    type: "trap",
    label: "SPOT THE TRAP",
    icon: "⚠️",
    prompt,
    claim: {
      statement: "This bold claim sounds plausible but is actually a trap",
      isTrap: true,
      feedbackTrap: longFeedback("you spotted the trap, this claim is indeed false"),
      feedbackSound: longFeedback("this is actually a trap, the claim does not hold"),
    },
    tip: "Watch out for traps",
  };
}

// A valid multiselect step (type "identify").
function makeMultiSelectStep(prompt: string): Step {
  return {
    type: "identify",
    label: "IDENTIFY THE KEY",
    icon: "🎯",
    prompt,
    multiselect: {
      items: [
        { text: "The temperature in Kelvin", matters: true },
        { text: "The molar mass of the gas", matters: true },
        { text: "The pressure of the sample", matters: false },
        { text: "The volume of the container", matters: false },
      ],
      feedbackCorrect: longFeedback("you picked exactly the quantities that matter"),
      feedbackWrong: longFeedback("only temperature and molar mass actually matter here"),
    },
    tip: "Lock in only what matters",
  };
}

// A valid build step (type "setup").
function makeBuildStep(prompt: string): Step {
  return {
    type: "setup",
    label: "SET UP THE MATH",
    icon: "🔧",
    prompt,
    build: {
      tiles: ["a", "=", "b", "x", "y"],
      accepted: [["a", "=", "b"]],
      distractors: [
        { tile: "x", feedback: longFeedback("the x tile does not belong in this equation") },
        { tile: "y", feedback: longFeedback("the y tile is an unrelated quantity here") },
      ],
      feedbackCorrect: longFeedback("you assembled the equation correctly"),
      feedbackWrong: longFeedback("rearrange the tiles to balance the relation"),
    },
    tip: "Balance the equation carefully",
  };
}

// Helper to create a valid problem for mutation in tests.
// Step layout: 0 principle (mcq), 1 trap (claim), 2 identify (multiselect),
// 3 setup (build), 4 connect (mcq), 5 sanity (mcq).
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
        makeMcqStep("principle", "Which physics framework should you reach for on this specific projectile problem?"),
        makeClaimStep("Your instinct is to ignore air resistance entirely here — sound right, or is that a trap?"),
        makeMultiSelectStep("Tap every quantity that actually controls the outcome of this throw."),
        makeBuildStep("Build the kinematic equation that relates the given quantities."),
        makeMcqStep("connect", "What's the key simplification that fast-tracks the solve here?"),
        makeMcqStep("sanity", "Does the final answer make physical sense given the setup?"),
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

  it("sets step.format canonically from the step type", () => {
    const problem = makeValidProblem();
    validateAndNormalize(problem, "mechanics", "Kinematics", "class_11");
    const steps = problem.solution_flow.steps;
    expect(steps[0].format).toBe("mcq"); // principle
    expect(steps[1].format).toBe("claim"); // trap
    expect(steps[2].format).toBe("multiselect"); // identify
    expect(steps[3].format).toBe("build"); // setup
    expect(steps[5].format).toBe("mcq"); // sanity
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
    const extraStep = makeMcqStep("connect", "Another connecting step with a sufficiently long prompt here.");
    // 6 + 2 = 8 steps
    problem.solution_flow.steps.splice(4, 0, extraStep, { ...extraStep });
    expect(problem.solution_flow.steps.length).toBe(8);
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Expected 4-7 steps, got 8");
  });

  it("throws when last step is not sanity", () => {
    const problem = makeValidProblem();
    const steps = problem.solution_flow.steps;
    steps[steps.length - 1] = makeMcqStep("connect", "A connect step standing in for the final step here.");
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('Last step must be type "sanity"');
  });

  it("throws when step.type is invalid", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].type = "bogus";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('invalid type "bogus"');
  });

  it("throws when step.format conflicts with its type", () => {
    const problem = makeValidProblem();
    // principle => mcq, but claim is supplied
    problem.solution_flow.steps[0].format = "claim";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('conflicts with type');
  });

  // ─── Hook gate ────────────────────────────────────────────────────────────

  it("throws when the first step's prompt is below 40 chars (hook gate)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].prompt = "Too short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("hook");
  });

  it("does not apply the hook gate to non-first steps", () => {
    const problem = makeValidProblem();
    // step 4 is an mcq connect step; short prompt should be fine (>0 chars)
    problem.solution_flow.steps[4].prompt = "Short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("accepts a non-trap 'key' opener (identify) that passes the hook gate", () => {
    // Opener policy: a problem may open on the KEY (identify/principle) rather
    // than a trap. A substantial identify opener must satisfy the hook gate.
    const problem = makeValidProblem();
    problem.solution_flow.steps[0] = makeMultiSelectStep(
      "Before reaching for any equation, tap every quantity that actually controls the outcome of this problem."
    );
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
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
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which framework should you reach for on this specific problem?"),
      makeClaimStep("Is the claim about ignoring friction sound, or is it a trap on this one?"),
      makeMultiSelectStep("Tap every quantity that actually controls the outcome here."),
      makeMcqStep("sanity", "Does the final answer make physical sense given the setup?"),
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("accepts a problem with exactly 7 steps (maximum)", () => {
    const problem = makeValidProblem();
    const extra = makeMcqStep("why", "Why does this result make physical sense for this configuration?");
    problem.solution_flow.steps.splice(4, 0, extra);
    expect(problem.solution_flow.steps.length).toBe(7);
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  // ─── MCQ: 4 options / exactly 1 correct ───────────────────────────────────

  it("throws when an mcq step has wrong number of options (2 instead of 4)", () => {
    const problem = makeValidProblem();
    // step 0 is principle (mcq)
    problem.solution_flow.steps[0].options = [
      { text: "A correct option", correct: true, feedback: "Yes, that is correct!" },
      { text: "B wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 0 must have exactly 4 options, got 2");
  });

  it("throws when an mcq step has 5 options", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[4].options = [
      { text: "A correct option", correct: true, feedback: "Yes, that is correct!" },
      { text: "B wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
      { text: "C wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "procedural_slip" as const },
      { text: "D wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "half_right" as const },
      { text: "E wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 4 must have exactly 4 options, got 5");
  });

  it("throws when an mcq step has zero correct options", () => {
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

  it("throws when an mcq step has multiple correct options", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[4].options = [
      { text: "A correct option", correct: true, feedback: "Yes, that is correct!" },
      { text: "B correct option", correct: true, feedback: "Yes, that is also correct!" },
      { text: "C wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "misconception" as const },
      { text: "D wrong option here", correct: false, feedback: wrongFeedback(), distractor_type: "procedural_slip" as const },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Step 4 must have exactly 1 correct option, got 2");
  });

  it("throws when an mcq wrong option feedback is below 50 chars", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options![1] = {
      text: "Wrong answer choice",
      correct: false,
      feedback: "Too short feedback, not enough detail.",
      distractor_type: "misconception" as const,
    };
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("wrong option with feedback below 50 chars");
  });

  it("accepts correct feedback at exactly 20 chars", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options![0] = {
      text: "Correct answer choice",
      correct: true,
      feedback: "Right, well done!!!!", // 20 chars
    };
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("throws when an mcq correct option feedback is below 20 chars", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[0].options![0] = {
      text: "Correct answer choice",
      correct: true,
      feedback: "Yes! Good job!!", // 15 chars — passes general check but below 20
    };
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("correct option with feedback below 20 chars");
  });

  it("warns but does not throw when distractor_type is missing on an mcq wrong option", () => {
    const problem = makeValidProblem();
    const wrongOpt = problem.solution_flow.steps[0].options![1];
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

  it("warns but does not throw when mcq option text lengths are imbalanced (3x ratio)", () => {
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

  // ─── claim ────────────────────────────────────────────────────────────────

  it("accepts a valid claim step", () => {
    const problem = makeValidProblem();
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
    expect(problem.solution_flow.steps[1].claim).toBeDefined();
  });

  it("throws when claim object is missing on a trap step", () => {
    const problem = makeValidProblem();
    delete problem.solution_flow.steps[1].claim;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('missing required "claim" object');
  });

  it("throws when claim.statement is missing/too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].claim!.statement = "too short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("claim.statement must be at least 15 chars");
  });

  it("throws when claim.isTrap is not a boolean", () => {
    const problem = makeValidProblem();
    (problem.solution_flow.steps[1].claim as Record<string, unknown>).isTrap = "yes";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("claim.isTrap must be a boolean");
  });

  it("throws when claim.feedbackTrap is missing/too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].claim!.feedbackTrap = "short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("claim.feedbackTrap must be at least 40 chars");
  });

  it("throws when claim.feedbackSound is missing/too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].claim!.feedbackSound = "short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("claim.feedbackSound must be at least 40 chars");
  });

  // ─── multiselect ───────────────────────────────────────────────────────────

  it("accepts a valid multiselect step", () => {
    const problem = makeValidProblem();
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
    expect(problem.solution_flow.steps[2].multiselect).toBeDefined();
  });

  it("throws when multiselect object is missing on an identify step", () => {
    const problem = makeValidProblem();
    delete problem.solution_flow.steps[2].multiselect;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('missing required "multiselect" object');
  });

  it("throws when all multiselect items matter", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[2].multiselect!.items.forEach((it) => (it.matters = true));
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("at least 1 item with matters:false");
  });

  it("throws when no multiselect items matter", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[2].multiselect!.items.forEach((it) => (it.matters = false));
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("at least 1 item with matters:true");
  });

  it("throws when multiselect has fewer than 4 items", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[2].multiselect!.items = [
      { text: "Matters one", matters: true },
      { text: "Does not matter", matters: false },
      { text: "Matters two", matters: true },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("must have 4-6 items, got 3");
  });

  it("throws when multiselect has more than 6 items", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[2].multiselect!.items = [
      { text: "Item one", matters: true },
      { text: "Item two", matters: false },
      { text: "Item three", matters: true },
      { text: "Item four", matters: false },
      { text: "Item five", matters: true },
      { text: "Item six", matters: false },
      { text: "Item seven", matters: false },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("must have 4-6 items, got 7");
  });

  it("throws when multiselect.feedbackCorrect is too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[2].multiselect!.feedbackCorrect = "short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("multiselect.feedbackCorrect must be at least 40 chars");
  });

  // ─── build ──────────────────────────────────────────────────────────────────

  it("accepts a valid build step", () => {
    const problem = makeValidProblem();
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
    expect(problem.solution_flow.steps[3].build).toBeDefined();
  });

  it("throws when build object is missing on a setup step", () => {
    const problem = makeValidProblem();
    delete problem.solution_flow.steps[3].build;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('missing required "build" object');
  });

  it("throws when build.tiles has a duplicate tile", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.tiles = ["a", "=", "b", "a", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("duplicate tile");
  });

  it("throws when an accepted token is not in tiles", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.accepted = [["a", "=", "z"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('references token "z" not in tiles');
  });

  it("throws when an accepted arrangement repeats a tile", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.accepted = [["a", "=", "a"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('repeats token "a"');
  });

  it("throws when an accepted arrangement is too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.accepted = [["a"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("arrangement must have length >= 2");
  });

  it("throws when accepted is empty", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.accepted = [];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("build.accepted must be a non-empty array");
  });

  it("throws when distractors is empty", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.distractors = [];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("build.distractors must have at least 1 entry");
  });

  it("throws when a distractor tile is not in tiles", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.distractors = [
      { tile: "zzz", feedback: longFeedback("this tile is not even in the tray") },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('tile "zzz" not in tiles');
  });

  it("throws when a distractor tile also appears in an accepted arrangement", () => {
    const problem = makeValidProblem();
    // "a" is part of the accepted arrangement ["a","=","b"]
    problem.solution_flow.steps[3].build!.distractors = [
      { tile: "a", feedback: longFeedback("a is actually part of the correct answer") },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('also appears in an accepted arrangement');
  });

  it("throws when a distractor feedback is below 30 chars", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.distractors = [
      { tile: "x", feedback: "too short" },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("build.distractors feedback must be at least 30 chars");
  });

  it("throws when build.feedbackWrong is too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.feedbackWrong = "short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("build.feedbackWrong must be at least 40 chars");
  });

  it("throws when a build tile is a complete equation (content on both sides of '=')", () => {
    const problem = makeValidProblem();
    // Each tile is a whole, already-assembled equation -> nothing to arrange.
    problem.solution_flow.steps[3].build!.tiles = ["$F = ma$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("throws when a build tile is a partial relation (content on only one side of '=')", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.tiles = ["$F =$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("throws when a build tile is a complete inequality relation (\\leq with both sides)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.tiles = ["$v \\leq c$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("throws when a build tile is a complete Unicode inequality (≠ with both sides)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.tiles = ["$x \u2260 0$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("allows a bare '=' separator tile (relation operator alone)", () => {
    const problem = makeValidProblem();
    // The only relation-bearing tile here is the bare "=" separator; it must
    // NOT be rejected by the embedded-relation guard.
    problem.solution_flow.steps[3].build!.tiles = ["$2kr$", "=", "$mv^2/r$", "x", "y"];
    problem.solution_flow.steps[3].build!.accepted = [["$2kr$", "=", "$mv^2/r$"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("allows a fragment tile with a relation nested inside a subscript/argument", () => {
    const problem = makeValidProblem();
    // "$E_{x=0}$" and "$v(t=0)$" carry "=" only INSIDE braces/parens — they are
    // single atomic terms (evaluation conditions), not assembled relations.
    problem.solution_flow.steps[3].build!.tiles = ["$E_{x=0}$", "=", "$v(t=0)$", "x", "y"];
    problem.solution_flow.steps[3].build!.accepted = [["$E_{x=0}$", "=", "$v(t=0)$"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("throws when a whole equation is wrapped in plain parentheses", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.tiles = ["$(F = ma)$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("throws when a whole equation is wrapped in \\left( ... \\right)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.tiles = ["$\\left(F = ma\\right)$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("allows a brace-grouped atomic condition tile (braces are grouping, not equation-wrapping)", () => {
    const problem = makeValidProblem();
    // "{x=0}" is a single grouped condition term; bare braces must NOT be
    // unwrapped and rejected as a top-level relation.
    problem.solution_flow.steps[3].build!.tiles = ["${x=0}$", "=", "$kr$", "x", "y"];
    problem.solution_flow.steps[3].build!.accepted = [["${x=0}$", "=", "$kr$"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("throws when a build tile is a complete \\leqslant inequality", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.tiles = ["$v \\leqslant c$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("does not mistake the LaTeX command \\left for the relation \\le", () => {
    const problem = makeValidProblem();
    // "\left." starts with "\le" but is NOT a relation operator.
    problem.solution_flow.steps[3].build!.tiles = [
      "$\\left.\\frac{dV}{dr}\\right|_{r=R}$",
      "=",
      "$kr$",
      "x",
      "y",
    ];
    problem.solution_flow.steps[3].build!.accepted = [
      ["$\\left.\\frac{dV}{dr}\\right|_{r=R}$", "=", "$kr$"],
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("accepts LaTeX-wrapped fragment tiles that contain no relation operator", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].build!.tiles = [
      "$2kr$",
      "=",
      "$\\frac{mv^2}{r}$",
      "$\\frac{GMm}{r^2}$",
      "$kr$",
    ];
    problem.solution_flow.steps[3].build!.accepted = [["$2kr$", "=", "$\\frac{mv^2}{r}$"]];
    problem.solution_flow.steps[3].build!.distractors = [
      { tile: "$\\frac{GMm}{r^2}$", feedback: longFeedback("there is no gravitational term here") },
      { tile: "$kr$", feedback: longFeedback("you dropped the factor of 2 from the derivative") },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("throws when a build tile is unused in any accepted arrangement and has no distractor", () => {
    const problem = makeValidProblem();
    // Add an extra tile that is neither in an accepted arrangement nor a distractor.
    problem.solution_flow.steps[3].build!.tiles.push("orphan");
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('build tile "orphan" is unused');
  });

  it("throws when an mcq option has a non-boolean correct field", () => {
    const problem = makeValidProblem();
    // LLM emits "true" as a string instead of a boolean.
    (problem.solution_flow.steps[0].options![1] as { correct: unknown }).correct =
      "true";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('non-boolean "correct" field');
  });

  it("throws when a step carries a stale content field from another format", () => {
    const problem = makeValidProblem();
    // A trap step (claim) that still has leftover MCQ options.
    problem.solution_flow.steps[1].options = [
      { text: "Leftover option", correct: true, feedback: "stale feedback here" },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('stale "options" field');
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
