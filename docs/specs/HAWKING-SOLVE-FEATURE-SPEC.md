# HAWKING — "Solve" Feature Build Specification

## ⚠️ READ THIS FIRST — Context for a Fresh Session

**This is an existing, working codebase. You are not starting from scratch.**

Before touching any code, do the following, in order:

1. **Find and read the existing spec files in this repo.** Look for
   `HAWKING-MVP-SPEC.md` and `HAWKING-SPEC.md` (repo root or a `/docs`
   folder). These describe the product that is **already built and
   already live**: a gamified, Duolingo-style MCQ practice flow where
   students tap through conceptual steps (RECALL THE PRINCIPLE → SET UP
   THE MATH → MAP THE DERIVATION → WHAT GOES IN → WHAT IT PRODUCES →
   ASSEMBLE THE FORM) for curated physics problems, with XP, streaks,
   and stars. Tech stack: Next.js, TypeScript, Tailwind, Framer Motion,
   Supabase (Auth + Postgres), Prisma, deployed on Vercel.
2. **Explore the actual repo structure** — pages, components, the
   database schema, the existing routes — before planning any new files.
   Match the existing code conventions (naming, folder structure,
   component patterns, styling approach) rather than introducing a new
   style.
3. **Do not rebuild or modify the existing Practice flow.** It stays
   exactly as it is. This document specifies an **addition**: a new
   parallel feature called **Solve**, plus one small change to the
   existing home page (described in §1) so Solve and Practice both have
   a clear entry point.
4. **Everything below this point is the spec for the new Solve feature
   only.** Treat it as an addition to the existing product, built in the
   same codebase, using the same stack, following the same code
   conventions you find in the repo — not a separate app.

If anything below conflicts with what you find in the existing repo
(e.g., a different tech stack than assumed, a different file structure),
**the actual repo is the source of truth** — adapt this spec's intent to
fit the existing codebase rather than forcing a mismatch.

---

**Purpose:** This document is a complete specification for an AI agent to build the new **Solve** feature into the existing Hawking physics learning app. It covers: the updated home page, the upload/input flow, the solution generation method, the two rendering formats (Short and Long), the color/design system, the PDF export pipeline, and full worked examples of both formats.

**What already exists:** A gamified, Duolingo-style MCQ practice flow (students tap through conceptual steps for curated problems). That flow is already built and stays as-is. The Solve feature is a **new parallel path** — students upload any physics problem and get a full step-by-step solution.

---

## 1. Updated Home Page

The home page **leads with Solve**, not Practice. Solve is the "any problem, any time" utility; Practice is the habit loop. The information architecture:

```
HOME (default landing)
├── Hero: "Stuck on a problem?"
├── Three input buttons: [Photo] [PDF] [Paste]
├── Chat input: "Or type your problem…" + send button
├── Divider: "or keep practicing"
├── Practice card: "Daily Practice · Mechanics · Lesson 4 of 9" → taps into existing practice flow
└── Bottom nav: [Home] [Practice]
```

### Navigation Rules
- **Home** tab (house icon) → always returns to the Solve landing page above
- **Practice** tab (graduation cap icon) → goes to the existing gamified MCQ flow
- When a student is inside a Solve result or a Practice session, the back arrow returns them to the relevant parent (Home or Practice list)
- The bottom nav is always visible (two tabs: Home, Practice)

---

## 2. Input Handling

All four input methods funnel into one thing: **a clean problem statement**.

| Input Method | Handling |
|---|---|
| **Photo** (camera or gallery) | Sent to the vision-capable LLM as an image attachment. No separate OCR. The model reads handwriting, printed text, and diagrams directly. |
| **PDF upload** | If text-based: extract text. If scanned: render to images, treat as photo. |
| **Copy-paste text** | Used as-is. LaTeX or plain-text math passed through unchanged. |
| **Chat/type** | Same as paste. Conversational — the student types "solve this for me: ..." |

**If the input is unclear** (blurry photo, ambiguous problem), the system asks a clarification question instead of guessing.

---

## 3. Solution Generation — The Hawking Solving Method

This is the core pedagogy. The LLM generates one full solution (the Long Format is the source of truth) as structured JSON. The Short Format is derived from the same JSON by filtering on priority tags.

### 3.1 Pedagogical Principles (MUST follow strictly)

1. **Teacher explaining directly to a student.** Not a research paper. Not a textbook excerpt. A teacher sitting across from you, walking you through it.
2. **Answer first, then why.** Every conceptual step leads with a boxed **ANSWER** line, then explains the reasoning in 1–3 short paragraphs.
3. **One continuous derivation.** Steps 4→6 merge into a single flowing calculation with inline annotations. Do not fragment the math into isolated sub-problems.
4. **Always verify.** Every solution ends with a Reality Check: limiting cases, dimensional analysis, numerical consistency, intuition checks.
5. **Always teach the trap.** "Where Students Go Wrong" names the *specific* misconception that costs marks on *this* problem — not generic advice.
6. **Always generalize.** "Takeaways" extract the transferable principle so the student recognizes the pattern next time.
7. **R cancels if R was never given.** Any unknown that was not provided must cancel. If it doesn't, the solution is wrong.

### 3.2 Solution Structure (7 sections, always in this order)

```
1. THE PROBLEM
   - Problem statement (restated cleanly)
   - Topic tags (e.g., "Gauss's Law · Solid Angle · Flux")
   - One-line framing in italics ("This is a disguised rolling problem...")

2. STEP 1 — RECALL THE PRINCIPLE
   - ANSWER box: which law/tool applies
   - 1–2 paragraphs: why this principle and not alternatives
   - Optional TIP box (gold): a transferable technique

3. STEP 2 — WHAT GOES IN
   - ANSWER box: what data/geometry/setup is needed
   - 1–2 paragraphs: setup details
   - WARNING box (red): the single most dangerous wrong turn

4. STEP 3 — MAP THE DERIVATION
   - ANSWER box: one-paragraph preview of the solution path
   - 1 paragraph: the chain of reasoning before executing

5. STEPS 4→6 — SET UP · DERIVE · ASSEMBLE
   - One continuous derivation
   - Subsection headers (blue) for natural breakpoints
   - Equations in blue-background blocks with italic grey annotations
   - Intermediate boxed results
   - Final BOXED ANSWER (large, green, centered)

6. REALITY CHECK
   - 2–4 sanity checks (each with a ✓)
   - Limiting cases (k→0, k→∞, etc.)
   - Dimensional analysis
   - Numerical consistency
   - Optional TIP box

7. WHERE STUDENTS GO WRONG
   - 2–4 numbered items
   - Each: red bold title + 1–2 sentence explanation
   - Must be specific to THIS problem

8. TAKE THESE INTO YOUR NEXT PROBLEM
   - 3–5 bullet points
   - Transferable principles, not problem-specific facts

9. FOOTER
   - "hawking-mauve.vercel.app · Think Through Physics"
   - Feedback note (see §7)
```

### 3.3 Priority Tagging for Short vs Long

When generating the solution JSON, every item in Reality Check, Common Errors, and Takeaways gets a `priority` field:
- `"high"` = shown in BOTH formats
- `"low"` = shown only in Long format

**Short Format trimming rules:**
- ANSWER boxes: kept in full
- Explanatory prose below ANSWER boxes: cut to one line or dropped entirely
- TIP boxes: dropped (unless it IS the make-or-break insight)
- WARNING boxes: kept only if it prevents the #1 most common wrong turn
- Steps 4→6 derivation: kept in full (the math is the content, never cut)
- Reality Check: only `priority: "high"` items (top 2)
- Where Students Go Wrong: only `priority: "high"` items (top 2)
- Takeaways: only `priority: "high"` items (top 3)
- Target: ~40% of Long Format length

---

## 4. Solution JSON Schema

```json
{
  "title": "The Rising Ball",
  "tags": ["Buoyancy", "Non-Inertial Frames", "Projectile Kinematics"],
  "problem_statement": "A small solid ball of density ρ is held at point A...",
  "problem_options": ["(A) a = 3g", "(B) a = 2g", "(C) t = √(L/3g)", "(D) t = √(2L/3g)"],
  "framing_line": "The ball is lighter than the liquid, so buoyancy pushes it upward. The surprise is that it also pushes the ball forward.",

  "step1": {
    "label": "RECALL THE PRINCIPLE",
    "answer": "Work in the container's non-inertial frame. Buoyancy acts opposite to the effective gravity g_eff, not just opposite to real gravity.",
    "explanation": "Why the non-inertial frame? Because the question asks the ball to hit a corner of the container...",
    "tip": { "text": "The substitution g → g_eff is the single most powerful tool in fluid mechanics...", "priority": "high" }
  },

  "step2": {
    "label": "WHAT GOES IN",
    "answer": "Three forces in the container frame: weight ρVg (down), pseudo-force ρVa (backward), and buoyancy 4ρV|g_eff| (opposite to g_eff).",
    "explanation": "Buoyancy = -ρ_liq V g_eff = 4ρV(g ĵ + a î). The liquid pushes the ball both up and forward.",
    "warning": { "text": "Buoyancy is not purely vertical here. In an accelerating container, the pressure gradient tilts...", "priority": "high" }
  },

  "step3": {
    "label": "MAP THE DERIVATION",
    "answer": "Net force → relative acceleration (3a, 3g). Vertical rise of L/2 gives t. Horizontal travel of L in that same t gives a.",
    "explanation": "Both components are constant, so each direction is independent constant-acceleration motion with a shared time."
  },

  "derivation": {
    "label": "SET UP · DERIVE · ASSEMBLE",
    "blocks": [
      { "type": "subsection", "title": "Net Force on the Ball" },
      { "type": "equation", "latex": "F_x = \\underbrace{4\\rho V a}_{\\text{buoyancy}} - \\underbrace{\\rho V a}_{\\text{pseudo}} = 3\\rho V a", "annotation": "net forward" },
      { "type": "equation", "latex": "F_y = \\underbrace{4\\rho V g}_{\\text{buoyancy}} - \\underbrace{\\rho V g}_{\\text{weight}} = 3\\rho V g", "annotation": "net upward" },
      { "type": "prose", "text": "Divide by the ball's mass ρV to get the acceleration relative to the container:" },
      { "type": "equation", "latex": "a_x = 3a \\quad (\\text{forward}), \\qquad a_y = 3g \\quad (\\text{upward})" },
      { "type": "subsection", "title": "Kinematics: Vertical First" },
      { "type": "equation", "latex": "\\frac{L}{2} = \\frac{1}{2}(3g)t^2 \\implies t = \\sqrt{\\frac{L}{3g}}" },
      { "type": "subsection", "title": "Kinematics: Horizontal Gives a" },
      { "type": "equation", "latex": "L = \\frac{1}{2}(3a)t^2 = \\frac{aL}{2g} \\implies a = 2g" },
      { "type": "boxed_result", "latex": "a = 2g, \\quad t = \\sqrt{L/(3g)}" }
    ]
  },

  "final_answer": {
    "latex": "\\text{Options (B) and (C)}",
    "display": "a = 2g and t = √(L/3g)",
    "option": "B, C"
  },

  "reality_checks": [
    { "heading": "Why does the ball move forward?", "text": "The ball is lighter than the liquid. The liquid's pressure gradient overwhelms the ball's inertia — like a helium balloon in an accelerating car.", "priority": "high" },
    { "heading": "Consistency of a = 2g with t", "text": "Horizontal = ½(3)(2g)(L/3g) = L ✓. Vertical = ½(3g)(L/3g) = L/2 ✓.", "priority": "high" },
    { "heading": "Does the density ratio matter individually?", "text": "Only through the factor 3. Different densities with the same ratio give the same method.", "priority": "low" },
    { "heading": "Numerical check", "text": "Both distances verify exactly — clean numbers confirm correctness.", "priority": "low" }
  ],

  "common_errors": [
    { "title": "Taking buoyancy as vertical only", "text": "In an accelerating container, g_eff tilts and buoyancy tilts with it.", "priority": "high" },
    { "title": "Using g instead of 3g", "text": "The relative acceleration is (4ρ−ρ)/ρ × g = 3g, not g.", "priority": "high" },
    { "title": "Choosing a = 3g (option A)", "text": "The factor 3 is the amplification, not the answer. Kinematics gives a = 2g.", "priority": "low" },
    { "title": "Forgetting ball starts from rest", "text": "At t=0, ball and container are both at rest. Initial velocity in container frame is zero.", "priority": "low" }
  ],

  "takeaways": [
    { "text": "In an accelerating fluid, replace g by g_eff = g − a everywhere.", "priority": "high" },
    { "text": "For density ρ_b in fluid ρ_f, relative acceleration is (ρ_f − ρ_b)/ρ_b × g_eff.", "priority": "high" },
    { "text": "2D kinematics: solve the direction with known displacement first to find t.", "priority": "high" },
    { "text": "Light objects move opposite to g_eff. Heavy objects move along g_eff.", "priority": "low" },
    { "text": "Geometry sets the ratio a/g, densities set the absolute scale.", "priority": "low" }
  ]
}
```

---

## 5. Design System — Colors and Components

### 5.1 Color Tokens (CSS custom properties)

These are the exact colors from the Hawking PDF template. Use them everywhere — web pages AND PDF exports.

```css
:root {
  /* Brand */
  --hawking-green: #2E7D32;       /* Section headers, answer text */
  --hawking-greenlight: #58CC02;  /* HAWKING wordmark, answer box border, CTA buttons */
  --hawking-blue: #1565C0;        /* Derivation subsection headers, equation block border */
  --hawking-purple: #6A1B9A;      /* Step 1 title color (RECALL THE PRINCIPLE) */
  --hawking-orange: #E65100;      /* Step 2 title color (WHAT GOES IN), streak flame */
  --hawking-teal: #00695C;        /* Step 3 title color (MAP THE DERIVATION), reality check headers */
  --hawking-gold: #B8860B;        /* Tip box border */
  --hawking-red: #C62828;         /* Warning box border, error items */
  --hawking-gray: #6B7280;        /* Secondary text, tags */
  --hawking-darktext: #1A1A2E;    /* Primary text, step badges */

  /* Box backgrounds */
  --bg-green: #F0FDF4;   /* Answer box background */
  --bg-blue: #F0F4FF;    /* Equation block background */
  --bg-gold: #FFFBEB;    /* Tip box background */
  --bg-red: #FFF5F5;     /* Warning box background */

  /* Surface */
  --bg-page: #FAFAF8;    /* Page background */
  --bg-card: #FFFFFF;    /* Card background */
  --border-light: #E5E7EB;
  --border-subtle: #EAEAE6;
}
```

### 5.2 Component Mapping

| Component | Visual | CSS |
|---|---|---|
| **Step badge** | Dark pill with white text: `STEP 1` | `background: var(--hawking-darktext); color: #fff; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700;` |
| **Step title** | Colored text next to badge | Each step has its own color (purple/orange/teal/blue). `font-size: 18px; font-weight: 700;` |
| **Answer box** | Green left border, light green bg | `border-left: 4px solid var(--hawking-greenlight); background: var(--bg-green); padding: 12px 16px; border-radius: 0 10px 10px 0;` |
| **Tip box** | Gold left border, light gold bg | `border-left: 4px solid var(--hawking-gold); background: var(--bg-gold);` Same padding/radius as answer box. |
| **Warning box** | Red left border, light red bg | `border-left: 4px solid var(--hawking-red); background: var(--bg-red);` Same padding/radius. |
| **Equation block** | Blue left border, light blue bg | `border-left: 3px solid var(--hawking-blue); background: var(--bg-blue); padding: 12px 16px;` |
| **Final answer** | Large centered green text | `text-align: center; font-size: 22px; font-weight: 700; color: var(--hawking-green);` with a serif font. |
| **Reality check item** | ✓ icon + text | Green checkmark SVG + paragraph. |
| **Error item** | Red numbered heading + text | `color: var(--hawking-red); font-weight: 700;` for the number/title. |
| **Takeaway list** | Bullet list | Standard `<ul>` with 8px gap between items. |
| **Footer note** | Bordered box, gray text | `border-top: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle); padding: 12px 0;` |

### 5.3 Typography

- **Body:** Work Sans (400/500/600/700) or system sans-serif fallback
- **Display / final answer:** Newsreader (serif) for the HAWKING wordmark and the final answer line
- **Math:** KaTeX for web rendering (supports fractions, roots, Greek, subscripts, \boxed, aligned environments)
- **Code/monospace:** Not used in solutions

### 5.4 Format Toggle

The Short/Long toggle sits at the top of the solution page:

```
┌──────────────────────────────────┐
│  [ Short ]  [ Long ]             │   ← segmented control
└──────────────────────────────────┘
```

- Pill-shaped segmented control with 3px padding, 999px border-radius
- Active segment: white background, green text (`--hawking-green`)
- Inactive segment: transparent, gray text
- Switching is **instant** (client-side re-render from the same JSON, no new API call)

---

## 6. PDF Export

### 6.1 Pipeline

```
Solution JSON → populate .tex template → pdflatex (two passes) → serve PDF
```

### 6.2 LaTeX Template Structure

Two template variants:

**Long Format (~5–6 pages):**
- Cover: HAWKING wordmark (green), problem title, topic tags
- Full Steps 1–3 with all boxes and explanations
- Full Steps 4→6 derivation with subsections
- Full Reality Check (all items)
- Full Where Students Go Wrong (all items)
- Full Takeaways (all items)
- Footer + feedback note

**Short Format (~2 pages):**
- Compact cover (HAWKING inline with subtitle, not full-page)
- Steps 1–3: ANSWER box + one line only
- Only the single most critical Warning (if any)
- Full derivation (never cut)
- Reality Check: top 2 items
- Where Students Go Wrong: top 2 items
- Takeaways: top 3 items
- Footer + feedback note

### 6.3 LaTeX Color Definitions (matching CSS exactly)

```latex
\definecolor{hawkinggreen}{RGB}{46,125,50}
\definecolor{greenlight}{RGB}{88,204,2}
\definecolor{hawkingblue}{RGB}{21,101,192}
\definecolor{hawkingpurple}{RGB}{106,27,154}
\definecolor{hawkingorange}{RGB}{230,81,0}
\definecolor{hawkingteal}{RGB}{0,105,92}
\definecolor{hawkinggold}{RGB}{184,134,11}
\definecolor{hawkingred}{RGB}{198,40,40}
\definecolor{hawkinggray}{RGB}{107,114,128}
\definecolor{darktext}{RGB}{26,26,46}
\definecolor{bluebg}{RGB}{240,244,255}
\definecolor{greenbg}{RGB}{240,253,244}
\definecolor{goldbg}{RGB}{255,251,235}
\definecolor{redbg}{RGB}{255,245,245}
```

### 6.4 Download Button

- Icon: downward arrow in a blue-tinted pill button
- Position: top-right of the solution page header
- On tap: dropdown with two options — "Download Short PDF" / "Download Long PDF"
- PDF is generated server-side on demand or pre-cached

---

## 7. Mandatory Footer Text

Every solution (both web and PDF, both formats) must include this footer:

> **Please note:** This solution is AI-based. But the solving method and technique is my input to the AI. I am building an app — an AI tutor called **Hawking AI** — which aims to solve hard physics problems in a step-by-step way. I am still working on this, so your feedback will be really helpful!

---

## 8. Reference Examples

### 8.1 SHORT FORMAT — Complete Example

**Problem:** Cylinder on two planks, thread pulled down, find max F before sliding.

```
HAWKING · Think Through Physics
THE CYLINDER ON TWO PLANKS
Rolling Without Slipping · Rigid Body Dynamics · Limiting Friction

The Problem
A uniform solid cylinder of mass m rests on two horizontal planks.
A thread is wound asymmetrically and pulled vertically downward with force F.
Maximum F before sliding: F_max = αKmg/(θ − λK). Find α + θ − λ.

STEP 1  RECALL THE PRINCIPLE
ANSWER: Rolling without slipping. Three equations: ΣF = ma, Στ = Iε,
and a = εR. Impose f ≤ kN at the end.
Static friction is unknown — solve dynamics first, then compare to ceiling kN.

STEP 2  WHAT GOES IN
ANSWER: Thread leaves tangentially → torque FR about axis.
N and f are totals over both planks.
⚠ WARNING: "Asymmetrically" is a red herring. R is never given, so it must cancel.

STEP 3  MAP THE DERIVATION
ANSWER: Vertical: N = mg + F. Horizontal: f = ma.
Torque: FR − fR = ½mRa. Eliminate a → f = ⅔F. Impose f ≤ kN.

STEPS 4→6  SET UP · DERIVE · ASSEMBLE
┌──────────────────────────────────────────┐
│  N = mg + F          vertical equilibrium │
│  f = ma              horizontal           │
│  FR − fR = ½mR²ε    torque about centre   │
│  a = εR              rolling constraint    │
└──────────────────────────────────────────┘

Substitute: F − f = ½f  ⟹  f = ⅔F
Impose f ≤ kN:  ⅔F ≤ k(mg + F)
⟹  F(2 − 3k) ≤ 3kmg

┌─────────────────────────┐
│  F_max = 3kmg/(2 − 3k)  │
└─────────────────────────┘

α = 3, θ = 2, λ = 3  ⟹  α + θ − λ = 2

Reality Check
✓ k → 0: F_max → 0. No friction → spins in place.
✓ k → 2/3: F_max → ∞. Above k = 2/3, sliding becomes impossible.

Where Students Go Wrong
1. Writing N = mg instead of N = mg + F.
2. Setting f = kN from the start instead of solving dynamics first.

Takeaways
• Rigid-body = three equations: ΣF = ma, Στ = Iε, a = εR.
• Static friction is an unknown. Solve for it; impose f ≤ kN last.
• If the applied force changes N, expect a denominator. Vanishing
  denominators mark real physical thresholds.
```

### 8.2 LONG FORMAT — Complete Example

**Problem:** Ball of density ρ in liquid of density 4ρ, accelerating container.

```
HAWKING · Think Through Physics
THE RISING BALL
Buoyancy · Non-Inertial Frames · Projectile Kinematics

The Problem
A small solid ball of density ρ is held at point A inside a closed cubical
container of side L, filled with ideal liquid of density 4ρ. Point A is on
the left wall, at height L/2 from bottom. Point Q is top-right corner.
Container starts moving with constant horizontal acceleration a, ball
released from A simultaneously.

(A) a = 3g  (B) a = 2g  (C) t = √(L/3g)  (D) t = √(2L/3g)

The ball is lighter than the liquid, so buoyancy pushes it upward. The
surprise is that it also pushes the ball forward — because the container
is accelerating.

─────────────────────────────────────────────

STEP 1  RECALL THE PRINCIPLE

ANSWER: Work in the container's non-inertial frame. In this frame,
gravity is replaced by an effective gravity g_eff, and buoyancy acts
opposite to g_eff, not just opposite to real gravity.

Why the non-inertial frame? Because the question asks the ball to hit a
corner of the container. We need the trajectory relative to the container,
and the simplest way is to sit inside and watch.

In that frame, a pseudo-force acts on everything: F_pseudo = −ma. But the
liquid is accelerating too, so the pressure gradient tilts. The net effect:

  g_eff = g − a = −gĵ − aî

All fluid results (buoyancy, pressure, surface tilt) remain valid with
g → g_eff.

💡 TIP: The substitution g → g_eff is the single most powerful tool in
fluid mechanics problems involving accelerating containers, rotating
vessels, and inclined surfaces.

─────────────────────────────────────────────

STEP 2  WHAT GOES IN

ANSWER: Three forces in the container frame: weight ρVg (down),
pseudo-force ρVa (backward), and buoyancy 4ρV·g_eff (opposite to g_eff,
so both upward AND forward).

Weight: W = −ρVg ĵ
Pseudo-force: F_pseudo = −ρVa î
Buoyancy: F_B = −ρ_liq V g_eff = 4ρV(gĵ + aî)

Key line: buoyancy has both a vertical component (4ρVg upward) and a
horizontal component (4ρVa forward).

⚠ WARNING: Buoyancy is not purely vertical in an accelerating container.
The pressure gradient tilts because the pseudo-force acts on the liquid too.
Treating buoyancy as vertical-only loses the entire horizontal motion.

─────────────────────────────────────────────

STEP 3  MAP THE DERIVATION

ANSWER: Net force → relative acceleration (3a, 3g). Vertical rise of L/2
gives t. Horizontal travel of L in that same t gives a.

Two clean stages:
Stage 1: Sum forces → net acceleration. Both components are
(ρ_f − ρ_b)/ρ_b = 3 times g_eff components.
Stage 2: Standard kinematics. Vertical fixes t; horizontal fixes a.

💡 TIP: In 2D constant-acceleration problems, always solve the direction
with known displacement first to find t.

─────────────────────────────────────────────

STEPS 4→6  SET UP · DERIVE · ASSEMBLE

--- Net Force on the Ball ---

  F_x = 4ρVa (buoyancy) − ρVa (pseudo) = 3ρVa     [net forward]
  F_y = 4ρVg (buoyancy) − ρVg (weight) = 3ρVg      [net upward]

Divide by mass ρV:
  a_x = 3a (forward),  a_y = 3g (upward)

The factor 3 = (4ρ − ρ)/ρ — the amplification factor.

--- Kinematics: Vertical First ---

Ball must rise L/2:
  L/2 = ½(3g)t²  ⟹  t² = L/(3g)  ⟹  t = √(L/3g)
This matches option (C).

--- Kinematics: Horizontal Gives a ---

Ball must travel L:
  L = ½(3a)·t² = ½(3a)·L/(3g) = aL/(2g)  ⟹  a = 2g
This matches option (B).

FINAL ANSWER: Options (B) and (C)
a = 2g  and  t = √(L/3g)

─────────────────────────────────────────────

Reality Check

✓ Why does the ball move forward, not backward?
  It's lighter than the liquid. The liquid's pressure gradient overwhelms
  the ball's inertia — like a helium balloon in an accelerating car.

✓ Is the ratio a/g = 2 reasonable?
  Ball travels L horizontally but only L/2 vertically. Same amplification
  factor → external field must be 2× stronger horizontally.

✓ Does the density ratio 4ρ/ρ matter individually?
  Only through the factor 3. Different densities with ratio 3 give same
  method and same a/g = 2.

✓ Numerical consistency:
  Horizontal: ½(3)(2g)(L/3g) = L ✓
  Vertical: ½(3g)(L/3g) = L/2 ✓

─────────────────────────────────────────────

Where Students Go Wrong

1. Taking buoyancy as vertical only.
   In an accelerating container, g_eff tilts and buoyancy tilts with it.
   Miss this and the ball never moves horizontally relative to the box.

2. Using g instead of 3g for the vertical acceleration.
   Relative acceleration = (4ρ−ρ)/ρ × g = 3g, not g.

3. Choosing a = 3g (option A) instead of a = 2g.
   The factor 3 appears in the acceleration (amplification), not in the
   answer. Option (A) is the trap.

4. Forgetting that the ball starts from rest relative to the container.
   At t = 0, ball and container are both at rest. Initial velocity in
   container frame is zero in both directions.

─────────────────────────────────────────────

Take These Into Your Next Problem

• In an accelerating fluid, replace g by g_eff = g − a everywhere —
  buoyancy, pressure gradients, surface tilt all follow this one vector.

• For a body of density ρ_b in fluid ρ_f, the relative acceleration is
  (ρ_f − ρ_b)/ρ_b × g_eff — a single formula covering both components.

• Light objects move opposite to g_eff. Heavy objects move along it.

• 2D constant-acceleration: solve the known-displacement direction first
  to get t, then substitute into the other.

• When a problem gives density ratios and asks for an acceleration ratio,
  geometry sets the ratio, densities set the scale. Keep these separate.

─────────────────────────────────────────────
hawking-mauve.vercel.app · Think Through Physics

Please note: This solution is AI-based. But the solving method and
technique is my input to the AI. I am building Hawking AI, an AI tutor
for hard physics problems. Still working on it — your feedback helps!
```

---

## 9. Implementation Checklist

- [ ] Update home page to lead with Solve (hero + input methods + Practice card below)
- [ ] Bottom nav: two tabs — Home (house) and Practice (graduation cap)
- [ ] Build problem input page (photo/PDF/paste/chat all funneling to one handler)
- [ ] Integrate vision-capable LLM call with the Hawking Solving Method system prompt (§3)
- [ ] Generate Solution JSON per the schema in §4
- [ ] Build Long Format web renderer (full JSON, all sections, all items)
- [ ] Build Short Format web renderer (apply priority filtering rules from §3.3)
- [ ] Build the format toggle (segmented control, instant client-side switch)
- [ ] Integrate KaTeX for math rendering in web view
- [ ] Build PDF export pipeline (JSON → LaTeX template → pdflatex → serve)
- [ ] Apply the complete color system from §5.1 to all web components
- [ ] Add the mandatory footer note (§7) to every solution output
- [ ] Wire the Download PDF button (dropdown: Short PDF / Long PDF)
- [ ] Error handling: clarification request for unclear inputs
- [ ] Mobile-responsive: solutions must read well on 390px width

---

## 10. Final Reminder

Before you write a single line of code: confirm you have read the
existing `HAWKING-MVP-SPEC.md` / `HAWKING-SPEC.md` in this repo and
looked at the actual existing pages/components/schema. This feature is
an **addition** to a live product, in the same codebase, following the
same conventions already established there — not a greenfield build.
When in doubt about a technical detail (routing pattern, auth handling,
database access pattern, component structure), follow what the existing
repo already does rather than inventing a new convention.
