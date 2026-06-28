import { describe, it, expect, vi } from "vitest";
import { validateAndNormalize, __TEST_EXAMPLES } from "@/lib/generate-problem";

// Helper to generate wrong feedback meeting the 50-char minimum
function wrongFeedback(detail: string = "you misapplied the formula"): string {
  return `This is incorrect because ${detail}. You should review the correct approach and apply it carefully here.`;
}

// Helper to generate neutral form-step feedback (non-committal, no banned words).
// Used in makeFormStep() to satisfy the terminal-form sanitizer/length checks.
function neutralFormFeedback(detail: string = "the form you assembled"): string {
  return `You've assembled ${detail}; the recap below carries the structure through to the final value without it being computed here.`;
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

type EquationContract = {
  lhs_terms: string[];
  relation: string;
  rhs_terms: string[];
  distractor_terms: { term: string; feedback: string }[];
};

type BuildData = {
  tiles?: string[];
  accepted?: string[][];
  distractors?: { tile: string; feedback: string }[];
  equation?: EquationContract;
  moves?: string[];
  distractor_moves?: { move: string; feedback: string }[];
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

// A valid approach step (type "approach"). Same mcq shape as makeMcqStep but
// typed "approach" (PLAN THE DERIVATION — a conceptual strategy choice).
function makeApproachStep(prompt: string): Step {
  return {
    type: "approach",
    label: "PLAN THE DERIVATION",
    icon: "🧭",
    prompt,
    options: [
      { text: "Correct strategy choice", correct: true, feedback: "Yes, that is the cleanest next move!" },
      { text: "Wrong strategy one here", correct: false, feedback: wrongFeedback("you picked a detour that does not simplify the algebra"), distractor_type: "misconception" as const },
      { text: "Wrong strategy two here", correct: false, feedback: wrongFeedback("you reached for a method that does not apply in this regime"), distractor_type: "procedural_slip" as const },
      { text: "Wrong strategy three here", correct: false, feedback: wrongFeedback("you chose an approach that adds steps without progress"), distractor_type: "half_right" as const },
    ],
    tip: "Plan the cleanest route to the answer",
  };
}

// A valid solve step (type "solve"). RETIRED from generation (legacy-only hard
// block) but kept here ONLY for the "rejects generated solve" test, which places
// it in a NON-terminal position of an otherwise form-terminal flow.
function makeSolveStep(prompt: string): Step {
  return {
    type: "solve",
    label: "PREDICT THE FORM",
    icon: "🔮",
    prompt,
    options: [
      { text: "10 m/s", correct: true, feedback: "Given the form you predicted, the derivation in the recap lands at the value the setup pointed toward." },
      { text: "Wrong answer one here", correct: false, feedback: longFeedback("a form with different units than the setup implies, which the recap resolves cleanly"), distractor_type: "misconception" as const },
      { text: "Wrong answer two here", correct: false, feedback: longFeedback("a velocity-acceleration mix that the recap resolves on the way to the value"), distractor_type: "procedural_slip" as const },
      { text: "Wrong answer three here", correct: false, feedback: longFeedback("a form outside the valid range the approach established earlier in the chain"), distractor_type: "half_right" as const },
    ],
    tip: "Predict the form the final answer takes before computing",
  };
}

// A valid depends step (type "depends", WHAT IT INVOLVES — multiselect). Asks
// which quantities the answer actually involves vs same-family red herrings.
function makeDependsStep(prompt: string): Step {
  return {
    type: "depends",
    label: "WHAT IT INVOLVES",
    icon: "🎛️",
    prompt,
    multiselect: {
      items: [
        { text: "The angular momentum L", matters: true },
        { text: "The particle mass m", matters: true },
        { text: "The gravitational constant G", matters: false },
        { text: "The elapsed time t", matters: false },
      ],
      feedbackCorrect: longFeedback("only the quantities that genuinely set the answer's form belong here"),
      feedbackWrong: longFeedback("the red-herring symbols come from a different law and never enter this answer"),
    },
    tip: "List only the symbols the answer truly involves",
  };
}

// A valid scale step (type "scale", HOW IT SCALES — mcq). Exponent reasoning, no
// arithmetic. Correct option is a proportionality form, not a number.
function makeScaleStep(prompt: string): Step {
  return {
    type: "scale",
    label: "HOW IT SCALES",
    icon: "📈",
    prompt,
    options: [
      { text: "r ∝ L^{1/2}", correct: true, feedback: "Yes — from r⁴ ∝ L², the fourth root gives the half-power scaling." },
      { text: "r ∝ L²", correct: false, feedback: wrongFeedback("you read the exponent of r⁴ rather than r, so the fourth root was skipped here"), distractor_type: "procedural_slip" as const },
      { text: "r ∝ L", correct: false, feedback: wrongFeedback("linear scaling skips the fourth root that pulls the exponent down to one half"), distractor_type: "half_right" as const },
      { text: "r ∝ 1/L", correct: false, feedback: wrongFeedback("an inverse dependence points the wrong way; the radius grows with angular momentum"), distractor_type: "misconception" as const },
    ],
    tip: "Read the exponent off the power relation, not off arithmetic",
  };
}

// A valid limit step (type "limit", CHECK THE EXTREME — claim). Sounds-right vs
// it's-a-trap about a limiting case.
function makeLimitStep(prompt: string): Step {
  return {
    type: "limit",
    label: "CHECK THE EXTREME",
    icon: "🔭",
    prompt,
    claim: {
      statement: "Push the stiffness to infinity and the orbit grows without bound",
      isTrap: true,
      feedbackTrap: longFeedback("you spotted it — the orbit actually shrinks as the well stiffens, so this is a trap"),
      feedbackSound: longFeedback("this is actually a trap, since a stiffer well pulls the orbit inward, not outward"),
    },
    tip: "Send a parameter to its extreme and check the trend",
  };
}

// A valid roadmap step (type "roadmap", MAP THE DERIVATION — build SPINE).
// Emits the `moves` contract; CODE assembles the tiles/accepted ordering.
function makeRoadmapStep(prompt: string): Step {
  return {
    type: "roadmap",
    label: "MAP THE DERIVATION",
    icon: "🗺️",
    prompt,
    build: {
      moves: [
        "Split the motion into horizontal and vertical components",
        "Impose the return-to-ground condition to time the flight",
      ],
      distractor_moves: [
        { move: "Find the range before the time of flight", feedback: "The range needs the flight time first, so this move runs out of order and cannot land the distance." },
        { move: "Hold the vertical velocity constant through the flight", feedback: "Gravity changes the vertical velocity each instant, so treating it as constant breaks the timing move entirely." },
      ],
      feedbackCorrect: longFeedback("the moves are sequenced the way an expert would chain them"),
      feedbackWrong: longFeedback("resolve the velocity first, then impose the return-to-ground condition"),
    },
    tip: "Sequence the high-level moves before touching algebra",
  };
}

// A valid feeds step (type "feeds", WHAT GOES IN — multiselect). Tap the inputs a
// move consumes; leave same-family red herrings.
function makeFeedsStep(prompt: string): Step {
  return {
    type: "feeds",
    label: "WHAT GOES IN",
    icon: "🔌",
    prompt,
    multiselect: {
      items: [
        { text: "The launch speed v", matters: true },
        { text: "The launch angle theta", matters: true },
        { text: "The gravitational acceleration g", matters: true },
        { text: "The mass of the projectile", matters: false },
      ],
      feedbackCorrect: longFeedback("only the quantities the move truly consumes belong here"),
      feedbackWrong: longFeedback("mass never enters projectile range; the move uses only speed, angle, and gravity"),
    },
    tip: "Tap only the inputs the move actually consumes",
  };
}

// A valid produces step (type "produces", WHAT IT PRODUCES — claim). A
// sounds-right vs it's-a-trap recognition claim about a move's output.
function makeProducesStep(prompt: string): Step {
  return {
    type: "produces",
    label: "WHAT IT PRODUCES",
    icon: "🔎",
    prompt,
    claim: {
      statement: "Solving the equation hands you the final answer directly",
      isTrap: true,
      feedbackTrap: longFeedback("you spotted it — that is only the general solution, not the final answer, so it is a trap"),
      feedbackSound: longFeedback("this is actually a trap, since the move produces a general relation that still must be pinned down"),
    },
    tip: "Name what a move actually produces — a general result is not the answer",
  };
}

// A valid setup step using the Contract-C `equation` shape; CODE assembles tiles.
function makeEquationSetupStep(prompt: string): Step {
  return {
    type: "setup",
    label: "SET UP THE MATH",
    icon: "🔧",
    prompt,
    build: {
      equation: {
        lhs_terms: ["$2kr$"],
        relation: "=",
        rhs_terms: ["$\\frac{mv^2}{r}$"],
        distractor_terms: [
          { term: "$\\frac{GMm}{r^2}$", feedback: "there is no gravitational term in this harmonic well, so this fragment does not belong" },
          { term: "$kr$", feedback: "you dropped the factor of two from the derivative of the potential here" },
        ],
      },
      feedbackCorrect: longFeedback("the inward force supplies exactly the centripetal requirement"),
      feedbackWrong: longFeedback("balance the real force from this potential against the centripetal term"),
    },
    tip: "Set the real force equal to the centripetal requirement",
  };
}

// A valid form step (type "form", ASSEMBLE THE FORM — build, TERMINAL). Assembles
// the SYMBOLIC answer skeleton from atomic tiles; feedback is tone-neutral.
function makeFormStep(prompt: string): Step {
  return {
    type: "form",
    label: "ASSEMBLE THE FORM",
    icon: "🏗️",
    prompt,
    build: {
      tiles: ["r", "=", "$\\sqrt{2gh}$", "$2gh$", "$\\frac{1}{2gh}$"],
      accepted: [["r", "=", "$\\sqrt{2gh}$"]],
      distractors: [
        { tile: "$2gh$", feedback: neutralFormFeedback("the radicand before the root is applied, not the rooted form") },
        { tile: "$\\frac{1}{2gh}$", feedback: neutralFormFeedback("the inverted form; the recap keeps the radical right-side up") },
      ],
      feedbackCorrect: neutralFormFeedback("the symbolic skeleton of the answer"),
      feedbackWrong: neutralFormFeedback("a reshaped skeleton; reassemble the symbolic form and let the recap value it"),
    },
    tip: "Build the FORMULA first; numbers go in only at the recap",
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
// Step layout (6 steps): 0 principle (mcq, RECALL THE PRINCIPLE — mandatory
// opener), 1 setup (build — the central governing equation, mandatory second
// step), 2 identify (multiselect), 3 trap (claim — a mid-flow beat, never
// first), 4 approach (mcq), 5 form (build, ASSEMBLE THE FORM — terminal).
// Invariants: step 0 is "principle", step 1 is "setup", the last step is
// "form", and the trap appears mid-flow (never at index 0). The fixed indices
// keep the per-format tests below aligned by index.
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
        makeBuildStep("Build the central kinematic equation that relates the given quantities; some quantities you need are not given yet."),
        makeMultiSelectStep("Tap every quantity that actually controls the outcome of this throw."),
        makeClaimStep("Your instinct is to ignore air resistance entirely here — sound right, or is that a trap?"),
        makeApproachStep("With the equation set up, what's the cleanest next move to reach the answer?"),
        makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles — numbers come later."),
      ],
    },
  };
}

// Run a body with console.warn spied on, then restore the spy.
function withWarnSpy(body: (warnSpy: ReturnType<typeof vi.spyOn>) => void): void {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    body(warnSpy);
  } finally {
    warnSpy.mockRestore();
  }
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
    expect(steps[1].format).toBe("build"); // setup
    expect(steps[2].format).toBe("multiselect"); // identify
    expect(steps[3].format).toBe("claim"); // trap
    expect(steps[4].format).toBe("mcq"); // approach
    expect(steps[5].format).toBe("build"); // form
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
    ).toThrow("Expected 4-8 steps, got 3");
  });

  it("throws when there are too many steps (> 8)", () => {
    const problem = makeValidProblem();
    // 6 + 3 = 9 steps; insert before the terminal form step so the flow stays
    // form-last (the count check fires before the last-step check).
    problem.solution_flow.steps.splice(
      4,
      0,
      makeMcqStep("why", "Why does this principle govern the behaviour we observe here?"),
      makeMcqStep("why", "Why is this simplification justified for the given regime here?"),
      makeMcqStep("why", "Why does this approximation stay accurate across the regime here?")
    );
    expect(problem.solution_flow.steps.length).toBe(9);
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Expected 4-8 steps, got 9");
  });

  it("throws when last step is not form", () => {
    const problem = makeValidProblem();
    const steps = problem.solution_flow.steps;
    steps[steps.length - 1] = makeMcqStep("why", "A why step standing in for the terminal form step here.");
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('Last step must be type "form"');
  });

  it("throws when step.type is invalid", () => {
    const problem = makeValidProblem();
    // Steps 0/1 are the mandatory principle/setup opener, so corrupt a mid-flow
    // step's type to reach the per-step invalid-type check.
    problem.solution_flow.steps[2].type = "bogus";
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
    // step 4 is an mcq approach step; short prompt should be fine (>0 chars)
    problem.solution_flow.steps[4].prompt = "Short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("throws when the opener is not a principle step (identify at index 0)", () => {
    // Opener policy (decisions #827/#828): the flow MUST open with a "principle"
    // step. An identify opener that used to be allowed is now rejected.
    const problem = makeValidProblem();
    problem.solution_flow.steps[0] = makeMultiSelectStep(
      "Before reaching for any equation, tap every quantity that actually controls the outcome of this problem."
    );
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('First step must be type "principle"');
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
    // Minimal LEAN form-last flow: principle → setup → roadmap → form.
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which physics framework should you reach for on this specific problem?"),
      makeBuildStep("Build the central governing equation that relates the given quantities here."),
      makeRoadmapStep("Tap the high-level moves into the order that reaches the answer."),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("accepts a problem with exactly 8 steps (maximum)", () => {
    const problem = makeValidProblem();
    // 8-step LEAN form-last flow: principle → setup → roadmap → feeds →
    // produces → feeds → approach → form. The fixed opening is principle then
    // setup; everything else is build/claim/multiselect plus one approach mcq.
    // The two feeds beats target DIFFERENT moves with DISJOINT matters:true
    // inputs (the disjointness guard requires this for two feeds steps).
    const secondFeeds = makeFeedsStep("Tap every input the constraint move actually consumes here.");
    secondFeeds.multiselect = {
      items: [
        { text: "The boundary condition at the wall", matters: true },
        { text: "The container width L", matters: true },
        { text: "The launch speed v", matters: false },
        { text: "The elapsed time t", matters: false },
      ],
      feedbackCorrect: longFeedback("only the constraint move's own inputs belong here"),
      feedbackWrong: longFeedback("the constraint move consumes the boundary condition and width, not the kinematic inputs"),
    };
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which physics framework should you reach for on this specific problem?"),
      makeEquationSetupStep("Build the central force-balance equation from the structural tiles here."),
      makeRoadmapStep("Tap the high-level moves into the order that reaches the answer."),
      makeFeedsStep("Tap every input the first move actually consumes here."),
      makeProducesStep("You solved the equation — is that the final answer, or is it a trap?"),
      secondFeeds,
      makeApproachStep("With the setup done, what's the cleanest next move to reach the answer?"),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(problem.solution_flow.steps.length).toBe(8);
    expect(problem.solution_flow.steps[7].type).toBe("form");
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
    expect(problem.solution_flow.steps[3].claim).toBeDefined();
  });

  it("throws when claim object is missing on a trap step", () => {
    const problem = makeValidProblem();
    delete problem.solution_flow.steps[3].claim;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('missing required "claim" object');
  });

  it("throws when claim.statement is missing/too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].claim!.statement = "too short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("claim.statement must be at least 15 chars");
  });

  it("throws when claim.isTrap is not a boolean", () => {
    const problem = makeValidProblem();
    (problem.solution_flow.steps[3].claim as Record<string, unknown>).isTrap = "yes";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("claim.isTrap must be a boolean");
  });

  it("throws when claim.feedbackTrap is missing/too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].claim!.feedbackTrap = "short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("claim.feedbackTrap must be at least 40 chars");
  });

  it("throws when claim.feedbackSound is missing/too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[3].claim!.feedbackSound = "short";
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
    expect(problem.solution_flow.steps[1].build).toBeDefined();
  });

  it("throws when build object is missing on a setup step", () => {
    const problem = makeValidProblem();
    delete problem.solution_flow.steps[1].build;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('missing required "build" object');
  });

  it("throws when build.tiles has a duplicate tile", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.tiles = ["a", "=", "b", "a", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("duplicate tile");
  });

  it("throws when an accepted token is not in tiles", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.accepted = [["a", "=", "z"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('references token "z" not in tiles');
  });

  it("throws when an accepted arrangement repeats a tile", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.accepted = [["a", "=", "a"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('repeats token "a"');
  });

  it("throws when an accepted arrangement is too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.accepted = [["a"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("arrangement must have length >= 2");
  });

  it("throws when accepted is empty", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.accepted = [];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("build.accepted must be a non-empty array");
  });

  it("throws when distractors is empty", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.distractors = [];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("build.distractors must have at least 1 entry");
  });

  it("throws when a distractor tile is not in tiles", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.distractors = [
      { tile: "zzz", feedback: longFeedback("this tile is not even in the tray") },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('tile "zzz" not in tiles');
  });

  it("throws when a distractor tile also appears in an accepted arrangement", () => {
    const problem = makeValidProblem();
    // "a" is part of the accepted arrangement ["a","=","b"]
    problem.solution_flow.steps[1].build!.distractors = [
      { tile: "a", feedback: longFeedback("a is actually part of the correct answer") },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('also appears in an accepted arrangement');
  });

  it("throws when a distractor feedback is below 30 chars", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.distractors = [
      { tile: "x", feedback: "too short" },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("build.distractors feedback must be at least 30 chars");
  });

  it("throws when build.feedbackWrong is too short", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.feedbackWrong = "short";
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("build.feedbackWrong must be at least 40 chars");
  });

  it("throws when a build tile is a complete equation (content on both sides of '=')", () => {
    const problem = makeValidProblem();
    // Each tile is a whole, already-assembled equation -> nothing to arrange.
    problem.solution_flow.steps[1].build!.tiles = ["$F = ma$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("throws when a build tile is a partial relation (content on only one side of '=')", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.tiles = ["$F =$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("throws when a build tile is a complete inequality relation (\\leq with both sides)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.tiles = ["$v \\leq c$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("throws when a build tile is a complete Unicode inequality (≠ with both sides)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.tiles = ["$x \u2260 0$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("allows a bare '=' separator tile (relation operator alone)", () => {
    const problem = makeValidProblem();
    // The only relation-bearing tile here is the bare "=" separator; it must
    // NOT be rejected by the embedded-relation guard.
    problem.solution_flow.steps[1].build!.tiles = ["$2kr$", "=", "$mv^2/r$", "x", "y"];
    problem.solution_flow.steps[1].build!.accepted = [["$2kr$", "=", "$mv^2/r$"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("allows a fragment tile with a relation nested inside a subscript/argument", () => {
    const problem = makeValidProblem();
    // "$E_{x=0}$" and "$v(t=0)$" carry "=" only INSIDE braces/parens — they are
    // single atomic terms (evaluation conditions), not assembled relations.
    problem.solution_flow.steps[1].build!.tiles = ["$E_{x=0}$", "=", "$v(t=0)$", "x", "y"];
    problem.solution_flow.steps[1].build!.accepted = [["$E_{x=0}$", "=", "$v(t=0)$"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("throws when a whole equation is wrapped in plain parentheses", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.tiles = ["$(F = ma)$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("throws when a whole equation is wrapped in \\left( ... \\right)", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.tiles = ["$\\left(F = ma\\right)$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("allows a brace-grouped atomic condition tile (braces are grouping, not equation-wrapping)", () => {
    const problem = makeValidProblem();
    // "{x=0}" is a single grouped condition term; bare braces must NOT be
    // unwrapped and rejected as a top-level relation.
    problem.solution_flow.steps[1].build!.tiles = ["${x=0}$", "=", "$kr$", "x", "y"];
    problem.solution_flow.steps[1].build!.accepted = [["${x=0}$", "=", "$kr$"]];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("throws when a build tile is a complete \\leqslant inequality", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.tiles = ["$v \\leqslant c$", "=", "b", "x", "y"];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("embeds a relation operator");
  });

  it("does not mistake the LaTeX command \\left for the relation \\le", () => {
    const problem = makeValidProblem();
    // "\left." starts with "\le" but is NOT a relation operator.
    problem.solution_flow.steps[1].build!.tiles = [
      "$\\left.\\frac{dV}{dr}\\right|_{r=R}$",
      "=",
      "$kr$",
      "x",
      "y",
    ];
    problem.solution_flow.steps[1].build!.accepted = [
      ["$\\left.\\frac{dV}{dr}\\right|_{r=R}$", "=", "$kr$"],
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("accepts LaTeX-wrapped fragment tiles that contain no relation operator", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps[1].build!.tiles = [
      "$2kr$",
      "=",
      "$\\frac{mv^2}{r}$",
      "$\\frac{GMm}{r^2}$",
      "$kr$",
    ];
    problem.solution_flow.steps[1].build!.accepted = [["$2kr$", "=", "$\\frac{mv^2}{r}$"]];
    problem.solution_flow.steps[1].build!.distractors = [
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
    problem.solution_flow.steps[1].build!.tiles!.push("orphan");
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
    problem.solution_flow.steps[3].options = [
      { text: "Leftover option", correct: true, feedback: "stale feedback here" },
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('stale "options" field');
  });

  // ─── form step: terminal position + count + approach/scale ceilings ─────────

  it("throws when there is no form step", () => {
    const problem = makeValidProblem();
    // Replace the terminal form step (index 5) with a why mcq -> zero form
    // steps. With form terminal, the last-step check catches this first.
    problem.solution_flow.steps[5] = makeMcqStep(
      "why",
      "Another reasoning step standing in for the terminal form step here."
    );
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('Last step must be type "form"');
  });

  it("accepts the assemble (form) step as the terminal step", () => {
    const problem = makeValidProblem();
    const steps = problem.solution_flow.steps;
    // Invariant: the assemble (form) step is last in a valid flow.
    expect(steps[steps.length - 1].type).toBe("form");
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("accepts a legal zero-approach form-last flow", () => {
    const problem = makeValidProblem();
    // The contract explicitly allows ZERO approach steps (lower bound 0).
    // principle → setup → roadmap → form has no approach steps and ends in form.
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which framework should you reach for on this specific problem?"),
      makeBuildStep("Build the central governing equation that relates the given quantities."),
      makeRoadmapStep("Tap the high-level moves into the order that reaches the answer."),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(problem.solution_flow.steps.some((s) => s.type === "approach")).toBe(false);
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("throws when there are more than 3 approach steps", () => {
    const problem = makeValidProblem();
    // principle → approach ×4 → form (6 steps, last = form, exactly 1 form),
    // so we reach the approach ceiling check with 4 approach steps.
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which framework should you reach for on this specific problem?"),
      makeApproachStep("First strategy beat: what's the cleanest opening move toward the answer?"),
      makeApproachStep("Second strategy beat: which simplification keeps the algebra clean?"),
      makeApproachStep("Third strategy beat: what extra insight do you still need here?"),
      makeApproachStep("Fourth strategy beat: how do you reduce this to a single unknown?"),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('Expected at most 3 "approach" steps, got 4');
  });

  it("rejects newly generated depends/scale/limit steps (now legacy-only)", () => {
    // The retired reasoning chain (depends → scale → limit) was demoted to
    // legacy-only when the derivation-roadmap pedagogy replaced it. A new
    // generation that emits any of them must be rejected by the hard block, the
    // same way connect/sanity/solve are.
    for (const legacy of [
      makeDependsStep("Tap every quantity the answer truly involves before assembling it."),
      makeScaleStep("How does the orbit radius scale with the angular momentum here?"),
      makeLimitStep("Send the stiffness to its extreme — sound right, or is that a trap?"),
    ]) {
      const problem = makeValidProblem();
      // Principle@0 + setup@1 satisfy the fixed-opening guards so execution
      // reaches the legacy-only hard block, which the smuggled legacy step trips.
      problem.solution_flow.steps = [
        makeMcqStep("principle", "Which governing principle should you reach for on this specific problem?"),
        makeBuildStep("Build the central equation that relates the given quantities here."),
        legacy,
        makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
      ];
      expect(() =>
        validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
      ).toThrow("Legacy-only step types cannot be generated");
    }
  });

  it("throws when there is more than one form step", () => {
    const problem = makeValidProblem();
    // Replace the approach step (index 4) with a second form step. Total stays
    // 6 (<=8) and last step is still form, so we reach the form-count check.
    problem.solution_flow.steps[4] = makeFormStep(
      "A second assemble step that should not be allowed here."
    );
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow('Expected exactly 1 "form" step, got 2');
  });

  it("rejects newly generated solve steps (legacy-only hard block)", () => {
    const problem = makeValidProblem();
    // An otherwise form-last flow that smuggles in a legacy-only solve step in a
    // NON-terminal position (so the last-step=form check passes first).
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which framework should you reach for on this specific problem?"),
      makeBuildStep("Build the equation that relates the given quantities."),
      makeMultiSelectStep("Tap every quantity that actually controls the outcome here."),
      makeSolveStep("Predict the form the final answer takes for this problem."),
      makeApproachStep("With the equation set up, what's the cleanest next move to reach the answer?"),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Legacy-only step types cannot be generated");
  });

  it("rejects newly generated connect steps (legacy-only hard block)", () => {
    const problem = makeValidProblem();
    // An otherwise form-last flow that smuggles in a legacy-only connect step.
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which framework should you reach for on this specific problem?"),
      makeBuildStep("Build the equation that relates the given quantities."),
      makeMultiSelectStep("Tap every quantity that actually controls the outcome here."),
      makeMcqStep("connect", "What's the key simplification that fast-tracks the solve here?"),
      makeApproachStep("With the equation set up, what's the cleanest next move to reach the answer?"),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Legacy-only step types cannot be generated");
  });

  it("rejects newly generated sanity steps (legacy-only hard block)", () => {
    const problem = makeValidProblem();
    // An otherwise form-last flow that smuggles in a legacy-only sanity step.
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which framework should you reach for on this specific problem?"),
      makeBuildStep("Build the equation that relates the given quantities."),
      makeMultiSelectStep("Tap every quantity that actually controls the outcome here."),
      makeMcqStep("sanity", "Does the running result make physical sense given the setup?"),
      makeApproachStep("With the equation set up, what's the cleanest next move to reach the answer?"),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow("Legacy-only step types cannot be generated");
  });

  it("sanitizes (does not throw) committal feedback on the terminal form step", () => {
    const problem = makeValidProblem();
    const steps = problem.solution_flow.steps;
    const terminal = steps[steps.length - 1];
    expect(terminal.type).toBe("form");
    // Inject SHORT committal strings (GPT-4o readily emits "correct"). These are
    // deliberately BELOW the build-step length minimums (feedbackCorrect/Wrong
    // >=40, distractor >=30): the validator must NOT throw, which only holds if
    // sanitize-in-place runs BEFORE validateBuildStep's length gate (the neutral
    // fallbacks clear the minimums). If the order were reversed, the short
    // "Correct!" would fail the length check and this test would throw.
    terminal.build!.feedbackCorrect = "Correct!";
    terminal.build!.distractors![0].feedback = "Wrong tile.";

    withWarnSpy(() => {
      expect(() =>
        validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
      ).not.toThrow();
    });

    const banned = ["correct", "wrong", "incorrect", "mistake", "you used", "perfect"];
    const strings = [
      terminal.build!.feedbackCorrect,
      terminal.build!.feedbackWrong,
      ...terminal.build!.distractors!.map((d) => d.feedback),
    ];
    for (const s of strings) {
      const fb = s.toLowerCase();
      for (const word of banned) {
        expect(fb).not.toContain(word);
      }
    }
  });

  it("examples self-validate through validateAndNormalize without throwing", () => {
    // Run each baked-in example through the FULL contract (every
    // validateBuildStep clause included), so any future violation is caught here
    // rather than only at generation time.
    for (const example of Object.values(__TEST_EXAMPLES)) {
      const ex = structuredClone(example) as unknown as TestProblem;
      expect(() =>
        validateAndNormalize(ex, example.subject, example.topic, example.difficulty)
      ).not.toThrow();
    }
  });

  it("examples' terminal form assembles the symbolic skeleton (not the numeric value)", () => {
    // The examples carry Contract-C term arrays; run each through
    // validateAndNormalize (which assembles tiles/accepted) on a clone before
    // introspecting the assembled `accepted`.
    for (const example of Object.values(__TEST_EXAMPLES)) {
      const ex = structuredClone(example) as unknown as TestProblem;
      validateAndNormalize(ex, example.subject, example.topic, example.difficulty);
      const steps = ex.solution_flow.steps;
      const formStep = steps[steps.length - 1];
      expect(formStep.type).toBe("form");
      const accepted = formStep.build!.accepted!;
      expect(accepted.length).toBeGreaterThan(0);
      // The accepted arrangement assembles a multi-tile SYMBOLIC relation.
      expect(accepted[0].length).toBeGreaterThanOrEqual(2);
    }
  });

  it("Class-11 example's terminal form is symbolic, not the numeric final_answer", () => {
    const example = __TEST_EXAMPLES.EXAMPLE_CLASS_11;
    expect(example.final_answer).toBe("≈ 79.5 m");
    const ex = structuredClone(example) as unknown as TestProblem;
    validateAndNormalize(ex, example.subject, example.topic, example.difficulty);
    const steps = ex.solution_flow.steps;
    const formStep = steps[steps.length - 1];
    expect(formStep.type).toBe("form");
    // The assembled skeleton must NOT contain the numeric value 79.5.
    const assembled = formStep.build!.accepted![0].join(" ");
    expect(assembled).not.toContain("79.5");
  });

  it("examples contain no legacy-only (solve/sanity/connect/depends/scale/limit) steps", () => {
    for (const example of Object.values(__TEST_EXAMPLES)) {
      const types = example.solution_flow.steps.map((s) => s.type);
      for (const legacy of ["solve", "sanity", "connect", "depends", "scale", "limit"]) {
        expect(types).not.toContain(legacy);
      }
    }
  });

  it("examples have at most one mcq (principle) beat (LEAN mix)", () => {
    for (const example of Object.values(__TEST_EXAMPLES)) {
      const mcqCount = example.solution_flow.steps.filter(
        (s) => s.type === "principle"
      ).length;
      expect(mcqCount).toBeLessThanOrEqual(1);
    }
  });

  it("examples use the roadmap spine and end in form", () => {
    for (const example of Object.values(__TEST_EXAMPLES)) {
      const types = example.solution_flow.steps.map((s) => s.type);
      expect(types).toContain("roadmap");
      expect(types[types.length - 1]).toBe("form");
    }
  });

  // ─── Contract C: code-assembled build steps ────────────────────────────────

  it("assembles a setup equation contract into atomic tiles with '=' on its own tile", () => {
    const problem = makeValidProblem();
    // Replace the setup step (index 3) with a Contract-C equation step.
    problem.solution_flow.steps[3] = makeEquationSetupStep(
      "Build the force-balance equation from the constrained term arrays here."
    );
    validateAndNormalize(problem, "mechanics", "Kinematics", "class_11");
    const build = problem.solution_flow.steps[3].build!;
    // The relation operator is its own tile and the accepted ordering is
    // lhs + relation + rhs.
    expect(build.tiles).toContain("=");
    expect(build.accepted).toEqual([["$2kr$", "=", "$\\frac{mv^2}{r}$"]]);
    // Distractor terms became distractor tiles present in the tray.
    expect(build.tiles).toContain("$\\frac{GMm}{r^2}$");
    expect(build.tiles).toContain("$kr$");
    expect(build.distractors!.map((d) => d.tile).sort()).toEqual(
      ["$\\frac{GMm}{r^2}$", "$kr$"].sort()
    );
    // The raw contract field is consumed (deleted) once assembled.
    expect(build.equation).toBeUndefined();
  });

  it("assembles a roadmap moves contract: every correct move is the accepted order", () => {
    const problem = makeValidProblem();
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which governing principle should you reach for on this specific problem?"),
      makeBuildStep("Build the central equation that relates the given quantities here."),
      makeRoadmapStep("Tap the high-level moves into the order that reaches the answer."),
      makeFeedsStep("Tap every input the first move actually consumes here."),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    validateAndNormalize(problem, "mechanics", "Kinematics", "class_11");
    const build = problem.solution_flow.steps[2].build!;
    expect(build.accepted).toEqual([
      [
        "Split the motion into horizontal and vertical components",
        "Impose the return-to-ground condition to time the flight",
      ],
    ]);
    // Distractor moves are tiles in the tray but NOT in the accepted ordering.
    expect(build.tiles!.length).toBe(4);
    expect(build.moves).toBeUndefined();
    expect(build.distractor_moves).toBeUndefined();
  });

  it("a code-assembled equation tile never trips tileHasEmbeddedRelation", () => {
    // The whole point of Contract C: even though the model 'meant' an equation,
    // the assembled tiles are atomic, so the embedded-relation guard never fires.
    const problem = makeValidProblem();
    problem.solution_flow.steps[3] = makeEquationSetupStep(
      "Build the force-balance equation from the constrained term arrays here."
    );
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).not.toThrow();
  });

  it("rejects a roadmap step that carries the equation contract instead of moves", () => {
    const problem = makeValidProblem();
    // A roadmap step (build format) mis-carrying an `equation` contract must be
    // a hard error, not assembled as if it were a setup/form step.
    const bad = makeEquationSetupStep(
      "A roadmap step that wrongly emits the equation contract."
    );
    bad.type = "roadmap";
    bad.label = "MAP THE DERIVATION";
    bad.icon = "🗺️";
    // Place the bad roadmap at a mid-flow index (step 1 is the mandatory setup).
    problem.solution_flow.steps[2] = bad;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow(/roadmap.*moves.*not.*equation/i);
  });

  it("rejects a setup step that carries the moves contract instead of equation", () => {
    const problem = makeValidProblem();
    const bad = makeRoadmapStep(
      "A setup step that wrongly emits the moves contract."
    );
    bad.type = "setup";
    bad.label = "SET UP THE MATH";
    bad.icon = "🔧";
    problem.solution_flow.steps[3] = bad;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow(/setup.*equation.*not.*moves/i);
  });

  it("rejects a build step that carries BOTH equation and moves contracts", () => {
    const problem = makeValidProblem();
    const bad = makeEquationSetupStep(
      "A setup step that wrongly carries both contracts."
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bad.build as any).moves = ["one move", "another move"];
    problem.solution_flow.steps[3] = bad;
    expect(() =>
      validateAndNormalize(problem, "mechanics", "Kinematics", "class_11")
    ).toThrow(/BOTH equation and moves/i);
  });

  // ─── Legacy render path: stored legacy steps still resolve a format ─────────

  it("stored legacy depends/scale/limit/solve/sanity/connect steps still resolve via getStepFormat", async () => {
    const { getStepFormat } = await import("@/lib/types");
    const base = { label: "", icon: "", prompt: "", tip: "" };
    const cases: Array<[string, string]> = [
      ["depends", "multiselect"],
      ["scale", "mcq"],
      ["limit", "claim"],
      ["solve", "mcq"],
      ["sanity", "mcq"],
      ["connect", "mcq"],
    ];
    for (const [type, expected] of cases) {
      // No shape data present -> getStepFormat falls back to formatForType.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const step = { ...base, type } as any;
      expect(getStepFormat(step)).toBe(expected);
    }
  });

  it("examples end on the terminal assemble (form) step", () => {
    for (const example of Object.values(__TEST_EXAMPLES)) {
      const steps = example.solution_flow.steps;
      expect(steps[steps.length - 1].type).toBe("form");
    }
  });

  // ─── Flow-level redundancy guards (setup-vs-form, feeds count/disjointness) ──

  // A feeds step whose matters:true items are a CUSTOM set, used to construct
  // overlap / subset / disjoint scenarios for the disjointness guard.
  function feedsWith(matters: string[], extra: string[], prompt: string): Step {
    const items = [
      ...matters.map((t) => ({ text: t, matters: true })),
      ...extra.map((t) => ({ text: t, matters: false })),
    ];
    // The multiselect schema requires 4-6 items with >=1 matters:false. Pad with
    // unique generic red herrings (matters:false, so they don't affect overlap).
    let pad = 0;
    while (items.length < 4) {
      items.push({ text: `Padding red herring ${++pad} for ${prompt.slice(0, 8)}`, matters: false });
    }
    return {
      type: "feeds",
      label: "WHAT GOES IN",
      icon: "🔌",
      prompt,
      multiselect: {
        items,
        feedbackCorrect: longFeedback("only the inputs this move consumes belong here"),
        feedbackWrong: longFeedback("the red herrings come from a different move entirely"),
      },
      tip: "Tap only the inputs the move actually consumes",
    };
  }

  // A setup step whose assembled equation EQUALS the terminal form's equation
  // (the reported RMS bug): both assemble v_rms = sqrt(3RT/M).
  function makeRmsEquation(): EquationContract {
    return {
      lhs_terms: ["$v_{rms}$"],
      relation: "=",
      rhs_terms: ["$\\sqrt{\\frac{3RT}{M}}$"],
      distractor_terms: [
        { term: "$\\sqrt{\\frac{8RT}{\\pi M}}$", feedback: "that is the mean speed, a different same-family relation" },
      ],
    };
  }

  it("rejects a setup whose equation equals the terminal form (RMS duplicate bug)", () => {
    const problem = makeValidProblem();
    problem.difficulty = "college";
    const setup = makeEquationSetupStep("Set up the RMS-speed relation from the term tiles.");
    setup.build!.equation = makeRmsEquation();
    const form = makeFormStep("Assemble the SYMBOLIC RMS-speed form from the structural tiles.");
    // Terminal form assembles the IDENTICAL equation as the setup.
    form.build = {
      equation: makeRmsEquation(),
      feedbackCorrect: neutralFormFeedback("the symbolic RMS-speed skeleton"),
      feedbackWrong: neutralFormFeedback("a reshaped RMS skeleton; the recap values it"),
    };
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which governing principle pins down the RMS speed in this gas sample?"),
      setup,
      makeRoadmapStep("Tap the high-level moves into the order that reaches the RMS speed."),
      form,
    ];
    expect(() =>
      validateAndNormalize(problem, "thermodynamics", "Kinetic Theory", "college")
    ).toThrow(/setup step \d+ assembles the same equation as the terminal form/i);
  });

  it("accepts a flow whose setup is a DISTINCT relation from the terminal form", () => {
    const problem = makeValidProblem();
    problem.difficulty = "college";
    // setup: governing balance qvB = mv^2/r ; form: r = mv/qB (distinct tiles).
    const setup = makeEquationSetupStep("Set up the force-balance relation.");
    const form = makeFormStep("Assemble the SYMBOLIC radius form from the structural tiles.");
    form.build = {
      equation: {
        lhs_terms: ["r"],
        relation: "=",
        rhs_terms: ["$\\frac{mv}{qB}$"],
        distractor_terms: [
          { term: "$\\frac{qB}{mv}$", feedback: "that tile inverts the ratio; the recap keeps momentum on top" },
        ],
      },
      feedbackCorrect: neutralFormFeedback("the symbolic radius skeleton"),
      feedbackWrong: neutralFormFeedback("a reshaped radius skeleton; the recap values it"),
    };
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which governing principle pins down the orbit radius for this charge?"),
      setup,
      makeRoadmapStep("Tap the high-level moves into the order that reaches the radius."),
      form,
    ];
    expect(() =>
      validateAndNormalize(problem, "electrodynamics", "Magnetic Force", "college")
    ).not.toThrow();
  });

  it("rejects a flow with three feeds steps", () => {
    const problem = makeValidProblem();
    problem.difficulty = "college";
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which governing principle quantizes the energy levels in this well?"),
      makeBuildStep("Build the central equation that relates the given quantities here."),
      feedsWith(["The mass m"], ["A red herring A"], "Tap the inputs the first move consumes."),
      feedsWith(["The width L"], ["A red herring B"], "Tap the inputs the second move consumes."),
      feedsWith(["The charge q"], ["A red herring C"], "Tap the inputs the third move consumes."),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(() =>
      validateAndNormalize(problem, "quantum_mechanics", "Infinite Square Well", "college")
    ).toThrow(/at most 2 feeds steps allowed, got 3/i);
  });

  it("rejects two feeds steps whose matters:true sets are equal/subset (overlap)", () => {
    const problem = makeValidProblem();
    problem.difficulty = "college";
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which governing principle quantizes the energy levels in this well?"),
      makeBuildStep("Build the central equation that relates the given quantities here."),
      // First feeds requires {mass, width}; second requires {mass} — a SUBSET,
      // so the second beat adds no new required input.
      feedsWith(["The mass m", "The width L"], ["A red herring A"], "Tap the inputs the first move consumes."),
      feedsWith(["The mass m"], ["A red herring B"], "Tap the inputs the second move consumes."),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(() =>
      validateAndNormalize(problem, "quantum_mechanics", "Infinite Square Well", "college")
    ).toThrow(/the two feeds steps overlap/i);
  });

  it("accepts two feeds steps with disjoint matters:true inputs", () => {
    const problem = makeValidProblem();
    problem.difficulty = "college";
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which governing principle quantizes the energy levels in this well?"),
      makeBuildStep("Build the central equation that relates the given quantities here."),
      feedsWith(
        ["The potential V(x)=0 inside", "The mass m", "The constant hbar"],
        ["A measured energy value"],
        "Tap the inputs the solve-inside move consumes."
      ),
      feedsWith(
        ["The condition Psi(0)=0", "The condition Psi(L)=0", "The width L"],
        ["The elapsed time t"],
        "Tap the inputs the boundary-condition move consumes."
      ),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(() =>
      validateAndNormalize(problem, "quantum_mechanics", "Infinite Square Well", "college")
    ).not.toThrow();
  });

  it("accepts two feeds steps that share SOME but not all matters:true inputs", () => {
    const problem = makeValidProblem();
    problem.difficulty = "college";
    // Each beat shares the common mass m but ALSO requires its own distinct input,
    // so neither set is a subset of the other — legitimately distinct feeds.
    problem.solution_flow.steps = [
      makeMcqStep("principle", "Which governing principle pins down the orbit radius for this charge?"),
      makeBuildStep("Build the central equation that relates the given quantities here."),
      feedsWith(["The mass m", "The speed v"], ["A red herring A"], "Tap the inputs the first move consumes."),
      feedsWith(["The mass m", "The field B"], ["A red herring B"], "Tap the inputs the second move consumes."),
      makeFormStep("Assemble the SYMBOLIC form of the answer from the structural tiles."),
    ];
    expect(() =>
      validateAndNormalize(problem, "electrodynamics", "Magnetic Force", "college")
    ).not.toThrow();
  });

  it("terminal form step feedback avoids correctness-revealing wording", () => {
    // The terminal assemble step's UI grades the tiles, but its feedback strings
    // must stay non-committal (no celebration / blame) so the exact value is only
    // revealed in the recap. Every feedback field on the form build is scanned.
    const banned = [
      "correct",
      "wrong",
      "incorrect",
      "mistake",
      "exactly right",
      "perfect",
      "nailed",
      "you got it",
      "instead of",
      "you should have",
      "you used",
      "you added",
      "you subtracted",
    ];
    for (const example of Object.values(__TEST_EXAMPLES)) {
      const ex = structuredClone(example) as unknown as TestProblem;
      validateAndNormalize(ex, example.subject, example.topic, example.difficulty);
      const steps = ex.solution_flow.steps;
      const terminal = steps[steps.length - 1];
      expect(terminal.type).toBe("form");
      const build = terminal.build!;
      const strings = [
        build.feedbackCorrect,
        build.feedbackWrong,
        ...build.distractors!.map((d) => d.feedback),
      ];
      for (const s of strings) {
        const feedback = s.toLowerCase();
        for (const word of banned) {
          expect(feedback).not.toContain(word);
        }
      }
    }
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
