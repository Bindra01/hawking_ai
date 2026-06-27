import {
  formatForType,
  StepFormat,
  StepType,
  VALID_STEP_TYPES,
} from "@/lib/types";
import { getOpenAIClient } from "@/lib/openai";
import { STEP_ICONS } from "@/lib/step-icons";

// ─── STEP TYPE DEFINITIONS ───────────────────────────────────────────────────

const STEP_TYPE_GUIDE = `
STEP TYPES — choose the right ones based on the problem's structure:

1. "trap" (⚠️ SPOT THE TRAP)
   Purpose: Expose the #1 mistake students make on this problem type.
   The trap must be a REAL, SPECIFIC mistake — not a generic warning.
   Use varied, creative hooks — do NOT always say "Most students get this wrong because..."
   Example hooks: "Before you start calculating, there's a hidden assumption here...", "This problem looks straightforward, but there's a catch...", "What's the first thing you'd instinctively do? That might be wrong..."
   Example traps: using wrong formula, forgetting unit conversion, confusing similar concepts, applying a formula outside its valid range.

2. "principle" (⚡ RECALL THE PRINCIPLE)
   Purpose: Identify the correct physics law, theorem, or formula to apply.
   Use when the problem requires choosing between multiple possible approaches.
   For hard problems, this step should distinguish between superficially similar principles.

3. "identify" (🎯 IDENTIFY THE KEY)
   Purpose: Identify the key variable, quantity, constraint, or boundary condition.
   Use when the problem has a non-obvious "key insight" that unlocks the solution.

4. "setup" (🔧 SET UP THE MATH)
   Purpose: Write down the mathematical equation or expression.
   Show the actual algebra/calculus step. Use LaTeX for all math.

5. "approach" (🧭 PLAN THE DERIVATION)
   Purpose: after the equation is set up, ask HOW the student will get to the
   answer (integrate vs differentiate, what extra insight/quantity is needed,
   which simplification gets there). Conceptual mcq, exactly 4 options, exactly 1
   correct, NO arithmetic — a strategy choice, not a calculation. Use 1-3 of
   these after "setup".

6. "why" (💡 WHY THIS WORKS)
   Purpose: Explain the deeper physical intuition. Why does this result make sense?
   Use for hard problems where the physics insight is as important as the math.

7. "solve" (🔮 PREDICT THE FORM)
   Purpose: the FINAL step. The student predicts what the final answer
   EXPRESSION/FORM looks like (a number is just the expression after substituting
   values). mcq, exactly 4 options, exactly 1 correct whose text IS the problem's
   final_answer (byte-identical). Feedback is NON-COMMITTAL — do NOT celebrate or
   say 'Correct!'; frame it as 'given the form you predicted, the answer works out
   to <final_answer>' / acknowledge the form the student picked rather than
   asserting exact-value correctness.
   CRITICAL FEEDBACK-TONE EXCEPTION (terminal "solve" step ONLY — this overrides
   the global SAME-FAMILY-DISTRACTOR "name the error" rule for this one step):
   EVERY option's feedback — the correct option AND all distractors — must avoid
   the words "correct", "wrong", "incorrect", "mistake", "you made … error", "you
   should have", and must NOT tell the student their pick was right or wrong.
   Distractor feedback must neutrally acknowledge the FORM the student picked and
   defer the reconciliation to the worked answer, e.g. "That's the half-power
   form; the worked expression in the recap shows where the exponent lands" — NOT
   "You used the square root instead of the fourth root." Only the terminal
   "solve" step gets this exception — "approach"/"principle"/"why" distractors
   keep naming the error normally.

FIRST STEP VARIETY:
Problems should NOT always start with a "trap" step. Vary the opening step type based on what best hooks the student into the problem. Good openers include:
- "trap" — but with varied phrasing, NOT always "Most students get this wrong..." Use creative hooks like:
  "Before you start calculating, there's a hidden assumption here..."
  "This problem looks straightforward, but there's a catch..."
  "What's the first thing you'd instinctively do? That might be wrong..."
- "identify" — "What's the key insight that unlocks this problem?", "Before diving into equations, what's really going on here?"
- "principle" — "Which physics framework should you reach for?", "Two laws seem to apply here. Which one actually works?"
- "why" — "Before solving, let's build intuition. What should the answer look like?"
Pick the best opener based on the problem's structure, not by defaulting to trap every time.
`;

// ─── PER-FORMAT CONTENT + HOOK + DISTRACTOR RULES ────────────────────────────

const PER_FORMAT_GUIDE = `
STEP 1 HOOK (HARD REQUIREMENT):
The FIRST step's "prompt" MUST open with a punchy, problem-specific line that
names what the student would INSTINCTIVELY (and wrongly) do on THIS exact problem,
and creates tension ("...but that's exactly the trap", "...and that's where most
people lose the marks"). It must be at least 40 characters and must be DIFFERENT
for every problem — there is NO fixed canned sentence. Do NOT reuse a template
like "Most students get this wrong because...". Write a fresh, specific opener
that could only belong to THIS problem.
(The FIRST STEP VARIETY rule above still applies: the opener may be a trap,
identify, principle, or why step — do NOT force a trap-first opener.)

SAME-FAMILY DISTRACTORS (HARD REQUIREMENT):
Every wrong option, wrong tile, and non-mattering item MUST be a mistake a
COMPETENT student could actually make on THIS specific problem. Acceptable
distractors: balancing the potential V instead of the field E, a sign slip, a
geometry/component slip, dropping a 1/2 factor, using the wrong-but-related law,
forgetting a unit conversion that belongs to this problem.
FORBIDDEN: off-topic throwaway distractors that name an unrelated law or quantity
from a different topic, or that no competent student working THIS problem would
ever consider. A distractor that is obviously irrelevant teaches nothing.

  GOOD (on a problem balancing electric force on a charge between plates):
    "Balance the potential difference V instead of the field E — forgetting that
     the force depends on E, not V directly."   ← a real, on-topic slip
  BAD:
    "Use the ideal gas law PV = nRT."   ← off-topic; nobody solving this would
     reach for thermodynamics. Never write distractors like this.

PER-TYPE CONTENT — each step type emits a SPECIFIC structure (not always options):

* type "trap"  => emit a "claim" object (NO "options"):
    {
      "statement": "<the bold claim, stated as if true>",
      "isTrap": true | false,            // true = the claim is false / a trap
      "feedbackTrap": "<shown when student taps IT'S A TRAP, 40+ chars>",
      "feedbackSound": "<shown when student taps SOUNDS RIGHT, 40+ chars>"
    }

* type "identify"  => emit a "multiselect" object (NO "options"):
    {
      "items": [ { "text": "<quantity/fact>", "matters": true|false }, ... ],
      // 4-6 items; AT LEAST ONE matters:true AND AT LEAST ONE matters:false.
      // The matters:false items must be plausible same-family red herrings.
      "feedbackCorrect": "<40+ chars>",
      "feedbackWrong": "<40+ chars>"
    }

* type "setup"  => emit a "build" object (NO "options"):
    {
      "tiles": [ "<unique token>", ... ],   // 3-10 UNIQUE tokens, incl. 1-3 distractor tiles
      "accepted": [ [ "<token>", "<token>", ... ] ],
      // >=1 ordered arrangement; each length >=2; every token must appear in "tiles";
      // an arrangement must NOT repeat a tile.
      "distractors": [ { "tile": "<a token from tiles>", "feedback": "<30+ chars>" } ],
      // 1-3 entries; each "tile" MUST be one of "tiles" and MUST NOT appear in
      // any accepted arrangement (it is a wrong tile that doesn't belong).
      "feedbackCorrect": "<40+ chars>",
      "feedbackWrong": "<40+ chars>"
    }
    // CRITICAL — TILE GRANULARITY: each tile MUST be an ATOMIC FRAGMENT of the
    // equation — a single term, a single factor, or a bare operator — that only
    // becomes a meaningful relation once arranged WITH the other tiles. The "="
    // sign is ALWAYS its own separate tile. NO tile may be a complete, already-
    // assembled equation, because then the student has nothing to set up and the
    // step degrades into a disguised multiple-choice.
    //   GOOD (fragments): "$2kr$", "=", "$\\frac{mv^2}{r}$", "$\\frac{GMm}{r^2}$", "$kr$"
    //                     → student arranges them into  2kr = mv²/r
    //   BAD  (whole equations, NEVER do this):
    //                     "$F = ma$", "$v = 4\\sqrt{x}$", "$a = \\frac{dv}{dx}\\frac{dx}{dt}$"
    //                     → each tile is the entire answer; nothing to build.
    // RULE OF THUMB: a relation operator ("=", "<", ">", "\\leq", "\\geq",
    // "\\neq", "\\approx", ...) must ALWAYS be its own tile, with NOTHING else
    // attached. Tiles like "$F = ma$" (whole), "$F =$" or "$= ma$" (partial), or
    // "$v \\leq c$" are INVALID. Split them: left-hand side, the bare operator,
    // right-hand side (further split each side into its terms/factors) all become
    // separate tiles. (A relation INSIDE a subscript/argument, e.g. "$E_{x=0}$"
    // or "$v(t=0)$", is part of a single term and is fine.)

* all OTHER types ("principle", "why", "approach", "solve")  => emit "options":
    exactly 4 options, exactly 1 correct (the existing MCQ rules below apply).
    For the "solve" step, the single correct option's text MUST equal the
    problem's final_answer, and ALL of its option feedback (correct option AND
    every distractor) must be non-committal — frame it around the FORM the student
    predicted, defer the worked result to the recap, and NEVER use
    'correct'/'wrong'/'incorrect'/'mistake' or say the student's pick was right or
    wrong. This is the ONE exception to the same-family-distractor 'name the error'
    rule, which still applies to every other step type.

Do NOT add an "options" array to trap/identify/setup steps, and do NOT add
claim/multiselect/build objects to the MCQ types.
`;

// ─── EXAMPLE PROBLEMS (one per difficulty) ───────────────────────────────────

const EXAMPLE_CLASS_11 = {
  title: "RMS speed of O₂ at 47°C equals that of H₂ at ___°C",
  subject: "thermodynamics",
  topic: "Kinetic Theory",
  difficulty: "class_11",
  scenario: "The RMS speed of O₂ at 47°C equals the RMS speed of H₂ at what temperature (in °C)?",
  goal: "Find: -253°C",
  final_answer: "-253°C",
  diagram_type: null,
  solution_flow: {
    steps: [
      {
        type: "identify",
        label: "IDENTIFY THE KEY",
        icon: "🎯",
        prompt: "Your instinct is to plug 47 straight into a speed formula — but first, tap every quantity that actually controls the RMS speed here.",
        multiselect: {
          items: [
            { text: "The temperature, converted to Kelvin (47°C = 320 K)", matters: true },
            { text: "The molar masses of O₂ (32 g/mol) and H₂ (2 g/mol)", matters: true },
            { text: "The pressure of each gas sample", matters: false },
            { text: "The number of moles of gas present", matters: false },
            { text: "The volume of the container", matters: false }
          ],
          feedbackCorrect: "Exactly — only the absolute temperature (in Kelvin) and the molar masses set the RMS speed, since v_rms = √(3RT/M).",
          feedbackWrong: "RMS speed depends only on absolute temperature (Kelvin) and molar mass: v_rms = √(3RT/M). Pressure, volume, and moles never enter."
        },
        tip: "ALL gas law temperatures must be in Kelvin. RMS speed depends only on T and M."
      },
      {
        type: "principle",
        label: "RECALL THE PRINCIPLE",
        icon: "⚡",
        prompt: "You need to equate RMS speeds of two different gases. Which formula relates RMS speed to temperature and molar mass?",
        options: [
          { text: "$v_{rms} = \\sqrt{3RT/M}$ where M is molar mass", correct: true, feedback: "Correct. R is universal gas constant, T in Kelvin, M is molar mass in kg/mol." },
          { text: "$v_{rms} = \\sqrt{3kT/m}$ where m is total mass of gas", correct: false, feedback: "Close — m here should be the mass of ONE molecule, not total mass. The Boltzmann constant k pairs with single-molecule mass, while the gas constant R pairs with molar mass. Mixing these up gives an answer off by Avogadro's number. Use: $v_{rms} = \\sqrt{3RT/M}$.", distractor_type: "half_right" as const },
          { text: "$v_{rms} = \\sqrt{2RT/M}$ (most probable speed formula)", correct: false, feedback: "That's the most probable speed, not RMS. The Maxwell-Boltzmann distribution gives three characteristic speeds: most probable (√(2RT/M)), mean (√(8RT/πM)), and RMS (√(3RT/M)). The factors 2, 8/π, and 3 come from different moments of the distribution. RMS speed has factor 3: $v_{rms} = \\sqrt{3RT/M}$.", distractor_type: "misconception" as const },
          { text: "$v_{rms} = \\sqrt{RT/M}$ (simplified kinetic energy relation)", correct: false, feedback: "You're missing the factor of 3. This comes from the equipartition theorem: each translational degree of freedom contributes ½kT of energy, and there are 3 degrees of freedom. So KE = (3/2)kT, which gives v_rms = √(3RT/M), not √(RT/M).", distractor_type: "procedural_slip" as const }
        ],
        tip: "RMS speed: √(3RT/M). Most probable: √(2RT/M). Mean: √(8RT/πM)."
      },
      {
        type: "setup",
        label: "SET UP THE MATH",
        icon: "🔧",
        prompt: "Build the equation that equates the two RMS speeds. Drag the tiles into the correct order.",
        build: {
          tiles: ["$\\frac{3R(320)}{32}$", "=", "$\\frac{3RT}{2}$", "$\\times$", "$+ 273$"],
          accepted: [
            ["$\\frac{3R(320)}{32}$", "=", "$\\frac{3RT}{2}$"]
          ],
          distractors: [
            { tile: "$\\times$", feedback: "You don't multiply the two sides — RMS speeds are set EQUAL, so the relation uses '=', not '×'." },
            { tile: "$+ 273$", feedback: "The 273 conversion belongs at the END (converting the final K to °C), not inside the speed-balance equation." }
          ],
          feedbackCorrect: "Clean. Setting v_rms equal gives 3R(320)/32 = 3RT/2; the 3R cancels, leaving 320/32 = T/2.",
          feedbackWrong: "Equate the two RMS-speed expressions directly: 3R(320)/32 = 3RT/2. Don't multiply the sides or fold in the 273 yet."
        },
        tip: "When equating speeds, square both sides first to eliminate the square root."
      },
      {
        type: "approach",
        label: "PLAN THE DERIVATION",
        icon: "🧭",
        prompt: "The speed-balance equation `3R(320)/32 = 3RT/2` is set up. What's the cleanest next move to reach T for H₂?",
        options: [
          { text: "Cancel the common `3R`, then solve the proportion `320/32 = T/2` for T", correct: true, feedback: "Right — the 3R is common to both sides, so cancelling it collapses the problem to a clean proportion in T." },
          { text: "Square both sides again before cancelling anything", correct: false, feedback: "The square roots were already removed when the RMS expressions were equated, so squaring again does nothing useful here. The shared 3R simply cancels, leaving the proportion 320/32 = T/2 to solve for T.", distractor_type: "procedural_slip" as const },
          { text: "Cross-multiply the two whole fractions before simplifying", correct: false, feedback: "Cross-multiplying the full fractions just reintroduces the 3R on both sides that you would then have to cancel anyway. Cancelling the common 3R first is cleaner and leaves the simple proportion 320/32 = T/2.", distractor_type: "half_right" as const },
          { text: "Convert 320 K back to °C before solving for T", correct: false, feedback: "Converting units mid-derivation mixes scales and invites sign errors. Keep everything in Kelvin while solving the proportion, and only convert the final T to °C at the very end.", distractor_type: "misconception" as const }
        ],
        tip: "Cancel common factors before cross-multiplying — it turns a messy equation into a clean proportion."
      },
      {
        type: "approach",
        label: "PLAN THE DERIVATION",
        icon: "🧭",
        prompt: "Solving the proportion gives T(H₂) = 20 K, but the question asks for °C. What's the right final move to land the answer?",
        options: [
          { text: "Convert the Kelvin result back to °C by subtracting 273", correct: true, feedback: "Exactly — the answer is requested in °C, and K → °C subtracts 273, so the final step is 20 − 273." },
          { text: "Add 273 to the Kelvin value to reach °C", correct: false, feedback: "Adding 273 is the °C → K direction, not the K → °C direction you need here. Since 0°C = 273 K, going from Kelvin to Celsius subtracts 273, so the final move is 20 − 273.", distractor_type: "procedural_slip" as const },
          { text: "Negate the Kelvin value to get the Celsius temperature", correct: false, feedback: "A sign flip is not a unit conversion — the Kelvin and Celsius scales are offset by 273, not by a sign. The Celsius value comes from subtracting 273 from the Kelvin result, not from negating it.", distractor_type: "half_right" as const },
          { text: "Apply the Fahrenheit formula: multiply by 9/5 and add 32", correct: false, feedback: "That formula converts to Fahrenheit, but the question asks for Celsius. Kelvin and Celsius share the same degree size and differ only by the 273 offset, so the conversion is just K − 273.", distractor_type: "misconception" as const }
        ],
        tip: "Decide the final unit step before computing digits: K → °C subtracts 273."
      },
      {
        type: "solve",
        label: "PREDICT THE FORM",
        icon: "🔮",
        prompt: "Before computing the digits, predict the FORM the final answer takes — a Celsius temperature well below zero. Which is it?",
        options: [
          { text: "-253°C", correct: true, feedback: "Given the form you predicted, the numbers work out to -253°C — a sub-zero Celsius temperature, as the reasoning pointed to." },
          { text: "20 K", correct: false, feedback: "That's the Kelvin form before the final unit step; the worked answer carries it through to °C to land on the sub-zero Celsius value the reasoning anticipated.", distractor_type: "procedural_slip" as const },
          { text: "293°C", correct: false, feedback: "That's the form you'd get by adding the 273 offset; the worked conversion in the recap lands at a sub-zero Celsius value rather than a high positive one.", distractor_type: "misconception" as const },
          { text: "-20°C", correct: false, feedback: "That's the form from a sign flip rather than the 273 offset; the worked conversion in the recap settles much further below zero.", distractor_type: "half_right" as const }
        ],
        tip: "Predict the FORM of the answer — units and sign — before you trust the digits."
      }
    ]
  }
};

const EXAMPLE_COLLEGE = {
  title: "A particle of mass m and angular momentum L in potential U(r) = kr²",
  subject: "mechanics",
  topic: "Central Forces",
  difficulty: "college",
  scenario: "A particle of mass m moves in a central force field with potential energy U(r) = kr². If the particle has angular momentum L, find the radius of its circular orbit.",
  goal: "Find: $r = (L^2/2mk)^{1/4}$",
  final_answer: "$r = \\left(\\frac{L^2}{2mk}\\right)^{1/4}$",
  diagram_type: null,
  solution_flow: {
    steps: [
      {
        type: "trap",
        label: "SPOT THE TRAP",
        icon: "⚠️",
        prompt: "You see a central force and immediately reach for the gravitational orbit formula r = L²/(GMm²) — but U = kr² is a harmonic well, not a 1/r field. Sound right, or is it a trap?",
        claim: {
          statement: "Because it's a central-force orbit, you can plug into the standard gravitational result r = L²/(GMm²).",
          isTrap: true,
          feedbackTrap: "Correct — it's a trap. U = kr² gives F = -2kr (a linear restoring force), not the -GMm/r² of gravity, so the gravitational orbit formula simply does not apply here.",
          feedbackSound: "Not quite — this is a trap. The gravitational formula assumes a 1/r² force. Here U = kr² gives F = -2kr, so you must derive the orbit from force balance + angular momentum directly."
        },
        tip: "Always read the potential before reusing an orbit formula — 1/r gravity ≠ harmonic kr²."
      },
      {
        type: "principle",
        label: "RECALL THE PRINCIPLE",
        icon: "⚡",
        prompt: "How do you extract the force from the potential U(r) = kr²?",
        options: [
          { text: "F = -dU/dr = -2kr (negative gradient of potential)", correct: true, feedback: "Right. F = -dU/dr is the fundamental relation. For U = kr²: F = -2kr (restoring force, directed inward)." },
          { text: "F = U/r = kr (divide potential by distance)", correct: false, feedback: "F = U/r is dimensionally coincidental but physically wrong. Force is always the negative gradient of potential energy: F = -dU/dr. Dividing potential by distance has no physical basis — it confuses the relationship between force and potential. The correct derivative gives F = -2kr.", distractor_type: "procedural_slip" as const },
          { text: "F = -dU/dt (differentiate with respect to time)", correct: false, feedback: "dU/dt gives power (rate of energy change), not force. Force comes from the spatial derivative: F = -dU/dr. Differentiating with respect to time would require knowledge of the trajectory r(t), which is what we're trying to find. Always differentiate w.r.t. position for force.", distractor_type: "misconception" as const },
          { text: "F = -kr (apply Hooke's law directly)", correct: false, feedback: "Hooke's law F = -kx applies to a spring with potential U = ½kx². Here the potential is U = kr² (no ½ factor), so the derivative gives F = -2kr, not -kr. The missing factor of 2 comes from differentiating r² without the ½ that would normally accompany a Hooke's law potential.", distractor_type: "half_right" as const }
        ],
        tip: "Force from potential: F = -dU/dr. Always differentiate w.r.t. position, not time."
      },
      {
        type: "setup",
        label: "SET UP THE MATH",
        icon: "🔧",
        prompt: "Build the force-balance equation for the circular orbit. Drag the tiles into the correct order.",
        build: {
          tiles: ["$2kr$", "=", "$\\frac{mv^2}{r}$", "$\\frac{GMm}{r^2}$", "$kr$"],
          accepted: [
            ["$2kr$", "=", "$\\frac{mv^2}{r}$"]
          ],
          distractors: [
            { tile: "$\\frac{GMm}{r^2}$", feedback: "There is no gravitational 1/r² force here — the force comes from U = kr², giving F = 2kr, not GMm/r²." },
            { tile: "$kr$", feedback: "You dropped the factor of 2. Differentiating U = kr² gives F = -dU/dr = -2kr, so the magnitude is 2kr, not kr." }
          ],
          feedbackCorrect: "Perfect. The inward force 2kr (from F = -dU/dr) supplies the centripetal requirement mv²/r.",
          feedbackWrong: "Balance the actual force from this potential: 2kr = mv²/r. There is no GMm/r² term, and don't drop the factor of 2."
        },
        tip: "Force from potential: F = -dU/dr. For U = kr² that is 2kr — keep the factor of 2."
      },
      {
        type: "approach",
        label: "PLAN THE DERIVATION",
        icon: "🧭",
        prompt: "Force balance gives `2kr = mv²/r` and angular momentum gives `L = mvr`. How do you combine them to isolate r?",
        options: [
          { text: "Eliminate v using `v = L/(mr)`, substitute into the force balance, then collect powers of r", correct: true, feedback: "Right — substituting v = L/(mr) removes v entirely and leaves a single equation in r to collect and solve." },
          { text: "Differentiate the potential a second time to get another relation", correct: false, feedback: "A second derivative of U gives the curvature of the well, not a new constraint linking L and r. The clean route is to eliminate v with v = L/(mr) and substitute into the force balance.", distractor_type: "misconception" as const },
          { text: "Set the kinetic energy equal to the potential energy and solve", correct: false, feedback: "Equating K and U is a virial-style shortcut that does not hold for a circular orbit in a kr² well, so it gives the wrong relation. Use force balance with v eliminated via L = mvr instead.", distractor_type: "half_right" as const },
          { text: "Reuse the gravitational orbit relation `r = L²/(GMm²)`", correct: false, feedback: "That relation assumes a 1/r² force, but here F = 2kr from U = kr², so it does not apply. Combine the actual force balance with angular momentum to isolate r.", distractor_type: "procedural_slip" as const }
        ],
        tip: "To combine two relations, eliminate the shared variable first — here v drops out via L = mvr."
      },
      {
        type: "approach",
        label: "PLAN THE DERIVATION",
        icon: "🧭",
        prompt: "Combining the relations gives `r⁴ = L²/(2mk)`. Which root isolates r?",
        options: [
          { text: "Take the fourth root, since the combined relation is `r⁴ = L²/(2mk)`", correct: true, feedback: "Exactly — r is raised to the fourth power, so the fourth root of both sides isolates r directly." },
          { text: "Take the square root of both sides", correct: false, feedback: "A square root only undoes a squared term, but r appears to the fourth power here, so it leaves an r² behind. Apply the fourth root to isolate r in one clean step.", distractor_type: "procedural_slip" as const },
          { text: "Take the cube root of both sides", correct: false, feedback: "The cube root would be right for r³, but the relation is r⁴ = L²/(2mk). Matching the root to the power means taking the fourth root, not the cube root.", distractor_type: "half_right" as const },
          { text: "Invert the fraction first, then take a root", correct: false, feedback: "Flipping the fraction changes which way r responds to L and k, which is physically backwards. Keep L²/(2mk) as is and take the fourth root to isolate r.", distractor_type: "misconception" as const }
        ],
        tip: "Match the root to the power: r raised to the nth power is isolated by the nth root."
      },
      {
        type: "solve",
        label: "PREDICT THE FORM",
        icon: "🔮",
        prompt: "Predict the FORM of the orbit radius — a fourth root of a ratio of L², m, and k. Which expression is it?",
        options: [
          { text: "$r = \\left(\\frac{L^2}{2mk}\\right)^{1/4}$", correct: true, feedback: "Given the form you predicted, the algebra lands on `$r = \\left(\\frac{L^2}{2mk}\\right)^{1/4}$` — a fourth root, matching the structure you anticipated." },
          { text: "$r = \\left(\\frac{L^2}{2mk}\\right)^{1/2}$", correct: false, feedback: "That's the half-power form; the worked expression in the recap shows where the exponent settles for r to come out as a length.", distractor_type: "procedural_slip" as const },
          { text: "$r = \\frac{L}{\\sqrt{2mk}}$", correct: false, feedback: "That's the form where L stays to the first power; the worked expression in the recap carries the full fourth root through to r.", distractor_type: "half_right" as const },
          { text: "$r = \\left(\\frac{2mk}{L^2}\\right)^{1/4}$", correct: false, feedback: "That's the inverted-ratio form; the worked expression in the recap keeps L² on top and 2mk underneath for r to grow with L.", distractor_type: "misconception" as const }
        ],
        tip: "Predict the FORM — the root, the ratio, and which symbol sits on top — before trusting the final expression."
      }
    ]
  }
};

// Exposed for the test suite's guard that each example's `solve` correct option
// text stays byte-identical to that example's `final_answer`.
export const __TEST_EXAMPLES = { EXAMPLE_CLASS_11, EXAMPLE_COLLEGE };

// ─── MISCONCEPTION CATALOG ──────────────────────────────────────────────────

const MISCONCEPTIONS_BY_TOPIC: Record<string, Record<string, Array<{id: string; misconception: string; distractorPattern: string}>>> = {
  mechanics: {
    "Newton's Laws": [
      { id: "force-for-motion", misconception: "Continuous force is needed to maintain constant velocity", distractorPattern: "Option implies net force in direction of motion" },
      { id: "action-reaction-cancel", misconception: "Action-reaction forces cancel each other", distractorPattern: "Option says forces cancel so object doesn't move" },
      { id: "centripetal-separate-force", misconception: "Centripetal force is a separate force added to the FBD", distractorPattern: "Option adds Fc as an extra force alongside tension/gravity" },
    ],
    "Kinematics": [
      { id: "velocity-acceleration-same", misconception: "Velocity and acceleration are always in the same direction", distractorPattern: "Option assumes deceleration means negative velocity" },
      { id: "zero-velocity-zero-accel", misconception: "Zero velocity means zero acceleration", distractorPattern: "Option says acceleration is zero at the highest point of projectile" },
    ],
    "Rotational Motion": [
      { id: "torque-equals-force", misconception: "Torque is the same as force", distractorPattern: "Option ignores the moment arm" },
      { id: "angular-momentum-always-conserved", misconception: "Angular momentum is always conserved", distractorPattern: "Option assumes L is conserved even with external torque" },
    ],
    "Work Energy": [
      { id: "ke-proportional-v", misconception: "KE doubles when speed doubles", distractorPattern: "Option uses KE ∝ v instead of KE ∝ v²" },
      { id: "work-equals-fd", misconception: "Work is always F×d regardless of angle", distractorPattern: "Option ignores cos θ in W = Fd cos θ" },
    ],
    "Gravitation": [
      { id: "g-zero-in-orbit", misconception: "Gravity is zero in orbit (weightlessness = no gravity)", distractorPattern: "Option says gravitational force vanishes in orbit" },
    ],
    "Central Forces": [
      { id: "virial-wrong-relation", misconception: "Applying the virial relation from one potential type to another (e.g., K = -U/2 from inverse-square to harmonic U = kr² where K = U)", distractorPattern: "Option uses the wrong virial relation for the given potential" },
    ],
  },
  thermodynamics: {
    "Kinetic Theory": [
      { id: "temp-celsius-in-gas-law", misconception: "Using Celsius directly in gas law formulas", distractorPattern: "Option plugs in °C instead of converting to Kelvin" },
      { id: "rms-vs-avg-speed", misconception: "RMS speed equals average speed", distractorPattern: "Option uses √(8RT/πM) instead of √(3RT/M) or vice versa" },
    ],
    "Thermodynamic Processes": [
      { id: "adiabatic-constant-temp", misconception: "Adiabatic (Q=0) means constant temperature", distractorPattern: "Option assumes T is constant when Q=0" },
      { id: "work-zero-in-cycle", misconception: "Work done in a cycle is zero because ΔV=0", distractorPattern: "Option says W=0 for cyclic process" },
      { id: "heat-temperature-same", misconception: "Heat and temperature are the same quantity", distractorPattern: "Option equates Q with T" },
    ],
    "Carnot Cycle": [
      { id: "efficiency-ratio-celsius", misconception: "Using Celsius temperatures in Carnot efficiency formula", distractorPattern: "Option computes η = 1 - Tc/Th with °C values" },
    ],
  },
  electrodynamics: {
    "Electrostatics": [
      { id: "e-zero-means-v-zero", misconception: "E=0 inside conductor means V=0", distractorPattern: "Option says potential is zero where field vanishes" },
      { id: "field-lines-cross", misconception: "Electric field lines can intersect", distractorPattern: "Option shows or implies crossing field lines" },
    ],
    "Current Electricity": [
      { id: "current-used-up", misconception: "Current is 'used up' by resistors", distractorPattern: "Option says current decreases after passing through a resistor in series" },
      { id: "parallel-same-current", misconception: "Resistors in parallel have the same current", distractorPattern: "Option assumes equal current through unequal parallel resistors" },
    ],
    "Electromagnetic Induction": [
      { id: "lenz-same-direction", misconception: "Induced current creates field in same direction as flux change", distractorPattern: "Option says induced field reinforces the change" },
    ],
    "Electromagnetic Waves": [
      { id: "em-wave-medium-needed", misconception: "EM waves need a medium to propagate", distractorPattern: "Option references medium properties for EM wave speed" },
    ],
    "Gauss Law": [
      { id: "gauss-any-surface", misconception: "Gauss's law only works with symmetric charge distributions", distractorPattern: "Option says Gauss's law cannot be applied here" },
    ],
  },
  quantum_mechanics: {
    "De Broglie Wavelength": [
      { id: "debroglie-only-electrons", misconception: "de Broglie wavelength applies only to electrons", distractorPattern: "Option says macroscopic objects don't have wavelength" },
      { id: "debroglie-uses-c", misconception: "Using speed of light instead of particle speed in λ = h/mv", distractorPattern: "Option substitutes c for v" },
    ],
    "Quantum Mechanics": [
      { id: "bohr-all-atoms", misconception: "Bohr model works for all atoms", distractorPattern: "Option applies Bohr radius formula to multi-electron atom without modification" },
      { id: "energy-levels-equal-spacing", misconception: "Energy levels are equally spaced", distractorPattern: "Option assumes ΔE is constant between levels" },
    ],
    "Wave-Particle Duality": [
      { id: "photon-has-mass", misconception: "Photons have rest mass", distractorPattern: "Option uses E = mc² with rest mass for photon" },
    ],
  },
};

// ─── DIFFICULTY-SPECIFIC INSTRUCTIONS ────────────────────────────────────────

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  class_11: `CLASS 11 (JEE Mains prep, age 16-17):
- Use 5-6 steps. Focus on building correct problem-solving habits.
- Start with the step type that best hooks the student into the problem.
- The trap step should target the most common beginner mistake (wrong units, wrong formula, sign errors).
- Keep math at single-variable algebra, basic calculus (derivatives), and trigonometry.
- Wrong answer feedback should be patient and educational — explain the mistake clearly.
- Recommended step pattern: identify/trap/principle → principle → setup → approach (×1-2) → predict`,

  class_12: `CLASS 12 (JEE Mains/Advanced prep, age 17-18):
- Use 5-6 steps. Problems should require multi-step reasoning.
- Start with the step type that best hooks the student into the problem.
- The trap step should target a subtle conceptual error (not just arithmetic).
- Math can include integration, differential equations, vector calculus basics.
- Wrong answer feedback should be precise — reference the exact formula or concept that was misapplied.
- Recommended step pattern: identify/trap/principle → identify → setup → approach (×1-2) → predict`,

  college: `COLLEGE / JEE ADVANCED (undergraduate level, age 18+):
- Use 6-7 steps. Problems should require deep physical insight.
- Optionally include a "why" step to explain the deeper physics behind a key result.
- The trap should target a sophisticated error (applying a theorem outside its domain, confusing similar-looking results).
- Math can include multivariable calculus, linear algebra, complex analysis, Fourier methods.
- Wrong answer feedback should be rigorous — explain why the wrong approach fails fundamentally, not just numerically.
- Recommended step pattern: identify → principle → setup → approach (×2) → why? → predict`,
};

// ─── GENERATION PIPELINE ─────────────────────────────────────────────────────

interface GeneratedOption {
  text: string;
  correct: boolean;
  feedback: string;
  distractor_type?: "misconception" | "procedural_slip" | "half_right";
}

interface GeneratedClaim {
  statement: string;
  isTrap: boolean;
  feedbackTrap: string;
  feedbackSound: string;
}

interface GeneratedMultiSelectItem {
  text: string;
  matters: boolean;
}

interface GeneratedMultiSelect {
  items: GeneratedMultiSelectItem[];
  feedbackCorrect: string;
  feedbackWrong: string;
}

interface GeneratedBuild {
  tiles: string[];
  accepted: string[][];
  distractors: { tile: string; feedback: string }[];
  feedbackCorrect: string;
  feedbackWrong: string;
}

interface GeneratedStep {
  type: string;
  format?: "mcq" | "claim" | "multiselect" | "build";
  label: string;
  icon: string;
  prompt: string;
  options?: GeneratedOption[];
  claim?: GeneratedClaim;
  multiselect?: GeneratedMultiSelect;
  build?: GeneratedBuild;
  tip: string;
}

interface GeneratedProblem {
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  scenario: string;
  goal: string;
  final_answer: string;
  diagram_type: null;
  solution_flow: {
    steps: GeneratedStep[];
  };
}

const MAX_RETRIES = 2;

// ─── MISCONCEPTION LOOKUP ───────────────────────────────────────────────────

function lookupMisconceptions(subject: string, topic: string): string {
  // Normalize the subject key: lowercase, replace spaces/hyphens
  const normalizeKey = (s: string) => s.toLowerCase().replace(/[-\s]+/g, " ").trim();

  // Find the subject entry
  const subjectKey = Object.keys(MISCONCEPTIONS_BY_TOPIC).find(
    (k) => normalizeKey(k) === normalizeKey(subject)
  );
  if (!subjectKey) return "";

  const subjectMisconceptions = MISCONCEPTIONS_BY_TOPIC[subjectKey];

  // Try exact topic match
  if (subjectMisconceptions[topic]) {
    return formatMisconceptions(subjectMisconceptions[topic]);
  }

  // Try normalized match (lowercase, strip hyphens)
  const normalizedTopic = normalizeKey(topic);
  const normalizedMatch = Object.keys(subjectMisconceptions).find(
    (k) => normalizeKey(k) === normalizedTopic
  );
  if (normalizedMatch) {
    return formatMisconceptions(subjectMisconceptions[normalizedMatch]);
  }

  // Try partial match: either direction substring
  const partialMatch = Object.keys(subjectMisconceptions).find(
    (k) => normalizeKey(k).includes(normalizedTopic) || normalizedTopic.includes(normalizeKey(k))
  );
  if (partialMatch) {
    return formatMisconceptions(subjectMisconceptions[partialMatch]);
  }

  // Fall back to ALL misconceptions for this subject as general reference
  const allMisconceptions = Object.values(subjectMisconceptions).flat();
  if (allMisconceptions.length > 0) {
    return formatMisconceptions(allMisconceptions);
  }

  return "";
}

function formatMisconceptions(items: Array<{id: string; misconception: string; distractorPattern: string}>): string {
  return items
    .map((m) => `- [${m.id}] ${m.misconception}\n  Distractor pattern: ${m.distractorPattern}`)
    .join("\n");
}

// ─── SYSTEM PROMPT BUILDER ──────────────────────────────────────────────────

function buildSystemPrompt(difficulty: string, subject: string, topic: string): string {
  const difficultyInstructions = DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS.class_11;
  const misconceptionSection = lookupMisconceptions(subject, topic);

  let misconceptionBlock = "";
  if (misconceptionSection) {
    misconceptionBlock = `

KNOWN STUDENT MISCONCEPTIONS for this topic:
${misconceptionSection}

When creating wrong options, reference these misconceptions. Each wrong option MUST map to one of these documented errors, a procedural slip, or a half-right answer.`;
  }

  return `You are an expert JEE/NEET physics teacher with 20 years of experience. You create problems for Hawking — a Duolingo-style physics app where students solve problems through guided thinking steps.

Your job is to generate ONE physics problem that teaches students HOW to think, not just WHAT the answer is. Every step should build on the previous one, creating a logical chain from problem to solution.

${STEP_TYPE_GUIDE}

${PER_FORMAT_GUIDE}

${difficultyInstructions}
${misconceptionBlock}

MOBILE-FIRST DESIGN — NO PEN AND PAPER:
This is a mobile app. Students solve problems by TAPPING, not by scribbling on paper.
Every step must be answerable by THINKING, not by computing.

Rules:
- Options should present CHOICES between approaches, principles, or conceptual insights — not numerical results of calculations.
- NEVER ask "What is the value of X?" with options like "42", "84", "21". That requires computation.
- INSTEAD ask "Which approach gives you X?" or "What happens to X when Y changes?" or "Which equation correctly sets up this relationship?"
- The "setup" step should ask "Which equation setup is correct?" — showing 4 equation options, NOT asking the student to derive the equation.
- The "approach" step should ask "How will you derive it?" / "Which simplification gets you there?" — conceptual choices between strategies, NOT asking for arithmetic.
- Think of each step as a DECISION POINT, not a CALCULATION POINT.
- The student should feel like they're making strategic choices, like a game — not doing homework.
- EXCEPTION — the dedicated terminal "solve" step (PREDICT THE FORM): this ONE step asks the student to PREDICT the FORM the final answer takes, so its correct option text IS the final numerical/symbolic answer (equal to final_answer). Even so, it must be answerable by recognition/THINKING, not fresh pen-and-paper arithmetic — the student predicts the form they will arrive at from the "setup"/"approach" steps, not a value they must newly compute here. Its feedback is NON-COMMITTAL (no "correct"/"wrong"/celebration — frame it around the form the student predicted).

CRITICAL QUALITY RULES:

1. PROBLEM SELECTION:
   - The problem MUST have a definite numerical or symbolic answer.
   - It must be a REAL problem that could appear in JEE/NEET exams.
   - Avoid trivial plug-and-chug problems. The problem should require at least one non-obvious insight.

2. STEP FLOW — THE THINKING CHAIN:
   - Steps must form a logical narrative. Each step's answer feeds into the next step.
   - The student should feel like they're being guided by an expert tutor, not quizzed randomly.
   - Never ask a step that doesn't contribute to reaching the final answer.
   - The first step should address the biggest obstacle (usually the trap or identifying the key insight).
   - Cognitive scaffolding: use the "fading" principle — give more support in early steps, less in later steps. Each step should require exactly one decision from the student.

3. WRONG ANSWER OPTIONS — THIS IS THE MOST IMPORTANT PART:
   - Wrong options must be PLAUSIBLE mistakes that real students actually make.
   - Each wrong option MUST include a "distractor_type" field with one of: "misconception", "procedural_slip", or "half_right".
   - Wrong option text must be similar length to correct option text (prevent "longest answer is correct" pattern).
   - Each wrong option's feedback MUST:
     a) Name the specific error ("You used X instead of Y")
     b) Explain WHY it's wrong ("This fails because...")
     c) Redirect toward the correct approach ("Instead, use...")
   - Wrong feedback MUST be minimum 3 sentences and 40+ words. Never just say "incorrect."
   - The three wrong options should represent DIFFERENT types of errors.
   - EXCEPTION — the terminal "solve" (PREDICT THE FORM) step: the rules a)/b)/c)
     above do NOT apply to it. On this ONE step you must NOT name an error or say
     anything is wrong/incorrect. ALL of its option feedback (the correct option
     AND every distractor) must be NON-COMMITTAL — neutrally acknowledge the FORM
     the student picked and defer the worked result to the recap (e.g. "That's the
     half-power form; the worked expression in the recap shows where the exponent
     lands"). BANNED words/phrases on this step: "correct", "wrong", "incorrect",
     "mistake", "instead of", "you should have", "you used", "you added", "you
     subtracted". Do NOT celebrate and do NOT tell the student their pick was right
     or wrong. Every OTHER step type (principle/why/approach) keeps rules a)/b)/c)
     and names the error normally.

4. CORRECT ANSWER FEEDBACK:
   - 1-2 sentences, concise and encouraging.
   - Reinforce why this is the right approach.

5. TIPS:
   - One memorable sentence that the student can use as a rule of thumb.
   - Should be generalizable beyond this specific problem.

6. MATH FORMATTING:
   - Use LaTeX: $F = ma$, $\\\\sqrt{x}$, $\\\\frac{a}{b}$, $x^{2}$
   - Use double backslashes for LaTeX commands: $\\\\sqrt{x}$, $\\\\frac{a}{b}$, $\\\\vec{F}$
   - The "scenario" field should contain the full problem statement with LaTeX.

7. STRUCTURE:
   - "title": Short descriptive title (~80 chars max)
   - "goal": "Find: [answer]" format
   - "final_answer": The numerical/symbolic answer
   - Last step MUST be type "solve" (PREDICT THE FORM): an mcq whose single correct option text equals final_answer, with non-committal feedback (no celebration).
   - The content shape DEPENDS on the step type (see PER-TYPE CONTENT above):
     trap → "claim" object; identify → "multiselect" object; setup → "build" object;
     principle/why/approach/solve → "options" (exactly 4: 1 correct, 3 wrong).
   - For MCQ steps, each wrong option object MUST have: { "text": "...", "correct": false, "feedback": "...", "distractor_type": "misconception" | "procedural_slip" | "half_right" }
   - For MCQ steps, each correct option object has: { "text": "...", "correct": true, "feedback": "..." }`;
}

export async function generateProblem(
  subject: string,
  topic: string,
  difficulty: string
): Promise<GeneratedProblem> {
  const difficultyLabel: Record<string, string> = {
    class_11: "Class 11 (JEE Mains prep)",
    class_12: "Class 12 (JEE Mains/Advanced prep)",
    college: "College / JEE Advanced level",
  };

  const systemPrompt = buildSystemPrompt(difficulty, subject, topic);

  // Pick the right example based on difficulty
  const example = difficulty === "college" ? EXAMPLE_COLLEGE : EXAMPLE_CLASS_11;

  const userPrompt = `Generate ONE physics problem:
- Subject: ${subject}
- Topic: ${topic}
- Difficulty: ${difficultyLabel[difficulty] || difficulty}

BEFORE generating the JSON, think through these steps internally:
1. Pick a specific, interesting problem that tests a key concept in ${topic}.
2. Solve the problem yourself completely — find the final answer.
3. Identify the #1 mistake students make on this type of problem (this becomes the trap step).
4. Design the step-by-step thinking chain that an expert tutor would walk through.
5. For each step, think of three plausible wrong answers that represent real student errors.

Here is an example of the EXACT JSON format and quality bar you must match:

${JSON.stringify(example, null, 2)}

Now generate a NEW, ORIGINAL problem. Return ONLY valid JSON — no markdown, no code fences, no explanation. Just the JSON object.`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o",
        max_tokens: 8192,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI API call failed: ${msg}`);
    }

    const text = response.choices[0]?.message?.content ?? "";

    // Extract JSON from the response (handle potential markdown wrapping)
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let problem: GeneratedProblem;
    try {
      problem = JSON.parse(jsonStr);
    } catch {
      lastError = new Error(`Failed to parse LLM response as JSON. Response started with: ${jsonStr.substring(0, 200)}`);
      if (attempt < MAX_RETRIES) continue;
      throw lastError;
    }

    try {
      // Validate structure and normalize fields
      validateAndNormalize(problem, subject, topic, difficulty);
      return problem;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) continue;
      throw lastError;
    }
  }

  // Should not reach here, but satisfy TypeScript
  throw lastError ?? new Error("Generation failed after retries");
}

// ─── VALIDATION ──────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  trap: "SPOT THE TRAP",
  identify: "IDENTIFY THE KEY",
  principle: "RECALL THE PRINCIPLE",
  setup: "SET UP THE MATH",
  connect: "FAST-TRACK THE SOLVE",
  approach: "PLAN THE DERIVATION",
  solve: "PREDICT THE FORM",
  sanity: "SANITY CHECK",
  why: "WHY THIS WORKS",
};


/**
 * Validates the LLM-generated problem matches the expected schema,
 * normalizes fields, shuffles options, and ensures quality.
 * Named validateAndNormalize (not validateProblem) because it mutates the input.
 */
export function validateAndNormalize(
  problem: GeneratedProblem,
  subject: string,
  topic: string,
  difficulty: string
): void {
  // Ensure required fields exist
  const requiredFields = ["title", "scenario", "goal", "final_answer", "solution_flow"];
  for (const field of requiredFields) {
    if (!(field in problem) || !problem[field as keyof GeneratedProblem]) {
      throw new Error(`Generated problem missing required field: ${field}`);
    }
  }

  // Normalize subject/topic/difficulty to match the request
  problem.subject = subject;
  problem.topic = topic;
  problem.difficulty = difficulty;
  problem.diagram_type = null;

  const steps = problem.solution_flow?.steps;
  if (!steps || !Array.isArray(steps)) {
    throw new Error("solution_flow.steps must be an array");
  }

  if (steps.length < 4 || steps.length > 7) {
    throw new Error(`Expected 4-7 steps, got ${steps.length}`);
  }

  // Last step must be the terminal "solve" (PREDICT THE FORM) step.
  if (steps[steps.length - 1].type !== "solve") {
    throw new Error('Last step must be type "solve"');
  }

  // Exactly one "solve" (predict) step; it is now terminal, so there is no
  // adjacency check — the last-step check above already pins its position.
  const solveCount = steps.filter((s) => s.type === "solve").length;
  const solveIdx = steps.findIndex((s) => s.type === "solve");
  if (solveCount !== 1) {
    throw new Error(`Expected exactly 1 "solve" step, got ${solveCount}`);
  }

  // Bound the number of conceptual "approach" steps. Lower bound 0 is allowed
  // (fewer is fine — fail-soft tolerance); the only hard ceiling is >3.
  const approachCount = steps.filter((s) => s.type === "approach").length;
  if (approachCount > 3) {
    throw new Error(`Expected at most 3 "approach" steps, got ${approachCount}`);
  }

  // HARD BLOCK: newly generated problems must not use retired legacy-only step
  // types. They remain valid for rendering already-stored legacy/seeded problems,
  // but generation (this path) must never emit them. A leaked legacy type throws,
  // which the retry loop turns into a regeneration.
  const legacyOnly = steps.filter((s) => s.type === "connect" || s.type === "sanity");
  if (legacyOnly.length > 0) {
    throw new Error(
      `Legacy-only step types cannot be generated: ${legacyOnly.map((s) => s.type).join(", ")}`
    );
  }

  // Validate each step
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Common required fields (content shape is validated per-format below).
    if (!step.type || !step.prompt || !step.tip) {
      throw new Error(`Step ${i} missing required fields (type, prompt, tip)`);
    }

    // Validate step type
    if (!VALID_STEP_TYPES.includes(step.type as StepType)) {
      throw new Error(`Step ${i} has invalid type "${step.type}". Valid types: ${VALID_STEP_TYPES.join(", ")}`);
    }

    // Derive the authoritative format from the type. If the LLM supplied a
    // conflicting format, reject it; otherwise overwrite it canonically.
    const format = formatForType(step.type as StepType);
    if (step.format && step.format !== format) {
      throw new Error(
        `Step ${i} format "${step.format}" conflicts with type "${step.type}" (expected "${format}")`
      );
    }
    step.format = format;

    // Reject leftover content objects from other formats. Each format owns
    // exactly one content shape; a step carrying a foreign shape (e.g. a trap
    // step with both `claim` and stale `options`) is malformed and would ship
    // contradictory data to the DB/admin payloads even though `format` wins at
    // runtime.
    const FORMAT_FIELDS: Record<StepFormat, keyof GeneratedStep> = {
      mcq: "options",
      claim: "claim",
      multiselect: "multiselect",
      build: "build",
    };
    for (const [fmt, field] of Object.entries(FORMAT_FIELDS) as [
      StepFormat,
      keyof GeneratedStep
    ][]) {
      if (fmt !== format && step[field] != null) {
        throw new Error(
          `Step ${i} (${format}) has a stale "${field}" field from format "${fmt}"`
        );
      }
    }

    // Normalize label and icon
    step.label = STEP_LABELS[step.type] || step.label;
    step.icon = STEP_ICONS[step.type] || step.icon;

    // Common: prompt and tip non-empty
    if (step.prompt.trim().length === 0) {
      throw new Error(`Step ${i} has an empty prompt`);
    }
    if (step.tip.trim().length === 0) {
      throw new Error(`Step ${i} has an empty tip`);
    }

    // HARD HOOK GATE: the first step's prompt must be a substantial hook.
    if (i === 0 && step.prompt.trim().length < 40) {
      throw new Error(
        `Step 0 (hook) prompt must be at least 40 characters, got ${step.prompt.trim().length}`
      );
    }

    switch (format) {
      case "mcq":
        validateMcqStep(step, i);
        break;
      case "claim":
        validateClaimStep(step, i);
        break;
      case "multiselect":
        validateMultiSelectStep(step, i);
        break;
      case "build":
        validateBuildStep(step, i);
        break;
    }
  }

  // WARN-ONLY: the solve step's single correct option text should canonically
  // equal the problem's final_answer. GPT-4o formats answers differently across
  // surfaces, so a mismatch only warns (a hard fail causes spurious retries);
  // the byte-exact example JSONs are what drive compliance.
  const solveStep = steps[solveIdx];
  const solveCorrect = solveStep.options?.find((o) => o.correct);
  if (
    solveCorrect &&
    normalizeAnswer(solveCorrect.text) !== normalizeAnswer(problem.final_answer)
  ) {
    console.warn(
      `Solve step's correct option ("${solveCorrect.text}") may not match final_answer ("${problem.final_answer}")`
    );
  }

  // SANITIZE (not throw): the terminal solve step (PREDICT THE FORM) must have
  // non-committal feedback on ALL options (correct AND distractors). The prompt
  // instructs the model to avoid these words, but GPT-4o drifts often — and
  // "correct" in particular is extremely common in LLM output. Throwing here
  // would burn the small retry budget (MAX_RETRIES) and surface spurious hard
  // generation failures to the user. Instead we replace any option's offending
  // feedback in place with a neutral fallback. This guarantees neutrality with
  // zero added failure rate; the recap below the step carries the real
  // derivation, so a generic neutral line is acceptable for the predict step.
  const SOLVE_BANNED_WORDS = [
    "correct",
    "wrong",
    "incorrect",
    "mistake",
    "instead of",
    "you should have",
    "you used",
    "you added",
    "you subtracted",
  ];
  const NEUTRAL_PREDICT_FALLBACK =
    "See the recap below for the full derivation and where this form lands.";
  if (solveStep.options) {
    for (const opt of solveStep.options) {
      if (!opt.feedback) continue;
      const feedbackLower = opt.feedback.toLowerCase();
      const hasBanned = SOLVE_BANNED_WORDS.some((banned) =>
        feedbackLower.includes(banned)
      );
      if (hasBanned) {
        console.warn(
          `Solve step option feedback contained committal language; replacing with neutral fallback. Option text: "${opt.text.substring(0, 60)}"`
        );
        opt.feedback = NEUTRAL_PREDICT_FALLBACK;
      }
    }
  }
}

/**
 * Canonicalize an answer string so that cross-surface formatting differences
 * (LaTeX wrappers, \frac vs a/b, superscript unicode, exponent grouping,
 * unicode minus, degree sign, whitespace) collapse to a comparable form. Used
 * by the warn-only solve/final_answer equality check. Order matters — \frac is
 * canonicalized BEFORE braces are stripped.
 */
export function normalizeAnswer(s: string): string {
  let out = (s ?? "").toLowerCase();
  // Strip math delimiters.
  out = out.replace(/\$/g, "");
  // Canonicalize \frac{a}{b} -> a/b BEFORE stripping braces.
  out = out.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2");
  // Strip all LaTeX wrappers/commands (\left, \right, and any other backslash-command).
  out = out.replace(/\\[a-zA-Z]+/g, "");
  // Map superscript unicode digits to plain digits.
  const superMap: Record<string, string> = {
    "\u2070": "0",
    "\u00b9": "1",
    "\u00b2": "2",
    "\u00b3": "3",
    "\u2074": "4",
    "\u2075": "5",
    "\u2076": "6",
    "\u2077": "7",
    "\u2078": "8",
    "\u2079": "9",
  };
  out = out.replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]/g, (c) => superMap[c] || c);
  // Strip grouping/exponent punctuation so ^{1/4} and ^(1/4) both -> 1/4.
  out = out.replace(/[\^{}()]/g, "");
  // Unify minus and strip degree.
  out = out.replace(/\u2212/g, "-").replace(/\u00b0/g, "");
  // Remove all whitespace.
  out = out.replace(/\s+/g, "");
  return out;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let j = arr.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [arr[j], arr[k]] = [arr[k], arr[j]];
  }
}

function validateMcqStep(step: GeneratedStep, i: number): void {
  if (!step.options) {
    throw new Error(`Step ${i} (mcq) missing required "options" array`);
  }
  if (step.options.length !== 4) {
    throw new Error(`Step ${i} must have exactly 4 options, got ${step.options.length}`);
  }
  for (const opt of step.options) {
    if (typeof opt.correct !== "boolean") {
      throw new Error(`Step ${i} has an option with non-boolean "correct" field`);
    }
  }
  const correctCount = step.options.filter((o) => o.correct === true).length;
  if (correctCount !== 1) {
    throw new Error(`Step ${i} must have exactly 1 correct option, got ${correctCount}`);
  }

  // Validate feedback quality — general check first (15 chars minimum)
  for (const opt of step.options) {
    if (!opt.text || opt.text.trim().length < 5) {
      throw new Error(`Step ${i} has an option with empty or too-short text`);
    }
    if (!opt.feedback || opt.feedback.trim().length < 15) {
      throw new Error(`Step ${i} has an option with empty or too-short feedback`);
    }
  }

  // Split feedback validation: stricter thresholds by correctness
  for (const opt of step.options) {
    if (!opt.correct) {
      // Wrong options: minimum 50 chars
      if (opt.feedback.trim().length < 50) {
        throw new Error(
          `Step ${i} has a wrong option with feedback below 50 chars: "${opt.feedback.substring(0, 40)}..."`
        );
      }
      // Check distractor_type exists on wrong options — warn only, don't throw
      if (!opt.distractor_type) {
        console.warn(
          `Step ${i}: wrong option missing distractor_type: "${opt.text.substring(0, 40)}..."`
        );
      }
    } else {
      // Correct options: minimum 20 chars
      if (opt.feedback.trim().length < 20) {
        throw new Error(
          `Step ${i} has a correct option with feedback below 20 chars: "${opt.feedback.substring(0, 20)}..."`
        );
      }
    }
  }

  // Check option text length balance: warn if any option >3x longer than shortest
  const optionLengths = step.options.map((o) => o.text.trim().length);
  const shortest = Math.min(...optionLengths);
  const longest = Math.max(...optionLengths);
  if (shortest > 0 && longest > shortest * 3) {
    console.warn(
      `Step ${i}: option text length imbalance (shortest=${shortest}, longest=${longest}, ratio=${(longest / shortest).toFixed(1)}x)`
    );
  }

  // Fisher-Yates shuffle so the correct answer isn't always first
  shuffleInPlace(step.options);
}

function validateClaimStep(step: GeneratedStep, i: number): void {
  const claim = step.claim;
  if (!claim) {
    throw new Error(`Step ${i} (claim) missing required "claim" object`);
  }
  if (!claim.statement || claim.statement.trim().length < 15) {
    throw new Error(`Step ${i} claim.statement must be at least 15 chars`);
  }
  if (typeof claim.isTrap !== "boolean") {
    throw new Error(`Step ${i} claim.isTrap must be a boolean`);
  }
  if (!claim.feedbackTrap || claim.feedbackTrap.trim().length < 40) {
    throw new Error(`Step ${i} claim.feedbackTrap must be at least 40 chars`);
  }
  if (!claim.feedbackSound || claim.feedbackSound.trim().length < 40) {
    throw new Error(`Step ${i} claim.feedbackSound must be at least 40 chars`);
  }
}

function validateMultiSelectStep(step: GeneratedStep, i: number): void {
  const ms = step.multiselect;
  if (!ms) {
    throw new Error(`Step ${i} (multiselect) missing required "multiselect" object`);
  }
  if (!Array.isArray(ms.items) || ms.items.length < 4 || ms.items.length > 6) {
    throw new Error(
      `Step ${i} multiselect.items must have 4-6 items, got ${Array.isArray(ms.items) ? ms.items.length : "none"}`
    );
  }
  for (const item of ms.items) {
    if (!item.text || item.text.trim().length === 0) {
      throw new Error(`Step ${i} multiselect has an item with empty text`);
    }
    if (typeof item.matters !== "boolean") {
      throw new Error(`Step ${i} multiselect item "matters" must be a boolean`);
    }
  }
  const mattersCount = ms.items.filter((it) => it.matters === true).length;
  const notMattersCount = ms.items.filter((it) => it.matters === false).length;
  if (mattersCount < 1) {
    throw new Error(`Step ${i} multiselect must have at least 1 item with matters:true`);
  }
  if (notMattersCount < 1) {
    throw new Error(`Step ${i} multiselect must have at least 1 item with matters:false`);
  }
  if (!ms.feedbackCorrect || ms.feedbackCorrect.trim().length < 40) {
    throw new Error(`Step ${i} multiselect.feedbackCorrect must be at least 40 chars`);
  }
  if (!ms.feedbackWrong || ms.feedbackWrong.trim().length < 40) {
    throw new Error(`Step ${i} multiselect.feedbackWrong must be at least 40 chars`);
  }

  // Shuffle items so the mattering ones aren't always first
  shuffleInPlace(ms.items);
}

// Relation operators that, if a tile carries one at the TOP LEVEL (outside any
// braces/parens), make the tile a (partial or whole) relation rather than an
// atomic fragment. Multi-character LaTeX commands are listed longest-first so a
// shorter command can never shadow a longer one (e.g. "\leqslant" before
// "\leq"). The non-letter lookahead in the scanner is what ultimately
// disambiguates "\le" from "\left", but keeping the list longest-first is a
// cheap safety net.
const LATEX_RELATION_COMMANDS = [
  "\\leqslant",
  "\\geqslant",
  "\\lesssim",
  "\\gtrsim",
  "\\approx",
  "\\propto",
  "\\equiv",
  "\\simeq",
  "\\doteq",
  "\\cong",
  "\\leq",
  "\\geq",
  "\\neq",
  "\\sim",
  "\\le",
  "\\ge",
  "\\ne",
  "\\lt",
  "\\gt",
];
const SINGLE_CHAR_RELATIONS = new Set([
  "=",
  "<",
  ">",
  "\u2264", // ≤
  "\u2265", // ≥
  "\u2260", // ≠
  "\u2248", // ≈
  "\u2261", // ≡
  "\u221d", // ∝
]);

/**
 * A build tile must be an ATOMIC FRAGMENT (a single term, factor, or a bare
 * relation operator on its own), never an already-assembled (partial or whole)
 * relation. A tile carrying a relation operator at the TOP LEVEL — e.g.
 * "$F = ma$" (whole), "$F =$" / "$= ma$" (partial), or "$v \\leq c$" — leaves
 * the student little or nothing to arrange and degrades the build step into a
 * disguised multiple-choice. The lone separator tile (the relation operator by
 * itself, like "=" or "\\leq") is explicitly allowed.
 *
 * A relation operator nested inside braces/parentheses/brackets is NOT a
 * top-level relation — it is part of a single atomic term (a subscript,
 * argument, or evaluation condition such as "$E_{x=0}$", "$v(t=0)$", or
 * "$\\left.\\frac{dV}{dr}\\right|_{r=R}$") and is allowed.
 */
/**
 * Remove grouping wrappers that enclose the ENTIRE tile, so a whole equation the
 * LLM parenthesized (e.g. "(F = ma)" or "\left(F = ma\right)") is not hidden
 * from the top-level relation scan. Only an outermost pair that spans the whole
 * string is stripped; inner groups (subscripts, arguments) are left intact.
 */
function stripEnclosingGroups(s: string): string {
  let prev: string;
  do {
    prev = s;
    s = s.trim();
    // \left( ... \right)  /  \left[ ... \right]  /  \left\{ ... \right\}
    const left = s.match(/^\\left\s*[([{]?/);
    const right = s.match(/\\right\s*[)\]}]?$/);
    if (left && right && left.index === 0) {
      const inner = s.slice(left[0].length, s.length - right[0].length);
      // Only strip if these are the matching OUTERMOST \left...\right (no other
      // \left appears inside, which would mean we'd be merging two groups).
      if (!inner.includes("\\left")) {
        s = inner;
        continue;
      }
    }
    // Plain (...) / [...] spanning the whole string. Bare "{...}" is NOT stripped
    // here: LaTeX braces are grouping (e.g. a braced atomic condition tile like
    // "{x=0}"), so they are left to the depth-based nesting scan rather than
    // unwrapped, which would falsely expose their contents as a top-level relation.
    const open = s[0];
    const close = { "(": ")", "[": "]" }[open];
    if (close && s.endsWith(close)) {
      let depth = 0;
      let spansWhole = true;
      for (let i = 0; i < s.length; i++) {
        if (s[i] === open) depth++;
        else if (s[i] === close) {
          depth--;
          if (depth === 0 && i !== s.length - 1) {
            spansWhole = false; // closes before the end -> not an enclosing pair
            break;
          }
        }
      }
      if (spansWhole && depth === 0) {
        s = s.slice(1, -1);
        continue;
      }
    }
  } while (s !== prev);
  return s;
}

export function tileHasEmbeddedRelation(tile: string): boolean {
  // Strip LaTeX math delimiters and whitespace: "$F = ma$" -> "F = ma".
  const inner = stripEnclosingGroups(tile.replace(/\$+/g, "").trim());

  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "{" || c === "(" || c === "[") {
      depth++;
      continue;
    }
    if (c === "}" || c === ")" || c === "]") {
      if (depth > 0) depth--;
      continue;
    }
    if (depth > 0) continue; // ignore relations nested inside a term

    // Multi-char LaTeX relation command? Require the next char to be a
    // non-letter so "\le" does not match the start of "\left".
    let matched = "";
    for (const cmd of LATEX_RELATION_COMMANDS) {
      if (inner.startsWith(cmd, i)) {
        const after = inner[i + cmd.length];
        if (after === undefined || !/[a-zA-Z]/.test(after)) {
          matched = cmd;
          break;
        }
      }
    }
    if (!matched && SINGLE_CHAR_RELATIONS.has(c)) matched = c;
    if (matched) {
      // A top-level relation is allowed ONLY when the whole tile is exactly that
      // bare operator; any extra content means the tile pre-assembles the relation.
      return inner !== matched;
    }
  }

  return false; // no top-level relation -> atomic fragment
}

function validateBuildStep(step: GeneratedStep, i: number): void {
  const build = step.build;
  if (!build) {
    throw new Error(`Step ${i} (build) missing required "build" object`);
  }
  if (!Array.isArray(build.tiles) || build.tiles.length < 3 || build.tiles.length > 10) {
    throw new Error(
      `Step ${i} build.tiles must have 3-10 tiles, got ${Array.isArray(build.tiles) ? build.tiles.length : "none"}`
    );
  }
  // All tiles must be unique
  const seen = new Set<string>();
  for (const tile of build.tiles) {
    if (typeof tile !== "string" || tile.trim().length === 0) {
      throw new Error(`Step ${i} build has an empty tile`);
    }
    if (seen.has(tile)) {
      throw new Error(`Step ${i} build.tiles has a duplicate tile: "${tile}"`);
    }
    if (tileHasEmbeddedRelation(tile)) {
      throw new Error(
        `Step ${i} build tile "${tile}" embeds a relation operator; tiles must be atomic fragments and the relation operator (e.g. "=") must be its own separate tile`
      );
    }
    seen.add(tile);
  }

  // Accepted arrangements
  if (!Array.isArray(build.accepted) || build.accepted.length === 0) {
    throw new Error(`Step ${i} build.accepted must be a non-empty array`);
  }
  const tileSet = new Set(build.tiles);
  const tilesUsedInAccepted = new Set<string>();
  for (const arrangement of build.accepted) {
    if (!Array.isArray(arrangement) || arrangement.length < 2) {
      throw new Error(`Step ${i} build.accepted arrangement must have length >= 2`);
    }
    const arrSeen = new Set<string>();
    for (const token of arrangement) {
      if (!tileSet.has(token)) {
        throw new Error(`Step ${i} build.accepted references token "${token}" not in tiles`);
      }
      if (arrSeen.has(token)) {
        throw new Error(`Step ${i} build.accepted arrangement repeats token "${token}"`);
      }
      arrSeen.add(token);
      tilesUsedInAccepted.add(token);
    }
  }

  // Distractors
  if (!Array.isArray(build.distractors) || build.distractors.length < 1) {
    throw new Error(`Step ${i} build.distractors must have at least 1 entry`);
  }
  if (build.distractors.length > 3) {
    throw new Error(`Step ${i} build.distractors must have at most 3 entries`);
  }
  for (const d of build.distractors) {
    if (!d.tile || !tileSet.has(d.tile)) {
      throw new Error(`Step ${i} build.distractors tile "${d.tile}" not in tiles`);
    }
    if (tilesUsedInAccepted.has(d.tile)) {
      throw new Error(
        `Step ${i} build.distractors tile "${d.tile}" also appears in an accepted arrangement`
      );
    }
    if (!d.feedback || d.feedback.trim().length < 30) {
      throw new Error(`Step ${i} build.distractors feedback must be at least 30 chars`);
    }
  }

  // Every tile not used in any accepted arrangement is a distractor tile and
  // MUST have its own misconception feedback — otherwise selecting it falls back
  // to the generic feedbackWrong, defeating the point of distractor-specific
  // teaching.
  const distractorTiles = new Set(build.distractors.map((d) => d.tile));
  for (const tile of build.tiles) {
    if (!tilesUsedInAccepted.has(tile) && !distractorTiles.has(tile)) {
      throw new Error(
        `Step ${i} build tile "${tile}" is unused in accepted arrangements and has no distractor entry`
      );
    }
  }

  if (!build.feedbackCorrect || build.feedbackCorrect.trim().length < 40) {
    throw new Error(`Step ${i} build.feedbackCorrect must be at least 40 chars`);
  }
  if (!build.feedbackWrong || build.feedbackWrong.trim().length < 40) {
    throw new Error(`Step ${i} build.feedbackWrong must be at least 40 chars`);
  }

  // Shuffle tiles so distractor/correct order isn't fixed
  shuffleInPlace(build.tiles);
}

// ─── REGENERATE STEPS ───────────────────────────────────────────────────────

export interface RegenerateStepsInput {
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  scenario: string;
  goal: string;
  final_answer: string;
}

export async function regenerateSteps(
  input: RegenerateStepsInput
): Promise<GeneratedProblem["solution_flow"]> {
  const systemPrompt = buildSystemPrompt(input.difficulty, input.subject, input.topic);
  const exampleProblem = input.difficulty === "college" ? EXAMPLE_COLLEGE : EXAMPLE_CLASS_11;

  const userPrompt = `Here is an existing physics problem. Regenerate ONLY the step-by-step solution breakdown. Keep the same problem statement and answer.

Problem:
- Title: ${input.title}
- Subject: ${input.subject}
- Topic: ${input.topic}
- Difficulty: ${input.difficulty}
- Scenario: ${input.scenario}
- Goal: ${input.goal}
- Final Answer: ${input.final_answer}

Here is an example of the step format you must follow:

${JSON.stringify(exampleProblem.solution_flow, null, 2)}

Generate a NEW set of steps for this problem. Return ONLY a JSON object with this shape:
{ "steps": [ ... ] }

EVERY step object MUST include ALL fields shown in the example above, including a
non-empty "tip" string — no step may omit "type", "prompt", or "tip".

Return ONLY valid JSON — no markdown, no code fences, no explanation.`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o",
        max_tokens: 8192,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI API call failed: ${msg}`);
    }

    const text = response.choices[0]?.message?.content ?? "";

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      lastError = new Error(`Failed to parse LLM response as JSON. Response started with: ${jsonStr.substring(0, 200)}`);
      if (attempt < MAX_RETRIES) continue;
      throw lastError;
    }

    // Normalize response shape: handle bare array, { solution_flow: { steps } }, or { steps: [...] }
    let steps: GeneratedProblem["solution_flow"]["steps"];
    if (Array.isArray(parsed)) {
      steps = parsed;
    } else if (parsed.solution_flow?.steps) {
      steps = parsed.solution_flow.steps;
    } else if (parsed.steps) {
      steps = parsed.steps;
    } else {
      lastError = new Error("Response does not contain steps in a recognized format");
      if (attempt < MAX_RETRIES) continue;
      throw lastError;
    }

    const solutionFlow = { steps };

    // Validate via validateAndNormalize on a synthetic problem object
    const syntheticProblem: GeneratedProblem = {
      title: input.title,
      subject: input.subject,
      topic: input.topic,
      difficulty: input.difficulty,
      scenario: input.scenario,
      goal: input.goal,
      final_answer: input.final_answer,
      diagram_type: null,
      solution_flow: solutionFlow,
    };

    try {
      validateAndNormalize(syntheticProblem, input.subject, input.topic, input.difficulty);
      return syntheticProblem.solution_flow;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) continue;
      throw lastError;
    }
  }

  // Should not reach here, but satisfy TypeScript
  throw lastError ?? new Error("Step regeneration failed after retries");
}
