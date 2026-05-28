/**
 * Transforms hawking_flows_final.json:
 * Phase 1 – Normalise: strip any existing $...$ markers and undo LaTeX commands.
 * Phase 2 – Fix encoding: â → √ (square root artifact) or — (em-dash artifact).
 * Phase 3 – Re-wrap: add $...$ conservatively.
 */
import * as fs from "fs";
import * as path from "path";

const FILE = path.join(__dirname, "hawking_flows_final.json");

// ─── Phase 1: strip ───────────────────────────────────────────────────────────

function stripLatex(s: string): string {
  // Remove $$...$$ then $...$
  s = s.replace(/\$\$([^$]+)\$\$/g, "$1");
  s = s.replace(/\$([^$\n]+)\$/g, "$1");
  // Remove any stray $ left over from malformed previous runs
  s = s.replace(/\$/g, "");

  // Remove corruption: "?[lowercase]..." suffix (? followed immediately by lowercase
  // is impossible in English and was caused by a previous regex bug that duplicated tails)
  s = s.replace(/\?([a-z][^?]*\?)\s*$/, "?");

  // Undo \sqrt{x} / \sqrt{}
  s = s.replace(/\\sqrt\{([^}]*)\}/g, "√$1");
  s = s.replace(/\\sqrt\b/g, "√");

  // Undo operators
  s = s.replace(/\\times\s*/g, "×");
  s = s.replace(/\\div\s*/g, "÷");
  s = s.replace(/\\pm\s*/g, "±");
  s = s.replace(/\\propto\s*/g, "∝");
  s = s.replace(/\\partial\s*/g, "∂");
  s = s.replace(/\\cdot\s*/g, "·");

  // Undo Greek (longest first to avoid partial replacement)
  const GREEK: [string, string][] = [
    ["\\alpha","α"],["\\beta","β"],["\\gamma","γ"],["\\delta","δ"],
    ["\\epsilon","ε"],["\\zeta","ζ"],["\\eta","η"],["\\theta","θ"],
    ["\\lambda","λ"],["\\mu","μ"],["\\nu","ν"],["\\xi","ξ"],
    ["\\pi","π"],["\\rho","ρ"],["\\sigma","σ"],["\\tau","τ"],
    ["\\phi","φ"],["\\chi","χ"],["\\psi","ψ"],["\\omega","ω"],
    ["\\Omega","Ω"],["\\Delta","Δ"],["\\Sigma","Σ"],["\\Pi","Π"],
    ["\\Lambda","Λ"],["\\Theta","Θ"],
  ];
  for (const [cmd, ch] of GREEK) s = s.replaceAll(cmd, ch);

  // Undo super/subscript braces: ^{2} → ²,  _{1} → ₁
  const SUP: [string,string][] = [["^{0}","⁰"],["^{1}","¹"],["^{2}","²"],
    ["^{3}","³"],["^{4}","⁴"],["^{5}","⁵"],["^{6}","⁶"],["^{7}","⁷"],
    ["^{8}","⁸"],["^{9}","⁹"]];
  const SUB: [string,string][] = [["_{0}","₀"],["_{1}","₁"],["_{2}","₂"],
    ["_{3}","₃"],["_{4}","₄"],["_{5}","₅"],["_{6}","₆"],["_{7}","₇"],
    ["_{8}","₈"],["_{9}","₉"]];
  for (const [cmd, ch] of [...SUP,...SUB]) s = s.replaceAll(cmd, ch);

  // ^{expr} (general) → ^(expr)
  s = s.replace(/\^\{([^}]+)\}/g, "^($1)");

  return s;
}

// ─── Phase 2: fix encoding ────────────────────────────────────────────────────

function fixEncoding(s: string): string {
  // â immediately before letter/digit/(  →  √ (truncated UTF-8 square-root byte)
  s = s.replace(/â(?=[a-zA-Zα-ωΑ-Ω0-9(])/g, "√");
  // â surrounded by spaces  →  — (em-dash used as "therefore / meaning")
  s = s.replace(/ â /g, " — ");
  // remaining â  →  —
  s = s.replace(/â/g, "—");
  return s;
}

// ─── Phase 3: re-wrap ─────────────────────────────────────────────────────────

const PROSE_WORDS =
  /\b(the|an?|is|are|if|for|and|or|but|with|from|to|of|in|on|at|by|as|since|because|when|where|what|how|use|using|used|find|get|need|show|directly|constant|assume|assuming|object|particle|mass|force|speed|radius|energy|charge|field|current|distance|time|rate|rule|move|motion|orbit|angle|that|this|its|most|always|never|here|so|not|just|more|than|your|will|can|does|did|was|were|had|has|have|would|could|should|above|below|given|check|clean|beautiful|exactly|right|correct|wrong)\b/i;

const MATH_CHARS = /[√∂∫∑∏±×÷α-ωΑ-Ω²³⁴⁰¹⁻⁺₀₁₂₃₄₅₆₇₈₉∝]/;

function isPureMath(s: string): boolean {
  if (s.length > 55) return false;
  // Must have real math characters — bare = or ^ alone is not enough
  if (!MATH_CHARS.test(s) && !/^[a-zA-Z]\s*=/.test(s)) return false;
  if (PROSE_WORDS.test(s)) return false;
  // No sentence starters (capitalised word followed by space + more words)
  if (/^[A-Z][a-z]{2,}\s+[a-z]/.test(s)) return false;
  // No parenthesised prose clauses like "(convert 500 g = 0.5 kg first)"
  if (/\([a-z]{3,}\s+[a-z]/.test(s)) return false;
  return true;
}

function toLatex(s: string): string {
  // √(expr) → \sqrt{expr},  √x → \sqrt{x}
  s = s.replace(/√\(([^)]+)\)/g, "\\sqrt{$1}");
  s = s.replace(/√([a-zA-Z0-9])/g, "\\sqrt{$1}");
  s = s.replace(/√/g, "\\sqrt{}");

  const GREEK: [string,string][] = [
    ["α","\\alpha"],["β","\\beta"],["γ","\\gamma"],["δ","\\delta"],
    ["ε","\\epsilon"],["ζ","\\zeta"],["η","\\eta"],["θ","\\theta"],
    ["λ","\\lambda"],["μ","\\mu"],["ν","\\nu"],["ξ","\\xi"],
    ["π","\\pi"],["ρ","\\rho"],["σ","\\sigma"],["τ","\\tau"],
    ["φ","\\phi"],["χ","\\chi"],["ψ","\\psi"],["ω","\\omega"],
    ["Ω","\\Omega"],["Δ","\\Delta"],["Σ","\\Sigma"],["Π","\\Pi"],
    ["Λ","\\Lambda"],["Θ","\\Theta"],
  ];
  for (const [ch, cmd] of GREEK) s = s.replaceAll(ch, cmd);

  s = s.replace(/∂/g, "\\partial ");
  s = s.replace(/×/g, "\\times ");
  s = s.replace(/÷/g, "\\div ");
  s = s.replace(/±/g, "\\pm ");
  s = s.replace(/∝/g, "\\propto ");

  const SUP: [string,string][] = [["²","^{2}"],["³","^{3}"],["⁴","^{4}"],
    ["⁰","^{0}"],["¹","^{1}"],["⁵","^{5}"],["⁶","^{6}"],["⁷","^{7}"],
    ["⁸","^{8}"],["⁹","^{9}"]];
  const SUB: [string,string][] = [["₀","_{0}"],["₁","_{1}"],["₂","_{2}"],
    ["₃","_{3}"],["₄","_{4}"],["₅","_{5}"],["₆","_{6}"],["₇","_{7}"],
    ["₈","_{8}"],["₉","_{9}"]];
  for (const [ch, cmd] of [...SUP,...SUB]) s = s.replaceAll(ch, cmd);

  // ^(n) → ^{n}
  s = s.replace(/\^\(([^)]+)\)/g, "^{$1}");

  return s;
}

/** Wrap math fragments inside prose without touching the surrounding sentence */
function wrapSqrtInProse(s: string): string {
  if (s.includes("$")) return s; // should be clean after strip; bail if not

  // Step 1 – leading equation at start of sentence, handled atomically FIRST
  // e.g. "v = 4x^(1/2). What is dv/dx?" → "$v = 4x^{1/2}$. What is dv/dx?"
  // Use lookahead (?=[A-Z]) so the capital is NOT consumed — replace() keeps it naturally
  s = s.replace(
    /^([A-Za-z])\s*=\s*([^.?!\n]+?)([.?])\s+(?=[A-Z])/,
    (fullMatch, lhs, rhs, punc) => {
      const eq = `${lhs} = ${rhs.trim()}`;
      if (PROSE_WORDS.test(eq)) return fullMatch;
      return `$${toLatex(eq)}$${punc} `;
    }
  );

  // Step 2 – standalone √ fragments (toLatex already converted them away inside $...$)
  s = s.replace(/√\(([^)]+)\)/g, (_, inner) => `$\\sqrt{${inner}}$`);
  s = s.replace(/√([a-zA-Z0-9])/g, (_, after) => `$\\sqrt{${after}}$`);

  // Step 3 – isolated [letter]^(n/m) not part of a larger equation already handled
  s = s.replace(/(?<![=\w])([a-zA-Z])\^\(([^)]+)\)/g, (_, v, exp) => `$${v}^{${exp}}$`);

  return s;
}

function processString(s: string, key: string): string {
  // Phase 1 – strip any previous LaTeX
  s = stripLatex(s);
  // Phase 2 – fix encoding
  s = fixEncoding(s);

  // Phase 3 – re-wrap

  // final_answer / goal: wrap the math part in $...$
  if (key === "final_answer" || key === "goal") {
    const match = s.match(/^(Find:\s*)(.*)/i);
    const prefix = match ? match[1] : "";
    const expr = match ? match[2].trim() : s.trim();
    return prefix + (isPureMath(expr) ? `$${toLatex(expr)}$` : expr);
  }

  // option.text: if the whole string is a compact formula, wrap it;
  // otherwise wrap only √ fragments within the sentence
  if (key === "text") {
    return isPureMath(s) ? `$${toLatex(s)}$` : wrapSqrtInProse(s);
  }

  // prose fields: wrap only √ fragments
  if (key === "scenario" || key === "prompt" || key === "feedback" || key === "tip") {
    return wrapSqrtInProse(s);
  }

  // title, label, subject, topic, difficulty – plain text only
  return s;
}

// ─── walk ─────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function walk(node: any, key = ""): any {
  if (typeof node === "string") return processString(node, key);
  if (Array.isArray(node)) return node.map((v) => walk(v, key));
  if (node && typeof node === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v, k);
    return out;
  }
  return node;
}

const raw = fs.readFileSync(FILE, "utf-8");
const data = JSON.parse(raw);
const fixed = walk(data);
fs.writeFileSync(FILE, JSON.stringify(fixed, null, 2), "utf-8");
console.log("Done.");
