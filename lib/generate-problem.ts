import OpenAI from "openai";

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
   The trap must be a REAL, SPECIFIC mistake — not a generic warning.
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
        prompt: "Before touching any formula, what's the crucial first move with the given temperature?",
        options: [
          { text: "Convert to Kelvin: T = 47 + 273 = 320 K — gas laws need absolute temperature", correct: true, feedback: "Right. Gas law temperatures are ALWAYS in Kelvin. T = 320 K." },
          { text: "Use 47°C directly — the formula handles any temperature scale", correct: false, feedback: "Gas kinetic theory formulas require absolute temperature (Kelvin). 47°C = 320 K. Using Celsius gives a completely wrong answer because the gas law equations are derived assuming an absolute scale where zero means zero molecular energy.", distractor_type: "misconception" as const },
          { text: "Identify the molar masses first — temperature conversion isn't needed yet", correct: false, feedback: "Molar masses matter, but the temperature conversion is the critical first step. Every gas law formula uses Kelvin, and skipping this conversion is the #1 source of errors. Convert first: T = 47 + 273 = 320 K, then proceed to set up the equation.", distractor_type: "procedural_slip" as const },
          { text: "Convert to Fahrenheit first — it's the standard for gas calculations", correct: false, feedback: "Physics uses Kelvin for thermodynamic calculations, never Fahrenheit. The Fahrenheit scale has no physical significance in gas kinetics. Convert: T = 47 + 273 = 320 K.", distractor_type: "half_right" as const }
        ],
        tip: "ALL gas law temperatures must be in Kelvin. Always convert first."
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
        prompt: "Which equation setup correctly equates the RMS speeds? $\\sqrt{3R \\times 320/32} = \\sqrt{3RT_{H_2}/2}$",
        options: [
          { text: "Cancel 3R, square both sides: 320/32 = T/2, giving T = 20 K", correct: true, feedback: "Clean. The 3R and square root cancel when you equate, leaving 320/32 = T/2." },
          { text: "Keep the square roots, cross-multiply: T = 320 × 2/32", correct: false, feedback: "You multiplied instead of dividing correctly. When you cross-multiply 320/32 = T/2, you get T = 2 × (320/32) = 2 × 10 = 20 K. The error is in the order of operations — divide first, then multiply. Double-check by substituting back: 320/32 = 10, and 20/2 = 10. ✓", distractor_type: "procedural_slip" as const },
          { text: "Flip the molar mass ratio: T = 320 × 32/2 = 5120 K", correct: false, feedback: "You flipped the ratio. O₂ (M=32) is heavier than H₂ (M=2), so H₂ needs a MUCH lower temperature to match the same RMS speed. Since v_rms ∝ √(T/M), a 16× lighter molecule needs 16× lower temperature for the same speed. T = 20 K.", distractor_type: "misconception" as const },
          { text: "The 3R doesn't cancel because the gases are different", correct: false, feedback: "R is the universal gas constant — it's the same for ALL ideal gases regardless of type. The 'universal' in its name means it doesn't depend on the gas species. Both sides have identical 3R factors, so they cancel cleanly. What differs between the gases is M (molar mass) and T.", distractor_type: "half_right" as const }
        ],
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
        type: "identify",
        label: "IDENTIFY THE KEY",
        icon: "🎯",
        prompt: "Circular orbit in a central force with given U(r) and angular momentum L. What two conditions pin down the orbit radius?",
        options: [
          { text: "Force balance (F = mv²/r) and angular momentum constraint (L = mvr)", correct: true, feedback: "Exactly. Two unknowns (v and r), two equations. This always works for circular orbits in central forces." },
          { text: "Minimize total energy and set kinetic energy equal to potential", correct: false, feedback: "The virial relation depends on the potential: for inverse-square forces K = -U/2, for harmonic U = kr² it's K = U. You can't blindly apply one to the other. Use force balance + angular momentum conservation.", distractor_type: "misconception" as const },
          { text: "Set gravitational force equal to centrifugal force", correct: false, feedback: "This isn't gravity — there's no GM/r² force here. U = kr² gives F = -2kr, a completely different force law. The centripetal acceleration condition is correct in principle, but you need to use the actual force from this potential, not assume it's gravitational.", distractor_type: "half_right" as const },
          { text: "Use conservation of energy alone — total energy E determines r", correct: false, feedback: "Energy conservation gives you one equation with two unknowns (v and r). You need a second constraint to pin down both. Angular momentum L = mvr provides that second equation. Energy alone gives a family of possible orbits, not a unique radius.", distractor_type: "procedural_slip" as const }
        ],
        tip: "Circular orbit = force balance + one constraint (usually angular momentum)."
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
        prompt: "Which substitution correctly combines 2kr = mv²/r with L = mvr to eliminate v?",
        options: [
          { text: "$v = L/(mr)$ → $v^2 = L^2/(m^2r^2)$ → $2kr = L^2/(mr^3)$ → $r^4 = L^2/(2mk)$", correct: true, feedback: "Perfect substitution. v = L/(mr) → v² = L²/(m²r²). Then 2kr = m·L²/(m²r³) = L²/(mr³)." },
          { text: "$v = L/(mr)$ → $2kr = L/(mr^2)$ → $r^3 = L/(2mk)$", correct: false, feedback: "You forgot to square v. When substituting v = L/(mr) into mv²/r, you must use v² = L²/(m²r²), not v = L/(mr²). Forgetting to square is a common algebraic slip that changes the power of r in the final answer from r⁴ to r³. Re-substitute carefully.", distractor_type: "procedural_slip" as const },
          { text: "$v = L/(mr)$ → $2kr^2 = L^2/m$ → $r^2 = L^2/(2mk)$", correct: false, feedback: "Check your algebra. The centripetal term is mv²/r = L²/(mr³), not L²/(mr). When you move terms around, track the powers of r carefully: 2kr = L²/(mr³) gives 2mkr⁴ = L², so r⁴ = L²/(2mk). The r powers matter for the correct exponent in the final answer.", distractor_type: "procedural_slip" as const },
          { text: "Eliminate v using energy conservation E = ½mv² + kr² instead", correct: false, feedback: "Energy conservation introduces E as an additional unknown, giving you one equation with two unknowns (E and r). The force balance approach is cleaner here because it directly relates the force from the potential to the centripetal requirement, and combined with L = mvr, gives two equations for two unknowns (v and r).", distractor_type: "misconception" as const }
        ],
        tip: "When substituting L = mvr, always square v before plugging into F = mv²/r."
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
- Start with the step type that best hooks the student into the problem.
- The trap step should target the most common beginner mistake (wrong units, wrong formula, sign errors).
- Keep math at single-variable algebra, basic calculus (derivatives), and trigonometry.
- Wrong answer feedback should be patient and educational — explain the mistake clearly.
- Recommended step pattern: identify/trap/principle → principle → setup → connect → sanity`,

  class_12: `CLASS 12 (JEE Mains/Advanced prep, age 17-18):
- Use 5 steps. Problems should require multi-step reasoning.
- Start with the step type that best hooks the student into the problem.
- The trap step should target a subtle conceptual error (not just arithmetic).
- Math can include integration, differential equations, vector calculus basics.
- Wrong answer feedback should be precise — reference the exact formula or concept that was misapplied.
- Recommended step pattern: identify/trap/principle → identify → setup → connect → sanity`,

  college: `COLLEGE / JEE ADVANCED (undergraduate level, age 18+):
- Use 5-6 steps. Problems should require deep physical insight.
- Include a "why" step to explain the deeper physics behind a key result.
- The trap should target a sophisticated error (applying a theorem outside its domain, confusing similar-looking results).
- Math can include multivariable calculus, linear algebra, complex analysis, Fourier methods.
- Wrong answer feedback should be rigorous — explain why the wrong approach fails fundamentally, not just numerically.
- Recommended step pattern: identify → principle → setup → connect → why → sanity`,
};

// ─── GENERATION PIPELINE ─────────────────────────────────────────────────────

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
    steps: Array<{
      type: string;
      label: string;
      icon: string;
      prompt: string;
      options: Array<{
        text: string;
        correct: boolean;
        feedback: string;
        distractor_type?: "misconception" | "procedural_slip" | "half_right";
      }>;
      tip: string;
    }>;
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
   - Last step MUST be type "sanity"
   - Each step has exactly 4 options: 1 correct, 3 wrong
   - Each wrong option object MUST have: { "text": "...", "correct": false, "feedback": "...", "distractor_type": "misconception" | "procedural_slip" | "half_right" }
   - Each correct option object has: { "text": "...", "correct": true, "feedback": "..." }`;
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

const VALID_STEP_TYPES = ["trap", "identify", "principle", "setup", "connect", "sanity", "why"];

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
    if (!step.type || !step.prompt || !step.options || !step.tip) {
      throw new Error(`Step ${i} missing required fields (type, prompt, options, tip)`);
    }

    // Validate step type
    if (!VALID_STEP_TYPES.includes(step.type)) {
      throw new Error(`Step ${i} has invalid type "${step.type}". Valid types: ${VALID_STEP_TYPES.join(", ")}`);
    }

    // Normalize label and icon
    step.label = STEP_LABELS[step.type] || step.label;
    step.icon = STEP_ICONS[step.type] || step.icon;

    if (step.options.length !== 4) {
      throw new Error(`Step ${i} must have exactly 4 options, got ${step.options.length}`);
    }
    const correctCount = step.options.filter((o: { correct: boolean }) => o.correct).length;
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
    const optionLengths = step.options.map((o: { text: string }) => o.text.trim().length);
    const shortest = Math.min(...optionLengths);
    const longest = Math.max(...optionLengths);
    if (shortest > 0 && longest > shortest * 3) {
      console.warn(
        `Step ${i}: option text length imbalance (shortest=${shortest}, longest=${longest}, ratio=${(longest / shortest).toFixed(1)}x)`
      );
    }

    // Shuffle options so the correct answer isn't always first
    for (let j = step.options.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [step.options[j], step.options[k]] = [step.options[k], step.options[j]];
    }
  }
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
