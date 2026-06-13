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
   Prompt MUST start with: "Most students get this wrong because..."
   The trap must be a REAL, SPECIFIC mistake — not a generic warning.
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
        type: "trap",
        label: "SPOT THE TRAP",
        icon: "⚠️",
        prompt: "Most students get this wrong because they plug in 47 directly as the temperature. What must you do first?",
        options: [
          { text: "Convert to Kelvin: T = 47 + 273 = 320 K", correct: true, feedback: "Right. Gas law temperatures are ALWAYS in Kelvin. T = 320 K." },
          { text: "Use 47°C directly in the formula", correct: false, feedback: "Gas kinetic theory formulas require absolute temperature (Kelvin). 47°C = 320 K. Using Celsius gives a completely wrong answer." },
          { text: "Convert to Fahrenheit first", correct: false, feedback: "Physics uses Kelvin for thermodynamic calculations, never Fahrenheit. Convert: T = 47 + 273 = 320 K." }
        ],
        tip: "ALL gas law temperatures must be in Kelvin. Always convert first."
      },
      {
        type: "principle",
        label: "RECALL THE PRINCIPLE",
        icon: "⚡",
        prompt: "You need to equate RMS speeds of two different gases. What's the RMS speed formula?",
        options: [
          { text: "$v_{rms} = \\sqrt{3RT/M}$ where M is molar mass", correct: true, feedback: "Correct. R is universal gas constant, T in Kelvin, M is molar mass in kg/mol." },
          { text: "$v_{rms} = \\sqrt{3kT/m}$ where m is total mass of gas", correct: false, feedback: "Close — m here should be the mass of ONE molecule, not total mass. Or use the molar version: $v_{rms} = \\sqrt{3RT/M}$." },
          { text: "$v_{rms} = \\sqrt{2RT/M}$ (from Maxwell distribution)", correct: false, feedback: "That's the most probable speed, not RMS. RMS speed has a factor of 3, not 2: $v_{rms} = \\sqrt{3RT/M}$." }
        ],
        tip: "RMS speed: √(3RT/M). Most probable: √(2RT/M). Mean: √(8RT/πM)."
      },
      {
        type: "setup",
        label: "SET UP THE MATH",
        icon: "🔧",
        prompt: "Set $v_{rms}$(O₂) = $v_{rms}$(H₂): $\\sqrt{3R \\times 320/32} = \\sqrt{3RT_{H_2}/2}$. What simplifies?",
        options: [
          { text: "3R cancels. 320/32 = T/2, so T = 2 × 10 = 20 K", correct: true, feedback: "Clean. The 3R and square root cancel when you equate, leaving 320/32 = T/2." },
          { text: "T = 320 × 2/32 = 640 K", correct: false, feedback: "You multiplied instead of dividing correctly. From 320/32 = T/2: T = 2 × 320/32 = 2 × 10 = 20 K." },
          { text: "T = 320 × 32/2 = 5120 K", correct: false, feedback: "You flipped the ratio. O₂ (M=32) is heavier than H₂ (M=2), so H₂ needs a MUCH lower temperature. T = 20 K." }
        ],
        tip: "When equating speeds, square both sides first to eliminate the square root."
      },
      {
        type: "connect",
        label: "FAST-TRACK THE SOLVE",
        icon: "🧩",
        prompt: "T(H₂) = 20 K. But the question asks for the answer in °C. What is it?",
        options: [
          { text: "20 - 273 = -253°C", correct: true, feedback: "Correct. Convert back: °C = K - 273." },
          { text: "20 + 273 = 293°C", correct: false, feedback: "You added instead of subtracting. To convert K → °C: subtract 273. So 20 - 273 = -253°C." },
          { text: "-20°C (just negate the Kelvin value)", correct: false, feedback: "Negating doesn't convert units. K → °C requires subtracting 273: 20 - 273 = -253°C." }
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
          { text: "No — temperature can't be that low for a real gas", correct: false, feedback: "The math is correct even if H₂ would liquefy. The question asks for the temperature, not whether it's physically achievable." },
          { text: "No — lighter molecules should need higher temperature", correct: false, feedback: "Opposite! Lighter molecules are FASTER at the same temperature. To SLOW them down to match O₂, you need very low T." }
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
          { text: "Minimize total energy and set kinetic energy equal to potential", correct: false, feedback: "KE = PE isn't a general rule — it holds for inverse-square forces (virial theorem) but not for U = kr². Use force balance + angular momentum." },
          { text: "Set gravitational force equal to centrifugal force", correct: false, feedback: "This isn't gravity — there's no GM/r² force here. U = kr² gives F = -2kr, a completely different force law." }
        ],
        tip: "Circular orbit = force balance + one constraint (usually angular momentum)."
      },
      {
        type: "principle",
        label: "RECALL THE PRINCIPLE",
        icon: "⚡",
        prompt: "How do you get the force from U(r) = kr²?",
        options: [
          { text: "F = -dU/dr = -2kr (force is the negative gradient of potential)", correct: true, feedback: "Right. F = -dU/dr is the fundamental relation. For U = kr²: F = -2kr (restoring force, directed inward)." },
          { text: "F = U/r = kr (just divide by r)", correct: false, feedback: "F = U/r is dimensionally coincidental but physically wrong. Force is the negative gradient: F = -dU/dr = -2kr." },
          { text: "F = -dU/dt (differentiate with respect to time)", correct: false, feedback: "dU/dt gives power (rate of energy change), not force. Force comes from the spatial derivative: F = -dU/dr." }
        ],
        tip: "Force from potential: F = -dU/dr. Always differentiate w.r.t. position, not time."
      },
      {
        type: "setup",
        label: "SET UP THE MATH",
        icon: "🔧",
        prompt: "For a circular orbit: |F| = mv²/r gives 2kr = mv²/r. Using L = mvr → v = L/(mr), substitute into the force equation. What do you get?",
        options: [
          { text: "$2kr = \\frac{L^2}{mr^3}$, so $r^4 = \\frac{L^2}{2mk}$", correct: true, feedback: "Perfect substitution. v = L/(mr) → v² = L²/(m²r²). Then 2kr = m·L²/(m²r³) = L²/(mr³)." },
          { text: "$2kr = \\frac{L}{mr^2}$, so $r^3 = \\frac{L}{2mk}$", correct: false, feedback: "You forgot to square v. v = L/(mr) means v² = L²/(m²r²), not v = L/(mr²). Re-substitute carefully." },
          { text: "$2kr² = L^2/m$, so $r^2 = \\frac{L^2}{2mk}$", correct: false, feedback: "Check your algebra. The centripetal term is mv²/r = L²/(mr³), not L²/(mr). The r powers matter." }
        ],
        tip: "When substituting L = mvr, always square v before plugging into F = mv²/r."
      },
      {
        type: "connect",
        label: "FAST-TRACK THE SOLVE",
        icon: "🧩",
        prompt: "From r⁴ = L²/(2mk), what is r?",
        options: [
          { text: "$r = \\left(\\frac{L^2}{2mk}\\right)^{1/4}$", correct: true, feedback: "Clean. Fourth root of both sides." },
          { text: "$r = \\sqrt{\\frac{L^2}{2mk}}$", correct: false, feedback: "That's the square root (power 1/2), but you need the fourth root (power 1/4) since r⁴ = L²/(2mk)." },
          { text: "$r = \\frac{L}{\\sqrt{2mk}}$", correct: false, feedback: "This would be correct if r² = L²/(2mk), but we have r⁴. Take the fourth root: r = (L²/2mk)^(1/4)." }
        ],
        tip: "r^n = X → r = X^(1/n). Don't confuse square root with fourth root."
      },
      {
        type: "sanity",
        label: "SANITY CHECK",
        icon: "🧪",
        prompt: "$r = (L^2/2mk)^{1/4}$. If you increase k (stiffer potential), what happens to the orbit radius? Does this match intuition?",
        options: [
          { text: "r decreases — stiffer potential pulls the particle closer, which makes sense", correct: true, feedback: "Correct. k in the denominator means larger k → smaller r. A stronger restoring force confines the orbit." },
          { text: "r increases — stronger force means the particle moves outward", correct: false, feedback: "Stronger restoring force pulls inward, not outward. Think of a stiffer spring — it keeps the mass closer to center." },
          { text: "r stays the same — orbit radius depends only on L and m", correct: false, feedback: "k appears in the formula. The potential strength directly affects the orbit size. Stiffer potential = tighter orbit." }
        ],
        tip: "Always check limiting cases: what happens when parameters increase or decrease?"
      }
    ]
  }
};

// ─── DIFFICULTY-SPECIFIC INSTRUCTIONS ────────────────────────────────────────

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  class_11: `CLASS 11 (JEE Mains prep, age 16-17):
- Use 5 steps. Focus on building correct problem-solving habits.
- The trap step should target the most common beginner mistake (wrong units, wrong formula, sign errors).
- Keep math at single-variable algebra, basic calculus (derivatives), and trigonometry.
- Wrong answer feedback should be patient and educational — explain the mistake clearly.
- Recommended step pattern: trap → principle → setup → connect → sanity`,

  class_12: `CLASS 12 (JEE Mains/Advanced prep, age 17-18):
- Use 5 steps. Problems should require multi-step reasoning.
- The trap step should target a subtle conceptual error (not just arithmetic).
- Math can include integration, differential equations, vector calculus basics.
- Wrong answer feedback should be precise — reference the exact formula or concept that was misapplied.
- Recommended step pattern: trap → identify → setup → connect → sanity`,

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
      }>;
      tip: string;
    }>;
  };
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

  const difficultyInstructions = DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS.class_11;

  // Pick the right example based on difficulty
  const example = difficulty === "college" ? EXAMPLE_COLLEGE : EXAMPLE_CLASS_11;

  const systemPrompt = `You are an expert JEE/NEET physics teacher with 20 years of experience. You create problems for Hawking — a Duolingo-style physics app where students solve problems through guided thinking steps.

Your job is to generate ONE physics problem that teaches students HOW to think, not just WHAT the answer is. Every step should build on the previous one, creating a logical chain from problem to solution.

${STEP_TYPE_GUIDE}

${difficultyInstructions}

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

3. WRONG ANSWER OPTIONS — THIS IS THE MOST IMPORTANT PART:
   - Wrong options must be PLAUSIBLE mistakes that real students actually make.
   - Each wrong option's feedback MUST:
     a) Name the specific error ("You used X instead of Y")
     b) Explain WHY it's wrong ("This fails because...")
     c) Redirect toward the correct approach ("Instead, use...")
   - Wrong feedback should be 2-3 sentences. Never just say "incorrect."
   - The two wrong options should represent DIFFERENT types of errors.

4. CORRECT ANSWER FEEDBACK:
   - Brief and encouraging (1-2 sentences).
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
   - Each step has exactly 3 options: 1 correct, 2 wrong`;

  const userPrompt = `Generate ONE physics problem:
- Subject: ${subject}
- Topic: ${topic}
- Difficulty: ${difficultyLabel[difficulty] || difficulty}

BEFORE generating the JSON, think through these steps internally:
1. Pick a specific, interesting problem that tests a key concept in ${topic}.
2. Solve the problem yourself completely — find the final answer.
3. Identify the #1 mistake students make on this type of problem (this becomes the trap step).
4. Design the step-by-step thinking chain that an expert tutor would walk through.
5. For each step, think of two plausible wrong answers that represent real student errors.

Here is an example of the EXACT JSON format and quality bar you must match:

${JSON.stringify(example, null, 2)}

Now generate a NEW, ORIGINAL problem. Return ONLY valid JSON — no markdown, no code fences, no explanation. Just the JSON object.`;

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
    throw new Error(`Failed to parse LLM response as JSON. Response started with: ${jsonStr.substring(0, 200)}`);
  }

  // Validate structure and normalize fields
  validateAndNormalize(problem, subject, topic, difficulty);

  return problem;
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

    if (step.options.length !== 3) {
      throw new Error(`Step ${i} must have exactly 3 options, got ${step.options.length}`);
    }
    const correctCount = step.options.filter((o: { correct: boolean }) => o.correct).length;
    if (correctCount !== 1) {
      throw new Error(`Step ${i} must have exactly 1 correct option, got ${correctCount}`);
    }

    // Validate feedback quality — each wrong option must have substantive feedback
    for (const opt of step.options) {
      if (!opt.text || opt.text.trim().length < 5) {
        throw new Error(`Step ${i} has an option with empty or too-short text`);
      }
      if (!opt.feedback || opt.feedback.trim().length < 15) {
        throw new Error(`Step ${i} has an option with empty or too-short feedback`);
      }
    }

    // Shuffle options so the correct answer isn't always first
    for (let j = step.options.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [step.options[j], step.options[k]] = [step.options[k], step.options[j]];
    }
  }
}

// ─── XP CALCULATION ──────────────────────────────────────────────────────────

export function calcXP(stepsCorrect: number, stepsTotal: number): number {
  const base = stepsCorrect * 10;
  const bonus = stepsCorrect === stepsTotal ? 30 : 0;
  return base + bonus;
}

export function calcStars(stepsCorrect: number, stepsTotal: number): number {
  const pct = stepsCorrect / stepsTotal;
  if (pct === 1) return 3;
  if (pct >= 0.6) return 2;
  if (pct >= 0.3) return 1;
  return 0;
}
