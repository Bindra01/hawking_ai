import {
  formatForType,
  LEGACY_ONLY_STEP_TYPES,
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
   This is the ONE allowed multiple-choice strategy beat — rely on it sparingly
   (at most one MCQ per problem; everything else is build/claim/multiselect).

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

7. THE DERIVATION ROADMAP — after the hook, gamify the DERIVATION ITSELF as an
   ordered roadmap of high-level mathematical MOVES (what goes in, what comes out),
   never the algebra. These types lean on tile-building / claim / multiselect, NOT
   multiple choice. They ALWAYS operate on the SYMBOLIC answer, even when the
   final_answer is a single number — the number is revealed only in the recap.

   A. "roadmap" (🗺️ MAP THE DERIVATION) — build (THE SPINE).
      Purpose: the student taps prose MOVE-tiles into the correct ORDER to build
      the whole derivation map in ONE step. Tiles are relation-free PROSE move-
      labels (e.g. "Solve the governing equation", "Impose the boundary
      conditions", "Read off the energy levels") PLUS plausible WRONG moves as
      distractor tiles (e.g. "Normalize before applying BCs", "Apply BCs before
      solving"). Because the tiles are prose they never embed an equation. The
      "accepted" arrangement must list ALL correct moves in their right order;
      every non-accepted tile is a registered distractor with 30+ char feedback.
      Keep total tiles <= 10 (N correct moves + M distractor moves).

   B. "feeds" (🔌 WHAT GOES IN) — multiselect.
      Purpose: DATA-FLOW. Tap the inputs a move actually consumes; leave the
      same-family red herrings (e.g. a measured value or a time-dependence that
      this move does not use). 4-6 items, >=1 matters:true AND >=1 matters:false,
      feedbackCorrect/feedbackWrong 40+ chars.

   C. "produces" (🔎 WHAT IT PRODUCES) — claim.
      Purpose: RECOGNITION / metacognition. A sounds-right vs it's-a-trap claim
      about what a move just PRODUCED (e.g. "You've solved the equation — that Ψ
      is the final answer" → IT'S A TRAP, because it is only the GENERAL
      wavefunction; boundary conditions still pin it down). statement 15+, isTrap
      boolean, feedbackTrap/feedbackSound 40+ chars.

   D. "form" (🏗️ ASSEMBLE THE FORM) — build (the TERMINAL step).
      Purpose: assemble the SYMBOLIC answer SKELETON from atomic structural tiles
      the student already reasoned out — the root, the ratio, which symbol sits on
      top. NO substituted numbers; "=" is always its own tile. The exact value is
      revealed only in the recap, never picked here. Feedback is NON-COMMITTAL —
      no "correct"/"wrong"/"exactly right"/"perfect"; calmly note the form is
      assembled and the recap carries it through to the value.

   LEAN MECHANIC MIX (HARD REQUIREMENT): a generated flow has AT MOST ONE multiple-
   choice step ("principle"). The roadmap (build) is the spine; feeds (multiselect)
   carries data-flow; produces (claim) carries recognition; the terminal form
   (build) assembles the skeleton. Do NOT pad the flow with extra MCQ beats.

   (The retired "solve"/"depends"/"scale"/"limit" types are NO LONGER generated —
   they stay in the type system only so legacy DB problems keep rendering.)

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

* type "trap" OR "produces"  => emit a "claim" object (NO "options"):
    {
      "statement": "<the bold claim, stated as if true>",
      "isTrap": true | false,            // true = the claim is false / a trap
      "feedbackTrap": "<shown when student taps IT'S A TRAP, 40+ chars>",
      "feedbackSound": "<shown when student taps SOUNDS RIGHT, 40+ chars>"
    }
    // "produces" (WHAT IT PRODUCES) is a recognition beat: a sounds-right vs
    // it's-a-trap claim about what a move just produced (e.g. "that Ψ is the
    // final answer" → IT'S A TRAP, it is only the general wavefunction).

* type "identify" OR "feeds"  => emit a "multiselect" object (NO "options"):
    {
      "items": [ { "text": "<quantity/fact>", "matters": true|false }, ... ],
      // 4-6 items; AT LEAST ONE matters:true AND AT LEAST ONE matters:false.
      // The matters:false items must be plausible same-family red herrings.
      "feedbackCorrect": "<40+ chars>",
      "feedbackWrong": "<40+ chars>"
    }
    // "feeds" (WHAT GOES IN) is the data-flow beat: tap the inputs a move
    // actually consumes; leave the same-family red herrings.

* type "setup" OR "form"  => emit an EQUATION CONTRACT (Contract C, NO "tiles"/
  "accepted"/"distractors" — CODE assembles those deterministically from your
  constrained term arrays):
    {
      "equation": {
        "lhs_terms": [ "<atomic LaTeX fragment>", ... ],   // left side, split into terms/factors
        "relation": "=",                                    // ONE bare operator ("=", "\\leq", ...)
        "rhs_terms": [ "<atomic LaTeX fragment>", ... ],    // right side, split into terms/factors
        "distractor_terms": [ { "term": "<atomic fragment>", "feedback": "<30+ chars>" }, ... ]
        // 1-3 wrong-but-plausible fragments, each NOT belonging in the equation.
      },
      "feedbackCorrect": "<40+ chars>",
      "feedbackWrong": "<40+ chars>"
    }
    // CRITICAL — EVERY term in lhs_terms/rhs_terms/distractor_terms MUST be an
    // ATOMIC, RELATION-FREE fragment: a single term, a single factor — NEVER a
    // whole or partial equation. The "relation" is a SINGLE bare operator on its
    // own. CODE builds the tray as [...lhs_terms, relation, ...rhs_terms,
    // ...distractor_terms] (shuffled) and the accepted arrangement as
    // [...lhs_terms, relation, ...rhs_terms], so the operator is ALWAYS its own
    // tile and no tile can embed a relation.
    //   GOOD: lhs_terms ["$2kr$"], relation "=", rhs_terms ["$\\frac{mv^2}{r}$"],
    //         distractor_terms [{term:"$\\frac{GMm}{r^2}$", feedback:"no gravity here"}]
    //         → assembles to  2kr = mv²/r
    //   BAD  (whole/partial equations in a term, NEVER do this):
    //         "$F = ma$", "$F =$", "$= ma$", "$v \\leq c$"
    // FORM STEP (ASSEMBLE THE FORM, TERMINAL): the terms are the STRUCTURAL atomic
    // fragments of the SYMBOLIC answer skeleton — the root, the ratio, the symbols
    // — with NO substituted numbers (even when the final_answer is numeric, the
    // form stays symbolic; the number appears only in the recap). ALL of its
    // feedback (feedbackCorrect, feedbackWrong, and every distractor feedback)
    // must be NON-COMMITTAL — no 'correct'/'wrong'/'incorrect'/'mistake'/'exactly
    // right'/'perfect'; calmly note the form is assembled and the recap carries it
    // through to the value.

* type "roadmap"  => emit a MOVES CONTRACT (NO "options"/"tiles" — CODE assembles
  the build tiles + accepted ordering from your prose move arrays):
    {
      "moves": [ "<prose move-label>", "<prose move-label>", ... ],
      // The correct high-level moves IN ORDER (relation-free PROSE, e.g.
      // "Solve the governing equation"). The student must place ALL of them.
      "distractor_moves": [ { "move": "<wrong prose move>", "feedback": "<30+ chars>" }, ... ],
      // 1-3 plausible WRONG moves (e.g. "Apply BCs before solving").
      "feedbackCorrect": "<40+ chars>",
      "feedbackWrong": "<40+ chars>"
    }
    // CODE builds tiles = [...moves, ...distractor_moves] (shuffled), accepted =
    // [[...moves]] (every correct move, in order). Keep moves.length +
    // distractor_moves.length <= 10. Each move is plain PROSE — NO equations.

* type "principle"  => emit "options":
    exactly 4 options, exactly 1 correct (the existing MCQ rules below apply).
    This is the ONE allowed multiple-choice strategy beat per problem.

Do NOT add an "options" array to trap/identify/setup/feeds/produces/roadmap/form
steps, and do NOT add claim/multiselect/build objects to the "principle" MCQ type.
`;

// ─── EXAMPLE PROBLEMS (one per difficulty) ───────────────────────────────────

// Class 11 — LEAN 2-move projectile roadmap (4 steps): trap -> roadmap (2 moves)
// -> feeds -> form. setup/form use the Contract-C `equation` shape; roadmap uses
// the `moves` contract. CODE assembles every build step's tiles/accepted from
// these constrained arrays (see assembleBuildFromContract).
const EXAMPLE_CLASS_11 = {
  title: "Range of a projectile launched at 30 m/s and 30° on level ground",
  subject: "mechanics",
  topic: "Projectile Motion",
  difficulty: "class_11",
  scenario: "A projectile is launched at 30 m/s at 30° above the horizontal on level ground (g = 9.8 m/s²). How far away does it land?",
  goal: "Find: ≈ 79.5 m",
  final_answer: "≈ 79.5 m",
  diagram_type: null,
  solution_flow: {
    steps: [
      {
        type: "trap",
        label: "SPOT THE TRAP",
        icon: "⚠️",
        prompt: "Your instinct is to multiply the launch speed by the time of flight — but only the HORIZONTAL velocity carries the projectile downrange. Sound right, or is that a trap?",
        claim: {
          statement: "The range is just the full launch speed multiplied by the total time in the air.",
          isTrap: true,
          feedbackTrap: "Right — it's a trap. Only the horizontal component v·cosθ moves the projectile downrange; the full speed overcounts the horizontal distance.",
          feedbackSound: "Not quite — this is a trap. The vertical component does no horizontal work, so the range uses v·cosθ times the flight time, not the full speed."
        },
        tip: "Resolve velocity into components first — only the horizontal one sets the range."
      },
      {
        type: "roadmap",
        label: "MAP THE DERIVATION",
        icon: "🗺️",
        prompt: "Tap the high-level moves into the ORDER an expert would chain them to reach the range. Two of the tiles are wrong moves — leave them out.",
        build: {
          moves: [
            "Split the launch velocity into horizontal and vertical components",
            "Impose the return-to-ground condition to find the time of flight"
          ],
          distractor_moves: [
            { move: "Find the range before solving for the time of flight", feedback: "The range needs the flight time first; you cannot land the horizontal distance without knowing how long the projectile is airborne." },
            { move: "Assume the vertical velocity stays constant in flight", feedback: "Gravity changes the vertical velocity every instant; treating it as constant breaks the return-to-ground condition entirely." }
          ],
          feedbackCorrect: "Exactly the right plan: resolve the velocity, then use the vertical motion to time the flight before reading off the horizontal range.",
          feedbackWrong: "Rebuild the plan: first split the velocity into components, then impose the return-to-ground condition to get the time of flight."
        },
        tip: "Sequence the moves before touching algebra — components first, timing second."
      },
      {
        type: "feeds",
        label: "WHAT GOES IN",
        icon: "🔌",
        prompt: "For the move that finds the range, tap every quantity that actually feeds into it — and leave the same-family red herrings.",
        multiselect: {
          items: [
            { text: "The launch speed v", matters: true },
            { text: "The launch angle θ", matters: true },
            { text: "The gravitational acceleration g", matters: true },
            { text: "The mass of the projectile", matters: false },
            { text: "The horizontal distance already covered", matters: false }
          ],
          feedbackCorrect: "Right — only the launch speed, the launch angle, and gravity set the range; mass cancels and no prior distance enters.",
          feedbackWrong: "The range depends only on the launch speed, the launch angle, and gravity. Mass never enters projectile range, and no prior distance feeds in."
        },
        tip: "List only the quantities the range truly consumes before assembling it."
      },
      {
        type: "form",
        label: "ASSEMBLE THE FORM",
        icon: "🏗️",
        prompt: "Assemble the SYMBOLIC range relation from the structural tiles — the speed factor, the angle factor, the gravity in the denominator. Build the form; numbers come later.",
        build: {
          equation: {
            lhs_terms: ["R"],
            relation: "=",
            rhs_terms: ["$\\frac{v^2 \\sin 2\\theta}{g}$"],
            distractor_terms: [
              { term: "$\\frac{v \\sin 2\\theta}{g}$", feedback: "That shape carries only a single power of the speed; the recap restores the full speed factor in the form." },
              { term: "$\\frac{v^2 \\sin\\theta}{g}$", feedback: "That arrangement narrows the angle factor; the recap settles where the doubled-angle structure belongs." }
            ]
          },
          feedbackCorrect: "You've assembled the symbolic range; the recap below carries the structure through to its value.",
          feedbackWrong: "Reassemble the skeleton: the range is the speed factor times the angle factor over gravity, which the recap then values."
        },
        tip: "Build the FORMULA first; numbers go in only at the recap."
      }
    ]
  }
};

// Class 12 — LEAN 3-move roadmap (6 steps): trap -> roadmap (3 moves) -> feeds
// -> produces -> setup -> form. Tuned between the class-11 and college examples.
const EXAMPLE_CLASS_12 = {
  title: "Radius of an electron's circular orbit in a uniform magnetic field",
  subject: "electrodynamics",
  topic: "Magnetic Force",
  difficulty: "class_12",
  scenario: "An electron of charge q and mass m enters a uniform magnetic field B at speed v, perpendicular to the field. Find the radius of its circular orbit.",
  goal: "Find: $r = \\frac{mv}{qB}$",
  final_answer: "$r = \\frac{mv}{qB}$",
  diagram_type: null,
  solution_flow: {
    steps: [
      {
        type: "trap",
        label: "SPOT THE TRAP",
        icon: "⚠️",
        prompt: "You see a charge in a field and reach for the electric force qE — but here the field is MAGNETIC, and the force depends on the velocity. Sound right, or is that a trap?",
        claim: {
          statement: "The force bending the electron is just qE, the same electric force a charge feels in any field.",
          isTrap: true,
          feedbackTrap: "Right — it's a trap. A magnetic field exerts qvB, which depends on the speed and is always perpendicular to the velocity, not the speed-independent qE.",
          feedbackSound: "Not quite — this is a trap. The magnetic force is qvB, perpendicular to v, so it supplies the centripetal force; qE is the wrong law here."
        },
        tip: "Read whether the field is electric or magnetic before choosing the force law."
      },
      {
        type: "roadmap",
        label: "MAP THE DERIVATION",
        icon: "🗺️",
        prompt: "Tap the high-level moves into the ORDER that reaches the orbit radius. Two tiles are wrong moves — leave them out.",
        build: {
          moves: [
            "Set the magnetic force equal to the centripetal force",
            "Balance the two forces to isolate the orbit radius",
            "Express the radius through the electron's speed and the field"
          ],
          distractor_moves: [
            { move: "Add gravity into the force balance for the electron", feedback: "Gravity on an electron is utterly negligible next to the magnetic force, so including it corrupts the centripetal balance." },
            { move: "Solve for the orbital period before the radius", feedback: "The period follows from the radius, not the other way round; reaching for it first skips the force balance you actually need." }
          ],
          feedbackCorrect: "Exactly: equate the magnetic and centripetal forces, isolate the radius, then express it through the speed and field.",
          feedbackWrong: "Rebuild the plan: equate the magnetic force to the centripetal force, then isolate the radius before expressing it."
        },
        tip: "Order the moves before algebra — force balance first, isolate the unknown second."
      },
      {
        type: "feeds",
        label: "WHAT GOES IN",
        icon: "🔌",
        prompt: "For the force-balance move, tap every quantity that actually feeds into it — and leave the same-family red herrings.",
        multiselect: {
          items: [
            { text: "The electron charge q", matters: true },
            { text: "The electron speed v", matters: true },
            { text: "The magnetic field strength B", matters: true },
            { text: "The electron mass m", matters: true },
            { text: "An applied electric field E", matters: false },
            { text: "The elapsed time t", matters: false }
          ],
          feedbackCorrect: "Right — the charge, the speed, the field, and the mass set the balance; there is no electric field here and time never enters the radius.",
          feedbackWrong: "The force balance uses the charge, speed, field, and mass only. There is no electric field in this setup, and time does not enter a circular radius."
        },
        tip: "Tap only the quantities the force balance consumes before assembling it."
      },
      {
        type: "produces",
        label: "WHAT IT PRODUCES",
        icon: "🔎",
        prompt: "You set the magnetic force equal to the centripetal force. Sound right, or is that a trap?",
        claim: {
          statement: "Balancing the forces hands you the electron's speed directly as the final answer.",
          isTrap: true,
          feedbackTrap: "Right — it's a trap. The balance is a relation between the radius and the speed; it produces the radius once you isolate it, not the speed.",
          feedbackSound: "Not quite — this is a trap. The force balance produces a relation you must rearrange for the radius; the speed is an input, not the output."
        },
        tip: "Name what a move actually produces — an intermediate relation is not the final answer."
      },
      {
        type: "setup",
        label: "SET UP THE MATH",
        icon: "🔧",
        prompt: "Build the force-balance equation: the magnetic force supplies the centripetal force. Assemble the tiles into the correct relation.",
        build: {
          equation: {
            lhs_terms: ["$qvB$"],
            relation: "=",
            rhs_terms: ["$\\frac{mv^2}{r}$"],
            distractor_terms: [
              { term: "$qE$", feedback: "There is no electric field here; the bending force is magnetic, qvB, not the electric force qE." },
              { term: "$mg$", feedback: "Gravity on an electron is negligible against the magnetic force and has no place in this centripetal balance." }
            ]
          },
          feedbackCorrect: "Clean. The magnetic force qvB supplies exactly the centripetal force mv²/r needed for the circular orbit.",
          feedbackWrong: "Balance the magnetic force against the centripetal requirement: qvB = mv²/r, with no electric or gravitational term."
        },
        tip: "Set the real force equal to the centripetal requirement, then cancel a power of v."
      },
      {
        type: "form",
        label: "ASSEMBLE THE FORM",
        icon: "🏗️",
        prompt: "Assemble the SYMBOLIC form of the orbit radius from the structural tiles — the momentum on top, the charge-field product underneath. Build the form; the value comes later.",
        build: {
          equation: {
            lhs_terms: ["r"],
            relation: "=",
            rhs_terms: ["$\\frac{mv}{qB}$"],
            distractor_terms: [
              { term: "$\\frac{qB}{mv}$", feedback: "That tile inverts the ratio; the recap keeps the momentum on top so the radius grows with the speed." },
              { term: "$\\frac{mv^2}{qB}$", feedback: "That tile keeps an extra power of the speed; the recap settles the radius with a single power of v." }
            ]
          },
          feedbackCorrect: "You've assembled the symbolic radius; the recap below carries the structure through to its value.",
          feedbackWrong: "Reassemble the skeleton: the radius is the momentum over the charge-field product, which the recap then values."
        },
        tip: "Assemble the SHAPE — momentum over the charge-field product — and let the recap fill the value."
      }
    ]
  }
};

// College — LEAN Schrödinger / infinite square well (7 steps): trap -> roadmap
// -> feeds -> produces -> setup -> feeds (BCs) -> form. The richest example;
// demonstrates the full derivation-roadmap spine plus both Contract-C builds.
const EXAMPLE_COLLEGE = {
  title: "Energy levels of a particle in a 1-D infinite square well of width L",
  subject: "quantum_mechanics",
  topic: "Infinite Square Well",
  difficulty: "college",
  scenario: "A particle of mass m is confined to a one-dimensional infinite square well of width L, where the potential is zero inside (0 < x < L) and infinite outside. Find the allowed energy levels.",
  goal: "Find: $E_n = \\frac{n^2\\pi^2\\hbar^2}{2mL^2}$",
  final_answer: "$E_n = \\frac{n^2\\pi^2\\hbar^2}{2mL^2}$",
  diagram_type: null,
  solution_flow: {
    steps: [
      {
        type: "trap",
        label: "SPOT THE TRAP",
        icon: "⚠️",
        prompt: "You reach for a free-particle plane wave e^{ikx} — but the infinite walls change everything. Sound right, or is that a trap?",
        claim: {
          statement: "Inside the well the particle is free, so its state is just a single travelling plane wave.",
          isTrap: true,
          feedbackTrap: "Right — it's a trap. A single travelling wave never vanishes at both walls; the confinement forces a standing-wave combination that the boundary conditions then quantize.",
          feedbackSound: "Not quite — this is a trap. The walls demand the wavefunction vanish at both edges, which a lone travelling plane wave cannot do; you need a standing wave."
        },
        tip: "Before reusing a free-particle solution, check whether boundaries pin the state down."
      },
      {
        type: "roadmap",
        label: "MAP THE DERIVATION",
        icon: "🗺️",
        prompt: "Tap the high-level moves into the ORDER an expert would chain to reach the energy levels. Two tiles are wrong moves — leave them out.",
        build: {
          moves: [
            "Solve the governing equation inside the well",
            "Impose the boundary conditions at the walls",
            "Read off the quantized energy levels"
          ],
          distractor_moves: [
            { move: "Normalize the wavefunction before applying the boundary conditions", feedback: "Normalization fixes the amplitude but never quantizes the energy; doing it first skips the boundary conditions that actually pin the allowed states." },
            { move: "Apply the boundary conditions before solving the equation", feedback: "There is no general solution to constrain yet; imposing boundary conditions before solving leaves nothing for them to act on." }
          ],
          feedbackCorrect: "Exactly the right plan: solve inside the well, impose the walls' boundary conditions, then read off the quantized energies.",
          feedbackWrong: "Rebuild the plan: solve the governing equation first, then impose the boundary conditions, then read off the energy levels."
        },
        tip: "Sequence the moves before algebra — solve, constrain, then read off."
      },
      {
        type: "feeds",
        label: "WHAT GOES IN",
        icon: "🔌",
        prompt: "For the move that solves the governing equation inside the well, tap every quantity that actually feeds into it — and leave the red herrings.",
        multiselect: {
          items: [
            { text: "The potential V(x) = 0 inside the well", matters: true },
            { text: "The particle mass m", matters: true },
            { text: "The reduced Planck constant ℏ", matters: true },
            { text: "A measured energy value from experiment", matters: false },
            { text: "The explicit time-dependence of the state", matters: false }
          ],
          feedbackCorrect: "Right — the zero interior potential, the mass, and ℏ set the equation; no measured energy is assumed and the time-independent equation drops the time-dependence.",
          feedbackWrong: "Solving inside the well uses the zero interior potential, the mass, and ℏ. You do not assume a measured energy, and the time-independent equation has no explicit time."
        },
        tip: "Feed the move only what it consumes — potential, mass, and ℏ here."
      },
      {
        type: "produces",
        label: "WHAT IT PRODUCES",
        icon: "🔎",
        prompt: "Before you build it: the solve-inside move will hand you the energy levels directly. Sound right, or is that a trap?",
        claim: {
          statement: "Solving the governing equation inside the well will produce the final quantized energy levels in one step.",
          isTrap: true,
          feedbackTrap: "Right — it's a trap. Solving inside the well only produces the GENERAL wavefunction Ψ; the boundary conditions still have to pin down which combinations survive before any energy is quantized.",
          feedbackSound: "Not quite — this is a trap. The solve-inside move yields the general wavefunction, not the energies; the boundary conditions must still quantize it afterward."
        },
        tip: "Predict what a move actually produces — a general solution, not the final answer."
      },
      {
        type: "setup",
        label: "SET UP THE MATH",
        icon: "🔧",
        prompt: "Build the time-independent Schrödinger equation for the particle inside the well. Assemble the tiles into the correct relation.",
        build: {
          equation: {
            lhs_terms: ["$-\\frac{\\hbar^2}{2m}\\frac{d^2\\psi}{dx^2}$"],
            relation: "=",
            rhs_terms: ["$E\\psi$"],
            distractor_terms: [
              { term: "$i\\hbar\\frac{\\partial\\psi}{\\partial t}$", feedback: "That is the time-dependent right-hand side; the stationary states obey the time-INDEPENDENT equation, so the energy term belongs here instead." },
              { term: "$V(x)\\psi$", feedback: "Inside the well the potential is zero, so a V(x)Ψ term contributes nothing and does not belong in the interior equation." }
            ]
          },
          feedbackCorrect: "Clean. With V = 0 inside, the kinetic term alone equals EΨ — the time-independent Schrödinger equation for the well.",
          feedbackWrong: "Set the interior kinetic term equal to EΨ: there is no potential term and no time-derivative inside the well."
        },
        tip: "Inside the well V = 0, so the time-independent equation is purely the kinetic term equal to EΨ."
      },
      {
        type: "feeds",
        label: "WHAT GOES IN",
        icon: "🔌",
        prompt: "For the move that imposes the boundary conditions, tap every quantity that actually feeds into it — and leave the red herrings.",
        multiselect: {
          items: [
            { text: "The condition Ψ(0) = 0 at the left wall", matters: true },
            { text: "The condition Ψ(L) = 0 at the right wall", matters: true },
            { text: "The well width L", matters: true },
            { text: "The particle's measured momentum", matters: false },
            { text: "The elapsed time t", matters: false }
          ],
          feedbackCorrect: "Right — the vanishing of Ψ at both walls and the width L are what quantize the wavenumber; momentum and time never enter the boundary conditions.",
          feedbackWrong: "Imposing the walls uses Ψ = 0 at both edges and the width L. A measured momentum and the elapsed time play no part in the boundary conditions."
        },
        tip: "The boundary conditions consume only the wall constraints and the width."
      },
      {
        type: "form",
        label: "ASSEMBLE THE FORM",
        icon: "🏗️",
        prompt: "Assemble the SYMBOLIC energy-level skeleton from the structural tiles — the level index on top, the well width squared underneath. Build the form; numbers come later.",
        build: {
          equation: {
            lhs_terms: ["$E_n$"],
            relation: "=",
            rhs_terms: ["$\\frac{n^2\\pi^2\\hbar^2}{2mL^2}$"],
            distractor_terms: [
              { term: "$\\frac{n\\pi\\hbar}{2mL}$", feedback: "That tile is the quantized wavenumber scale, not the energy; the recap keeps the squared structure that the energy carries." },
              { term: "$\\frac{2mL^2}{n^2\\pi^2\\hbar^2}$", feedback: "That tile inverts the ratio; the recap keeps the level index and ℏ on top so the energy rises with the level number." }
            ]
          },
          feedbackCorrect: "You've assembled the symbolic energy levels; the recap below carries the structure through to its value.",
          feedbackWrong: "Reassemble the skeleton: the energy is the squared level index times ℏ over twice the mass and width squared, which the recap then values."
        },
        tip: "Assemble the SHAPE of the levels — index squared on top, width squared below — and let the recap fill the value."
      }
    ]
  }
};

// Exposed for the test suite's guard that each example's terminal `form` step
// assembles the SYMBOLIC answer skeleton (accepted[0]) and ends the flow.
export const __TEST_EXAMPLES = { EXAMPLE_CLASS_11, EXAMPLE_CLASS_12, EXAMPLE_COLLEGE };

// Picks the difficulty-matched few-shot example for the prompt.
function exampleForDifficulty(difficulty: string) {
  if (difficulty === "college") return EXAMPLE_COLLEGE;
  if (difficulty === "class_12") return EXAMPLE_CLASS_12;
  return EXAMPLE_CLASS_11;
}

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
- Use 4-6 steps (max 8). Focus on building correct problem-solving habits.
- Start with the step type that best hooks the student into the problem.
- The trap step should target the most common beginner mistake (wrong units, wrong formula, sign errors).
- Keep math at single-variable algebra, basic calculus (derivatives), and trigonometry.
- Wrong answer feedback should be patient and educational — explain the mistake clearly.
- Keep the derivation roadmap SHORT (2 moves). The roadmap may gracefully collapse
  to: trap/identify → roadmap (2 moves) → feeds → form.`,

  class_12: `CLASS 12 (JEE Mains/Advanced prep, age 17-18):
- Use 5-7 steps (max 8). Problems should require multi-step reasoning.
- Start with the step type that best hooks the student into the problem.
- The trap step should target a subtle conceptual error (not just arithmetic).
- Math can include integration, differential equations, vector calculus basics.
- Wrong answer feedback should be precise — reference the exact formula or concept that was misapplied.
- Recommended step pattern: trap/identify → roadmap (2-3 moves) → feeds → produces → setup → form.`,

  college: `COLLEGE / JEE ADVANCED (undergraduate level, age 18+):
- Use 6-8 steps. Problems should require deep physical insight.
- The trap should target a sophisticated error (applying a theorem outside its domain, confusing similar-looking results).
- Math can include multivariable calculus, linear algebra, complex analysis, Fourier methods.
- Wrong answer feedback should be rigorous — explain why the wrong approach fails fundamentally, not just numerically.
- Recommended step pattern: trap/identify → roadmap → feeds → produces → setup → feeds (constraints) → form.
- At most ONE multiple-choice (principle) beat, and often zero — lean on roadmap/feeds/produces instead.`,
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

// Contract C — for build-format `setup`/`form` steps the MODEL emits constrained
// term arrays instead of pre-assembled tiles; CODE assembles the tray + accepted
// arrangement so the relation is ALWAYS its own tile and no tile embeds a relation.
interface EquationContract {
  lhs_terms: string[];
  relation: string;
  rhs_terms: string[];
  distractor_terms: { term: string; feedback: string }[];
}

interface GeneratedBuild {
  // Code-assembled fields (also accepted directly for legacy/stored build steps).
  tiles?: string[];
  accepted?: string[][];
  distractors?: { tile: string; feedback: string }[];
  // Contract C: setup/form emit an equation contract; CODE assembles tiles/accepted.
  equation?: EquationContract;
  // Roadmap contract: prose move-labels the student orders; CODE assembles tiles/accepted.
  moves?: string[];
  distractor_moves?: { move: string; feedback: string }[];
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

const MAX_RETRIES = 4;

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
- The "setup" step is a BUILD step: the student assembles atomic equation tiles into the correct setup (drag-and-drop), NOT picking from 4 equation options and NOT deriving the equation by hand.
- Think of each step as a DECISION POINT, not a CALCULATION POINT.
- The student should feel like they're making strategic choices, like a game — not doing homework.
- THE DERIVATION ROADMAP — instead of asking for the worked value, gamify the derivation itself: "roadmap" (MAP THE DERIVATION, a build step where the student taps prose MOVE-tiles into the correct order — the spine), "feeds" (WHAT GOES IN, multiselect — tap the inputs a move consumes), "produces" (WHAT IT PRODUCES, a sounds-right vs it's-a-trap claim about what a move just produced), and "setup" (an equation built from the Contract-C term arrays). The problem ALWAYS ends in "form" (ASSEMBLE THE FORM, TERMINAL): a build step where the student assembles the SYMBOLIC answer skeleton from atomic tiles with NO substituted numbers. The exact value is revealed only in the recap, never picked here. The "form" step's feedback is NON-COMMITTAL (no "correct"/"wrong"/celebration — calmly note the form is assembled and the recap carries it through).
- LEAN, NOT QUIZZY: at most ONE multiple-choice ("principle") beat per problem, often zero. The roadmap (build), feeds (multiselect), and produces (claim) carry the flow.

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
   - EXCEPTION — the terminal "form" (ASSEMBLE THE FORM) build step: the rules
     a)/b)/c) above do NOT apply to its feedback. On this ONE step you must NOT
     name an error or say anything is wrong/incorrect. ALL of its feedback
     (feedbackCorrect, feedbackWrong, AND every distractor feedback) must be
     NON-COMMITTAL — calmly note the form is assembled and defer the worked value
     to the recap (e.g. "That tile reshapes the form; the recap shows where the
     structure settles"). BANNED words/phrases on this step: "correct", "wrong",
     "incorrect", "mistake", "exactly right", "perfect", "nailed", "you got it",
     "instead of", "you should have", "you used", "you added", "you subtracted".
     Do NOT celebrate. The "principle" MCQ step keeps rules a)/b)/c) and names the
     error normally.

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
   - Last step MUST be type "form" (ASSEMBLE THE FORM): a build step that assembles the SYMBOLIC answer skeleton from atomic tiles with NO substituted numbers, with non-committal feedback (no celebration). The exact value is revealed only in the recap.
   - The content shape DEPENDS on the step type (see PER-TYPE CONTENT above):
     trap/produces → "claim" object; identify/feeds → "multiselect" object;
     setup/form → "equation" contract (Contract C term arrays); roadmap → "moves"
     contract; principle → "options" (exactly 4: 1 correct, 3 wrong).
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
  const example = exampleForDifficulty(difficulty);

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
  depends: "WHAT IT INVOLVES",
  scale: "HOW IT SCALES",
  limit: "CHECK THE EXTREME",
  roadmap: "MAP THE DERIVATION",
  produces: "WHAT IT PRODUCES",
  feeds: "WHAT GOES IN",
  form: "ASSEMBLE THE FORM",
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

  if (steps.length < 4 || steps.length > 8) {
    throw new Error(`Expected 4-8 steps, got ${steps.length}`);
  }

  // Last step must be the terminal "form" (ASSEMBLE THE FORM) build step.
  if (steps[steps.length - 1].type !== "form") {
    throw new Error('Last step must be type "form"');
  }

  // Exactly one "form" (assemble) step; it is the terminal step, so there is no
  // adjacency check — the last-step check above already pins its position.
  const formCount = steps.filter((s) => s.type === "form").length;
  if (formCount !== 1) {
    throw new Error(`Expected exactly 1 "form" step, got ${formCount}`);
  }

  // Bound the number of conceptual "approach" steps. Lower bound 0 is allowed
  // (fewer is fine — fail-soft tolerance); the only hard ceiling is >3.
  const approachCount = steps.filter((s) => s.type === "approach").length;
  if (approachCount > 3) {
    throw new Error(`Expected at most 3 "approach" steps, got ${approachCount}`);
  }

  // HARD BLOCK: newly generated problems must not use retired legacy-only step
  // types (see LEGACY_ONLY_STEP_TYPES — now includes depends/scale/limit, which
  // the derivation-roadmap pedagogy replaced). They remain valid for rendering
  // already-stored legacy/seeded problems, but generation (this path) must never
  // emit them. A leaked legacy type throws, which the retry loop turns into a
  // regeneration.
  const legacyOnly = steps.filter((s) =>
    LEGACY_ONLY_STEP_TYPES.includes(s.type as StepType)
  );
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
        // Contract C: if the model supplied a constrained `equation` (setup/form)
        // or `moves` (roadmap) contract instead of pre-assembled tiles, CODE
        // assembles tiles/accepted/distractors deterministically here — BEFORE any
        // feedback sanitization or validation runs. This guarantees the relation
        // operator is always its own tile and no tile can embed a relation.
        if (step.build) {
          assembleBuildFromContract(step.build, step.type, i);
        }
        // For the terminal `form` build step, neutralize committal/celebratory
        // feedback IN PLACE before validating — the length checks must hold AFTER
        // substitution, so this must run before validateBuildStep. Legacy `setup`
        // build steps keep their normal (gradable) feedback untouched.
        if (step.type === "form" && step.build) {
          sanitizeFormFeedback(step.build);
        }
        validateBuildStep(step, i);
        break;
    }
  }

  // NOTE: the terminal `form` build step's feedback is sanitized in place inside
  // the per-step validation loop above, BEFORE validateBuildStep runs (see the
  // `case "build"` branch). Ordering is critical: a short committal string like
  // "Correct!" would otherwise fail the >=40 length check before the neutral
  // fallback could replace it. The exact numeric/symbolic value is revealed only
  // in the recap (CompletionScreen), never assembled with substituted numbers.
}

// Committal/celebratory words the terminal `form` step's feedback must avoid.
// GPT-4o drifts toward these ("correct" in particular) despite the prompt, so we
// sanitize in place rather than hard-throw (which would burn the retry budget).
const FORM_BANNED_WORDS = [
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
// Fallback for feedbackCorrect/feedbackWrong (91 chars, clears the 40 minimum).
const NEUTRAL_FORM_FEEDBACK_FALLBACK =
  "You've assembled the symbolic form — the recap below carries it through to the final value.";
// Fallback for distractor feedback (73 chars, clears the 30 minimum).
const NEUTRAL_FORM_DISTRACTOR_FALLBACK =
  "That tile reshapes the form; the recap shows where the structure settles.";

/**
 * SANITIZE-IN-PLACE (not throw): neutralize committal/celebratory wording on the
 * terminal `form` build step's feedbackCorrect, feedbackWrong, and each
 * distractor feedback. Must run BEFORE validateBuildStep so the length checks
 * still hold after substitution (both fallbacks exceed the 40/30 minimums).
 */
function sanitizeFormFeedback(build: GeneratedBuild): void {
  const hasBanned = (s: string) => {
    const lower = s.toLowerCase();
    return FORM_BANNED_WORDS.some((banned) => lower.includes(banned));
  };
  if (build.feedbackCorrect && hasBanned(build.feedbackCorrect)) {
    console.warn(
      "Form step feedbackCorrect contained committal language; replacing with neutral fallback."
    );
    build.feedbackCorrect = NEUTRAL_FORM_FEEDBACK_FALLBACK;
  }
  if (build.feedbackWrong && hasBanned(build.feedbackWrong)) {
    console.warn(
      "Form step feedbackWrong contained committal language; replacing with neutral fallback."
    );
    build.feedbackWrong = NEUTRAL_FORM_FEEDBACK_FALLBACK;
  }
  for (const d of build.distractors ?? []) {
    if (d.feedback && hasBanned(d.feedback)) {
      console.warn(
        `Form step distractor feedback contained committal language; replacing with neutral fallback. Tile: "${(d.tile ?? "").substring(0, 40)}"`
      );
      d.feedback = NEUTRAL_FORM_DISTRACTOR_FALLBACK;
    }
  }
}

// Synthesized feedback fallbacks for code-assembled build steps when the model
// omitted feedbackCorrect/feedbackWrong (both clear the 40-char build minimum).
const SYNTH_BUILD_FEEDBACK_CORRECT =
  "Exactly — the tiles are arranged into the correct relation, with the operator standing on its own.";
const SYNTH_BUILD_FEEDBACK_WRONG =
  "Not the right arrangement — rebuild the relation so each side's terms sit on the correct side of the operator.";

/**
 * CONTRACT C ASSEMBLER. For build-format steps the model emits constrained,
 * relation-free arrays instead of pre-assembled tiles, and CODE deterministically
 * builds `tiles` / `accepted` / `distractors` from them. This guarantees the
 * relation operator is ALWAYS its own tile and no tile can embed a relation
 * (tileHasEmbeddedRelation can never fire on a code-assembled tile).
 *
 * Two contract shapes are handled:
 *  - `equation` (setup/form): tiles = [...lhs_terms, relation, ...rhs_terms,
 *    ...distractor_terms], accepted = [[...lhs_terms, relation, ...rhs_terms]],
 *    distractors = distractor_terms mapped to { tile, feedback }.
 *  - `moves` (roadmap): tiles = [...moves, ...distractor_moves], accepted =
 *    [[...moves]] (every correct move, in order), distractors = distractor_moves.
 *
 * Legacy/stored build steps that already carry `tiles`/`accepted` (no contract)
 * pass through untouched. Synthesizes feedbackCorrect/feedbackWrong if absent.
 *
 * The contract is type-specific and enforced: `roadmap` MUST use the `moves`
 * contract; `setup`/`form` MUST use the `equation` contract. A step carrying the
 * wrong contract for its type is a hard error, not a silent pass-through.
 */
function assembleBuildFromContract(
  build: GeneratedBuild,
  type: string,
  i: number
): void {
  const wantsMoves = type === "roadmap";
  const hasEquation = build.equation != null;
  const hasMoves = build.moves != null;

  // Legacy/stored build step already carrying tiles/accepted (no contract).
  if (!hasEquation && !hasMoves) {
    return;
  }

  // Enforce the type→contract mapping so a malformed LLM response can't persist
  // a mis-rendered step.
  if (hasEquation && hasMoves) {
    throw new Error(
      `Step ${i} (${type}) build carries BOTH equation and moves contracts; use exactly one`
    );
  }
  if (wantsMoves && hasEquation) {
    throw new Error(
      `Step ${i} (roadmap) build must use the "moves" contract, not "equation"`
    );
  }
  if (!wantsMoves && hasMoves) {
    throw new Error(
      `Step ${i} (${type}) build must use the "equation" contract, not "moves"`
    );
  }

  let acceptedOrder: string[];
  let distractors: { tile: string; feedback: string }[];

  if (hasEquation) {
    // Equation contract (setup / form).
    const eq = build.equation!;
    if (
      !Array.isArray(eq.lhs_terms) ||
      !Array.isArray(eq.rhs_terms) ||
      typeof eq.relation !== "string"
    ) {
      throw new Error(
        `Step ${i} build.equation must have lhs_terms[], relation, rhs_terms[]`
      );
    }
    const distractorTerms = Array.isArray(eq.distractor_terms)
      ? eq.distractor_terms
      : [];
    // Relation is ALWAYS its own tile.
    acceptedOrder = [...eq.lhs_terms, eq.relation, ...eq.rhs_terms];
    distractors = distractorTerms.map((d) => ({
      tile: d.term,
      feedback: d.feedback,
    }));
    delete build.equation;
  } else {
    // Roadmap contract: prose move-labels the student orders.
    if (!Array.isArray(build.moves)) {
      throw new Error(`Step ${i} build.moves must be an array of prose moves`);
    }
    const distractorMoves = Array.isArray(build.distractor_moves)
      ? build.distractor_moves
      : [];
    acceptedOrder = [...build.moves];
    distractors = distractorMoves.map((d) => ({
      tile: d.move,
      feedback: d.feedback,
    }));
    delete build.moves;
    delete build.distractor_moves;
  }

  // Shared assignment for both contract shapes.
  build.accepted = [acceptedOrder];
  build.distractors = distractors;
  build.tiles = [...acceptedOrder, ...distractors.map((d) => d.tile)];

  // Synthesize missing feedback (model may omit it on code-assembled steps).
  if (!build.feedbackCorrect || build.feedbackCorrect.trim().length === 0) {
    build.feedbackCorrect = SYNTH_BUILD_FEEDBACK_CORRECT;
  }
  if (!build.feedbackWrong || build.feedbackWrong.trim().length === 0) {
    build.feedbackWrong = SYNTH_BUILD_FEEDBACK_WRONG;
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
  const exampleProblem = exampleForDifficulty(input.difficulty);

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
