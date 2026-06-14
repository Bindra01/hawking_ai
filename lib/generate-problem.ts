import OpenAI from "openai";
import {
  formatForType,
  StepFormat,
  StepType,
  VALID_STEP_TYPES,
} from "@/lib/types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to your .env.local file to enable problem generation."
      );
    }
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}

// ─── STEP TYPE DEFINITIONS ───────────────────────────────────────────────────

const STEP_TYPE_GUIDE = `
STEP TYPES — choose the right ones based on the problem's structure:

1. "trap" (⚠️ SPOT THE TRAP)
   Purpose: Expose the #1 mistake students make on this problem type.
   USE ONLY WHEN A REAL, SPECIFIC TRAP EXISTS. Not every problem is a trick/trap
   problem — if there is no genuine, classic trap, do NOT invent one; use an
   identify/principle step instead.
   When you do use it, the trap must be a REAL, SPECIFIC mistake — not a generic warning.
   Use varied, creative hooks — do NOT always say "Most students get this wrong because..."
   Example hooks: "Before you start calculating, there's a hidden assumption here...", "This problem looks straightforward, but there's a catch...", "What's the first thing you'd instinctively do? That might be wrong..."
   Example traps: using wrong formula, forgetting unit conversion, confusing similar concepts, applying a formula outside its valid range.

2. "principle" (⚡ RECALL THE PRINCIPLE)
   Purpose: Identify the correct physics law, theorem, or formula to apply.
   Use when the problem requires choosing between multiple possible approaches.
   For hard problems, this step should distinguish between superficially similar principles.

3. "identify" (🎯 LOCK THE ANSWER / IDENTIFY THE KEY)
   Purpose: Identify the key variable, quantity, constraint, or boundary condition.
   Use when the problem has a non-obvious "key insight" that unlocks the solution.

4. "setup" (🔧 SET UP THE MATH)
   Purpose: Write down the mathematical equation or expression.
   Show the actual algebra/calculus step. Use LaTeX for all math.

5. "connect" (🧩 FAST-TRACK THE SOLVE)
   Purpose: Connect two ideas, simplify, or make the algebraic leap to the answer.
   This is where cancellations happen, where two equations combine, where the "aha" moment is.

6. "why" (💡 WHY THIS WORKS)
   Purpose: Explain the deeper physical intuition. Why does this result make sense?
   Use for hard problems where the physics insight is as important as the math.

7. "sanity" (🧪 SANITY CHECK)
   Purpose: Verify the answer makes physical sense. ALWAYS the LAST step.
   Check: units, limiting cases, order of magnitude, physical intuition.

FIRST STEP VARIETY — OPEN ON "HOW DO I START / WHAT'S THE KEY?":
The opening step's real job is to make the student think about HOW to approach the
problem — the KEY to cracking it. Almost every physics problem has a key: a key
formula, a key equation, a key concept, or a governing principle. The opener should
surface that "way in", NOT default to a trap. Many problems are NOT trick/trap
problems at all — do NOT force trap framing onto them.

Pick the opener type that matches what THIS problem actually demands:
- "identify" — surface the key insight / what actually matters: "What's the key
  quantity that unlocks this problem?", "Before diving into equations, what is the
  problem really asking for?"
- "principle" — surface the governing law/equation to reach for first: "Which
  principle governs this situation?", "Two laws seem to apply — which one actually
  controls the answer here?"
- "trap" — ONLY when a real, specific trap genuinely exists for this problem. Use
  varied phrasing, never the canned "Most students get this wrong...". e.g.
  "Your gut says the field is strongest in the middle — but is it?"
- "why" — when intuition is the hook: "Before solving, what should the answer look
  like in the limit?"
Default toward identify/principle openers (the "key" framing). Use trap openers
only when the problem truly has a classic trap — not as a habit.
`;

// ─── PER-FORMAT CONTENT + HOOK + DISTRACTOR RULES ────────────────────────────

const PER_FORMAT_GUIDE = `
EVERY STEP — REQUIRED FIELDS (ALL FORMATS):
Regardless of format (claim, multiselect, build, or options), EVERY step object
MUST include ALL of these top-level fields: "type", "label", "icon", "prompt",
and "tip". The "tip" field is MANDATORY on every single step — a one-sentence
rule-of-thumb the student can reuse. Do NOT omit "tip" on trap/identify/setup
steps just because they carry a claim/multiselect/build object. A step missing
"tip" is INVALID and will be rejected.

STEP 1 HOOK (HARD REQUIREMENT) — FRAME THE "HOW DO I START?" MOMENT:
The FIRST step's "prompt" MUST open with a punchy, problem-specific line that makes
the student think about HOW TO APPROACH this problem — what the KEY to cracking it
is. Almost every physics problem has a "key": the key formula, the key equation,
the key concept, or the governing principle (sometimes a formula AND an equation,
sometimes a principle). The opener's job is to make the student commit to a way IN.
It must be at least 40 characters, must be DIFFERENT for every problem, and must be
specific enough that it could only belong to THIS problem. There is NO fixed canned
sentence — do NOT reuse a template like "Most students get this wrong because...".

NOT EVERY PROBLEM IS A TRAP/TRICK PROBLEM. Do NOT default to "what would you
instinctively (and wrongly) do" or "...that's exactly the trap" framing. Only use
trap/instinct/"lose the marks" tension when the opener is genuinely a "trap" step
(type "trap") AND a real, specific trap actually exists for this problem.

Choose the opener that best matches what this problem actually demands:
- If the hard part is REACHING for the right tool → open on the KEY: "What's the
  governing principle / key equation you reach for first here?" (identify / principle).
- If the hard part is SEPARATING signal from noise → open on what matters
  (identify / multiselect).
- If there IS a classic, specific trap → open on it (trap / claim) with fresh
  tension wording.
The unifying goal: by the end of step 1 the student has consciously chosen HOW to
start, not just answered a quiz question.

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

* all OTHER types ("principle", "connect", "why", "sanity")  => emit "options":
    exactly 4 options, exactly 1 correct (the existing MCQ rules below apply).

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
        type: "connect",
        label: "FAST-TRACK THE SOLVE",
        icon: "🧩",
        prompt: "T(H₂) = 20 K. The question asks for °C. Which conversion approach is correct?",
        options: [
          { text: "Subtract 273: 20 - 273 = -253°C", correct: true, feedback: "Correct. Convert back: °C = K - 273." },
          { text: "Add 273: 20 + 273 = 293°C", correct: false, feedback: "You added instead of subtracting. The conversion from Kelvin to Celsius always subtracts 273, because 0°C = 273 K. Going the other direction (°C → K) is when you add. So 20 K = 20 - 273 = -253°C.", distractor_type: "procedural_slip" as const },
          { text: "Just negate: -20°C", correct: false, feedback: "Negating doesn't convert units. The Kelvin and Celsius scales are offset by 273, not by a sign flip. K → °C requires subtracting 273: 20 - 273 = -253°C. The negative sign in the answer comes from the subtraction, not from negating the Kelvin value.", distractor_type: "half_right" as const },
          { text: "Multiply by 5/9 then subtract 32 (Fahrenheit conversion)", correct: false, feedback: "That's the Fahrenheit-to-Celsius conversion formula, not Kelvin-to-Celsius. The Kelvin and Celsius scales have the same degree size — they're just offset by 273. So the conversion is simply °C = K - 273. No multiplication factor is needed.", distractor_type: "misconception" as const }
        ],
        tip: "K → °C: subtract 273. °C → K: add 273. Never just negate."
      },
      {
        type: "sanity",
        label: "SANITY CHECK",
        icon: "🧪",
        prompt: "H₂ is 16× lighter than O₂ but needs the same RMS speed. -253°C (= 20 K) is near absolute zero. Does this make sense?",
        options: [
          { text: "Yes — lighter molecules move faster at the same T, so H₂ needs very low T to match heavy O₂", correct: true, feedback: "Exactly. Since v ∝ √(T/M), a 16× lighter molecule needs 16× lower temperature for the same speed." },
          { text: "No — temperature can't be that low for a real gas", correct: false, feedback: "The math is correct even if H₂ would liquefy at this temperature. The question asks for the temperature value, not whether it's physically achievable in practice. In JEE problems, ideal gas assumptions apply unless stated otherwise.", distractor_type: "half_right" as const },
          { text: "No — lighter molecules should need higher temperature", correct: false, feedback: "Opposite! Lighter molecules are FASTER at the same temperature (v_rms ∝ 1/√M). To SLOW them down to match the speed of heavier O₂, you need a very low temperature. Think of it as: less mass = less thermal energy needed for the same speed.", distractor_type: "misconception" as const },
          { text: "Yes — but only because we assumed ideal gas behavior", correct: false, feedback: "The ideal gas assumption is standard in JEE problems, but that's not why the answer makes sense. The answer makes physical sense because of the mass-speed relationship: v_rms ∝ √(T/M). A 16× lighter molecule at the same temperature moves 4× faster, so it needs a dramatically lower temperature to slow down to match. The idealness of the gas is a separate consideration.", distractor_type: "procedural_slip" as const }
        ],
        tip: "v_rms ∝ √(T/M). Lighter gas = faster at same T = needs lower T to match heavier gas."
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
  final_answer: "r = (L²/2mk)^(1/4)",
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
        type: "connect",
        label: "FAST-TRACK THE SOLVE",
        icon: "🧩",
        prompt: "From $r^4 = L^2/(2mk)$, which expression correctly isolates r?",
        options: [
          { text: "$r = \\left(\\frac{L^2}{2mk}\\right)^{1/4}$ — take the fourth root", correct: true, feedback: "Clean. Fourth root of both sides." },
          { text: "$r = \\sqrt{\\frac{L^2}{2mk}}$ — take the square root", correct: false, feedback: "That's the square root (power 1/2), but you need the fourth root (power 1/4) since r⁴ = L²/(2mk). The exponent rule is: if r^n = X, then r = X^(1/n). Here n = 4, so you need the 1/4 power, not 1/2. This is a common error when dealing with higher-power equations.", distractor_type: "procedural_slip" as const },
          { text: "$r = \\frac{L}{\\sqrt{2mk}}$ — simplify the fraction under the root", correct: false, feedback: "This would be correct if r² = L²/(2mk), but we have r⁴. You've effectively taken the square root twice on the left (r⁴ → r) but only once on the right (L²/(2mk) → L/√(2mk)). Take the fourth root consistently: r = (L²/2mk)^(1/4).", distractor_type: "half_right" as const },
          { text: "$r = \\left(\\frac{L^2}{2mk}\\right)^{1/2}$ then square root again", correct: false, feedback: "Taking the square root gives r² = (L²/2mk)^(1/2), which is correct as an intermediate step. But then taking the square root again gives r = (L²/2mk)^(1/4) — the same answer as option A. However, writing it as a two-step process introduces opportunities for error. The direct fourth root r = (L²/2mk)^(1/4) is cleaner and less error-prone.", distractor_type: "misconception" as const }
        ],
        tip: "r^n = X → r = X^(1/n). Don't confuse square root with fourth root."
      },
      {
        type: "sanity",
        label: "SANITY CHECK",
        icon: "🧪",
        prompt: "$r = (L^2/2mk)^{1/4}$. If you increase k (stiffer potential), what happens to the orbit radius? Does this match intuition?",
        options: [
          { text: "r decreases — stiffer potential pulls the particle closer, like a stiffer spring", correct: true, feedback: "Correct. k in the denominator means larger k → smaller r. A stronger restoring force confines the orbit." },
          { text: "r increases — stronger force means the particle moves outward", correct: false, feedback: "Stronger restoring force pulls inward, not outward. Think of a stiffer spring — it keeps the mass closer to center. In the formula, k is in the denominator, confirming larger k → smaller r. Physical intuition and math agree.", distractor_type: "misconception" as const },
          { text: "r stays the same — orbit radius depends only on L and m", correct: false, feedback: "k appears explicitly in the formula: r = (L²/2mk)^(1/4). The potential strength directly affects the orbit size. Ignoring a parameter that appears in the answer is a sign-check error — always verify which variables appear in your final expression.", distractor_type: "half_right" as const },
          { text: "r decreases, but only proportionally (halve k → halve r)", correct: false, feedback: "The dependence is r ∝ k^(-1/4), not r ∝ 1/k. Doubling k doesn't halve r — it reduces r by a factor of 2^(1/4) ≈ 1.19. The 1/4 power makes the dependence much weaker than linear. Always check the exponent when reasoning about proportionality.", distractor_type: "procedural_slip" as const }
        ],
        tip: "Always check limiting cases: what happens when parameters increase or decrease?"
      }
    ]
  }
};

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
- Use 5 steps. Focus on building correct problem-solving habits.
- Open on the KEY: start with the opener (identify or principle) that makes the student think about how to approach this problem. Use a trap opener only if this problem has a genuine, classic trap.
- If a trap step is present, it should target the most common beginner mistake (wrong units, wrong formula, sign errors).
- Keep math at single-variable algebra, basic calculus (derivatives), and trigonometry.
- Wrong answer feedback should be patient and educational — explain the mistake clearly.
- Recommended step pattern: identify/principle (the "key") → principle → setup → connect → sanity. Insert a trap step only when a real trap exists.`,

  class_12: `CLASS 12 (JEE Mains/Advanced prep, age 17-18):
- Use 5 steps. Problems should require multi-step reasoning.
- Open on the KEY: start with the opener (identify or principle) that makes the student think about how to approach this problem. Use a trap opener only if this problem has a genuine, classic trap.
- If a trap step is present, it should target a subtle conceptual error (not just arithmetic).
- Math can include integration, differential equations, vector calculus basics.
- Wrong answer feedback should be precise — reference the exact formula or concept that was misapplied.
- Recommended step pattern: identify/principle (the "key") → identify → setup → connect → sanity. Insert a trap step only when a real trap exists.`,

  college: `COLLEGE / JEE ADVANCED (undergraduate level, age 18+):
- Use 5-6 steps. Problems should require deep physical insight.
- Open on the KEY: start with the opener (identify or principle) that surfaces the governing principle or key insight. Use a trap opener only if this problem has a genuine, sophisticated trap.
- Include a "why" step to explain the deeper physics behind a key result.
- If a trap step is present, it should target a sophisticated error (applying a theorem outside its domain, confusing similar-looking results).
- Math can include multivariable calculus, linear algebra, complex analysis, Fourier methods.
- Wrong answer feedback should be rigorous — explain why the wrong approach fails fundamentally, not just numerically.
- Recommended step pattern: identify → principle → setup → connect → why → sanity`,
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
- The "connect" step should ask "What's the key simplification?" — showing conceptual leaps, NOT asking for arithmetic.
- Think of each step as a DECISION POINT, not a CALCULATION POINT.
- The student should feel like they're making strategic choices, like a game — not doing homework.

CRITICAL QUALITY RULES:

1. PROBLEM SELECTION:
   - The problem MUST have a definite numerical or symbolic answer.
   - It must be a REAL problem that could appear in JEE/NEET exams.
   - Avoid trivial plug-and-chug problems. The problem should require at least one non-obvious insight.

2. STEP FLOW — THE THINKING CHAIN:
   - Steps must form a logical narrative. Each step's answer feeds into the next step.
   - The student should feel like they're being guided by an expert tutor, not quizzed randomly.
   - Never ask a step that doesn't contribute to reaching the final answer.
   - The first step should make the student think about how to START — surfacing the KEY (the key formula, equation, concept, or governing principle). Only frame it as a trap when this problem genuinely has one.
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
   - Last step MUST be type "sanity" (an MCQ step with options)
   - The content shape DEPENDS on the step type (see PER-TYPE CONTENT above):
     trap → "claim" object; identify → "multiselect" object; setup → "build" object;
     principle/connect/why/sanity → "options" (exactly 4: 1 correct, 3 wrong).
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
      response = await getClient().chat.completions.create({
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
  sanity: "SANITY CHECK",
  why: "WHY THIS WORKS",
};

const STEP_ICONS: Record<string, string> = {
  trap: "⚠️",
  identify: "🎯",
  principle: "⚡",
  setup: "🔧",
  connect: "🧩",
  sanity: "🧪",
  why: "💡",
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

  // Last step must be sanity
  if (steps[steps.length - 1].type !== "sanity") {
    throw new Error('Last step must be type "sanity"');
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

Return ONLY valid JSON — no markdown, no code fences, no explanation.`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await getClient().chat.completions.create({
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
