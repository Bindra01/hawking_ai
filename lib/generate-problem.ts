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

// One example problem to show the LLM the exact format and quality bar
const EXAMPLE_PROBLEM = {
  title: "An object with mass 500 g moves along x-axis with speed v = 4√x m/s. The force acting on the object is?",
  subject: "mechanics",
  topic: "Kinematics",
  difficulty: "class_11",
  scenario: "An object with mass 500 g moves along x-axis with speed v = 4$\\\\sqrt{x}$ m/s. The force acting on the object is?",
  goal: "Find: 4 N",
  final_answer: "4 N",
  diagram_type: null,
  solution_flow: {
    steps: [
      {
        type: "trap",
        label: "SPOT THE TRAP",
        icon: "⚠️",
        prompt: "Most students get this wrong because they try to find acceleration as dv/dt. But velocity is given as a function of x, not t. What should you do?",
        options: [
          { text: "Use a = v(dv/dx) since v is a function of x", correct: true, feedback: "Exactly! When v = f(x), the chain rule gives a = v(dv/dx). This is the key move." },
          { text: "Differentiate v = 4$\\\\sqrt{x}$ directly w.r.t. time to get a", correct: false, feedback: "You don't have v(t) — you have v(x). Differentiating w.r.t. time needs x(t), which isn't given. Use the chain rule: a = dv/dt = (dv/dx)(dx/dt) = v(dv/dx)." },
          { text: "Use v² = u² + 2as to find a directly", correct: false, feedback: "v² = u² + 2as assumes constant acceleration — but you haven't proven that yet. Derive it from v(x) using a = v(dv/dx)." }
        ],
        tip: "v = f(x) — use a = v(dv/dx). v = f(t) — use a = dv/dt."
      },
      {
        type: "setup",
        label: "SET UP THE MATH",
        icon: "🔧",
        prompt: "$v = 4x^{1/2}$. What is dv/dx?",
        options: [
          { text: "$2 / \\\\sqrt{x}$", correct: true, feedback: "Clean. Power rule: d/dx of 4x^(1/2) = 4 ×(1/2) ×$x^{-1/2}$ = 2x^(-1/2)." },
          { text: "$4 / \\\\sqrt{x}$", correct: false, feedback: "You forgot to multiply the coefficient. d/dx of 4x^(1/2) = 4 × ½ × $x^{-1/2}$. The 4 × ½ = 2, not 4." },
          { text: "$2\\\\sqrt{x}$", correct: false, feedback: "You brought the power down correctly but didn't reduce the exponent. $x^{1/2}$ becomes $x^{-1/2}$ after differentiation." }
        ],
        tip: "d/dx of x^n = n·$x^{n-1}$. Never rush the constant."
      },
      {
        type: "connect",
        label: "FAST-TRACK THE SOLVE",
        icon: "🧩",
        prompt: "Now compute a = v · (dv/dx) = 4$\\\\sqrt{x}$ · (2/$\\\\sqrt{x}$). What happens?",
        options: [
          { text: "$\\\\sqrt{x}$ cancels out — acceleration = 8 m/s² (constant!)", correct: true, feedback: "Beautiful cancellation. $\\\\sqrt{x}$ ×(1/$\\\\sqrt{x}$) = 1. So a = 8 m/s²." },
          { text: "You get 8x, acceleration depends on position", correct: false, feedback: "Check your exponent algebra. $\\\\sqrt{x}$ ×(1/$\\\\sqrt{x}$) = 1, not x." },
          { text: "You get 8/x, acceleration decreases with x", correct: false, feedback: "You inverted incorrectly. The half-powers cancel: (+1/2) + (-1/2) = 0." }
        ],
        tip: "When terms cancel to give constant acceleration, expect a clean final answer."
      },
      {
        type: "identify",
        label: "LOCK THE ANSWER",
        icon: "🎯",
        prompt: "$F = ma$. Mass is 500 g and a = 8 m/s². What is the force?",
        options: [
          { text: "4 N (convert 500 g = 0.5 kg first)", correct: true, feedback: "Nailed it. 0.5 kg ×8 m/s² = 4 N." },
          { text: "4000 N (used 500 directly without converting)", correct: false, feedback: "F = ma needs kg, not grams. 500 g = 0.5 kg. So F = 0.5 ×8 = 4 N." },
          { text: "8 N (forgot to multiply by mass)", correct: false, feedback: "That's just the acceleration. F = ma, not F = a. Multiply by mass: 0.5 × 8 = 4 N." }
        ],
        tip: "Always convert to SI units before plugging into any formula."
      },
      {
        type: "sanity",
        label: "SANITY CHECK",
        icon: "🧪",
        prompt: "We got F = 4 N (constant). Does this make physical sense for v = 4$\\\\sqrt{x}$?",
        options: [
          { text: "Yes — constant force means constant acceleration, consistent with v ∝ √x", correct: true, feedback: "Exactly. From v² = 16x, compare with v² = u² + 2as — 2a = 16, a = 8 = constant." },
          { text: "No — force should increase because speed increases with x", correct: false, feedback: "Speed increasing doesn't mean force is increasing. v² = 16x has the form v² = 2as, confirming constant acceleration." },
          { text: "No — force should be zero since there's no explicit time dependence", correct: false, feedback: "Force doesn't require explicit time dependence. The velocity changes with position, meaning the object accelerates." }
        ],
        tip: "Compare your result's form with known kinematic equations as a quick check."
      }
    ]
  }
};

const STEP_TYPE_GUIDE = `
Step types and their purposes (use 4-5 of these per problem, always end with "sanity"):
- "trap" (icon: ⚠️, label: "SPOT THE TRAP") — Expose the most common mistake students make. Start the prompt with "Most students get this wrong because..."
- "identify" (icon: 🎯, label: "LOCK THE ANSWER" or "IDENTIFY THE KEY") — Identify the key variable, quantity, or concept needed.
- "principle" (icon: ⚡, label: "RECALL THE PRINCIPLE") — Recall or select the correct physics principle/law/formula.
- "setup" (icon: 🔧, label: "SET UP THE MATH") — Set up the mathematical expression or equation.
- "connect" (icon: 🧩, label: "FAST-TRACK THE SOLVE") — Connect two ideas or simplify to reach the answer.
- "sanity" (icon: 🧪, label: "SANITY CHECK") — Verify the final answer makes physical sense. ALWAYS the last step.
- "why" (icon: 💡, label: "WHY THIS WORKS") — Explain the deeper physical intuition behind a step.
`;

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
  const difficultyDescription: Record<string, string> = {
    class_11: "Class 11 level (Indian CBSE/JEE Mains prep, age 16-17)",
    class_12: "Class 12 level (Indian CBSE/JEE Mains prep, age 17-18)",
    college: "College/JEE Advanced level (undergraduate physics, age 18+)",
  };

  const prompt = `You are an expert physics teacher creating problems for an app called Hawking — a Duolingo-style physics problem-solving app for Indian students preparing for JEE/NEET.

Generate ONE physics problem for:
- Subject: ${subject}
- Topic: ${topic}
- Difficulty: ${difficultyDescription[difficulty] || difficulty}

${STEP_TYPE_GUIDE}

CRITICAL RULES:
1. The problem MUST be a numerical/conceptual physics problem with a definite answer.
2. Generate exactly 5 steps. The last step MUST be type "sanity".
3. Each step has exactly 3 options: 1 correct, 2 wrong.
4. Wrong option feedback MUST explain WHY it's wrong AND guide toward the correct approach. Be specific — reference the actual numbers/formulas.
5. Correct option feedback should be encouraging but brief (1-2 sentences).
6. Tips should be concise, memorable rules (1 sentence max).
7. Use LaTeX for math: wrap expressions in $...$ (e.g., $F = ma$, $\\sqrt{x}$, $x^{2}$). Use double backslashes for LaTeX commands (e.g., $\\\\sqrt{x}$, $\\\\frac{a}{b}$).
8. The "scenario" field should contain the full problem statement with LaTeX math.
9. The "title" should be a short, descriptive title (truncated if needed, ~80 chars max).
10. The "goal" should be "Find: [answer]" format.
11. Make the problem feel like a real JEE/NEET question — tricky but fair.
12. The trap step should target a REAL common mistake that students actually make on this type of problem.

Here is an example of a perfect problem in the exact JSON format you must follow:

${JSON.stringify(EXAMPLE_PROBLEM, null, 2)}

Now generate a NEW, ORIGINAL problem. Return ONLY valid JSON — no markdown, no code fences, no explanation. Just the JSON object.`;

  let responseText: string;
  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    responseText = response.choices[0]?.message?.content || "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI API call failed: ${msg}`);
  }

  // Extract JSON from the response (handle potential markdown wrapping)
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let problem: GeneratedProblem;
  try {
    problem = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse LLM response as JSON. Response started with: ${jsonStr.slice(0, 200)}`
    );
  }

  // Validate structure and normalize fields to match the request
  validateAndNormalize(problem, subject, topic, difficulty);

  return problem;
}

/**
 * Validates the LLM-generated problem matches the expected schema,
 * and normalizes subject/topic/difficulty to match the original request
 * (the LLM may rephrase or change casing).
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
    if (!(field in problem)) {
      throw new Error(`Generated problem missing required field: ${field}`);
    }
  }

  // Override subject/topic/difficulty to match the request (LLM might change them)
  problem.subject = subject;
  problem.topic = topic;
  problem.difficulty = difficulty;
  problem.diagram_type = null;

  // Validate steps
  const steps = problem.solution_flow?.steps;
  if (!Array.isArray(steps) || steps.length < 4 || steps.length > 7) {
    throw new Error(`Expected 4-7 steps, got ${steps?.length}`);
  }

  // Validate last step is sanity
  if (steps[steps.length - 1].type !== "sanity") {
    throw new Error("Last step must be type 'sanity'");
  }

  // Validate each step
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.type || !step.prompt || !step.options || !step.tip) {
      throw new Error(`Step ${i} missing required fields`);
    }
    if (step.options.length !== 3) {
      throw new Error(`Step ${i} must have exactly 3 options, got ${step.options.length}`);
    }
    const correctCount = step.options.filter((o: { correct: boolean }) => o.correct).length;
    if (correctCount !== 1) {
      throw new Error(`Step ${i} must have exactly 1 correct option, got ${correctCount}`);
    }

    // Shuffle options so the correct answer isn't always first
    for (let j = step.options.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [step.options[j], step.options[k]] = [step.options[k], step.options[j]];
    }
  }
}
