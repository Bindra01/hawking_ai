# HAWKING — The Short Format Is a WORKED DERIVATION, Not a Trimmed Long

## Read This First

The Short format is currently being generated **wrong**. It is coming out
as the Long format with the explanation paragraphs deleted — same STEP
headers, same "ANSWER:" labels, same WARNING / Reality Check / Where
Students Go Wrong / Takeaways sections, just with fewer words in each.

**That is not what the Short format is.**

The Short format is a **clean worked derivation** — the way a solutions
manual or a strong student writes it: a vertical run of equations, each
with a few words of annotation, ending in a boxed answer. Nothing else.

> **The Short format is not the Long with less content.**
> **It is a different thing entirely: just the math, worked top to bottom.**

This file overrides any other guidance on what the Short format contains.

---

## 1. The Core Distinction

| | SHORT = WORKED DERIVATION | LONG = TEACHING DOCUMENT |
|---|---|---|
| What it is | The math, worked line by line | A lesson that explains every move |
| Structure | A vertical run of equations | Step headers, answer boxes, prose |
| Words | Almost none — short annotations only | Full paragraphs |
| Headers (STEP 1, STEP 2…) | **NONE** | Yes |
| "ANSWER:" labels | **NONE** | Yes |
| Warning / Tip boxes | **NONE** | Yes |
| Reality Check section | **NONE** | Yes |
| Where Students Go Wrong | **NONE** | Yes |
| Takeaways | **NONE** | Yes |
| What's left | Setup line → equations → boxed answer | Everything |

The Short format is what a student writes on paper when they already
understand the problem and just need to *do* it. No scaffolding. No
teaching. Just the derivation.

---

## 2. What the Short Format Contains — Exactly

In order, nothing more:

1. **Title** (one line) + the problem statement (1–3 lines).
2. **A one-line setup** naming the approach ("Minimize D² between shell and
   bunker at t = T") — optional, only if it isn't obvious.
3. **The derivation** — a vertical sequence of equations. Each line may have
   a SHORT annotation to its right (3–8 words) saying what the step is. This
   is the body of the whole document. It is almost entirely math.
4. **The boxed final answer.**
5. **Footer + feedback note.**

That is the entire Short format. There are **no step headers, no ANSWER
labels, no boxes other than the final answer, no reality check, no common
errors, no takeaways.**

Annotations go to the *right* of equations as brief notes, never as
paragraphs above or below. Example of the right texture:

```
y(t) = u sinθ · t − ½gt²            vertical position
x(t) = u cosθ · t                    horizontal position
D² = (x−d)² + (y − d tanφ)²          distance² to bunker at t=T
dD²/dθ = 0                           minimize
⟹  tanθ = (uT cosφ − …)/(…)          solve for θ
```

Math flows. Words stay out of the way.

---

## 3. THE EXACT PROBLEM FROM THE PDF — Done BOTH Ways

This is the projectile/airburst problem. First shown the WRONG way (how
the agent is currently doing the Short), then the RIGHT way.

### ❌ WRONG — how the Short is currently coming out

```
STEP 1  RECALL THE PRINCIPLE
ANSWER: The motion of a projectile is described by its x and y position
after time t, and the minimum distance to the bunker will depend on the
explosion's position at time T.

STEP 2  WHAT GOES IN
ANSWER: Known: d, φ, u, T, g. Find the optimal angle θ.
WARNING: Do NOT set the shell's coordinates equal to the bunker's!

STEP 3  MAP THE DERIVATION
ANSWER: Minimize the square of the distance D² at t = T in terms of θ.

STEPS 4-6  DERIVATION
Write the distance-squared function...
Expand D² and prepare to minimize...
[boxed answer]

REALITY CHECK
✓ If T → 0, shell barely leaves the cannon...
✓ If g → 0, angle simplifies to line-of-sight...

WHERE STUDENTS GO WRONG
1. Setting shell and bunker coordinates equal...
2. Forgetting the gravity term...

TAKE THESE INTO YOUR NEXT PROBLEM
• Optimal angle minimizes distance, not hits target...
• Gravity's vertical drop must be accounted for...
```

This is wrong because it is the Long format's skeleton with short
sentences. It still has STEP headers, ANSWER labels, WARNING, REALITY
CHECK, WHERE STUDENTS GO WRONG, TAKEAWAYS. **It is scaffolding with the
teaching removed, not a derivation.**

### ✅ RIGHT — what the Short format should actually be

```
PROJECTILE EXPLODING CLOSEST TO A BUNKER
A cannon fires at speed u; a bunker is at distance d, elevation φ. The shell
bursts at time T. Find the firing angle θ that bursts it closest to the bunker.

Minimize the distance between the shell at t = T and the bunker.

Shell position at t = T:
    x = uT cosθ
    y = uT sinθ − ½gT²

Bunker position:
    x_B = d
    y_B = d tanφ          (from distance d, elevation φ)

Distance² at t = T:
    D² = (uT cosθ − d)² + (uT sinθ − ½gT² − d tanφ)²

Minimize over θ:
    d(D²)/dθ = 0

    2(uT cosθ − d)(−uT sinθ)
      + 2(uT sinθ − ½gT² − d tanφ)(uT cosθ) = 0

Divide by 2uT and expand:
    −cosθ sinθ·uT + d sinθ
      + sinθ cosθ·uT − (½gT² + d tanφ)cosθ = 0

The uT cosθ sinθ terms cancel:
    d sinθ − (½gT² + d tanφ) cosθ = 0

    d sinθ = (½gT² + d tanφ) cosθ

    tanθ = (½gT² + d tanφ) / d

┌─────────────────────────────────────────┐
│   θ = arctan[ (½gT² + d tanφ) / d ]      │
└─────────────────────────────────────────┘

hawking-mauve.vercel.app · Think Through Physics
```

Notice what changed. The RIGHT version is **shorter**, but not because
sentences were trimmed — because the entire scaffolding is gone. What
remains is the actual mathematics, worked cleanly from setup to boxed
answer. A student can follow it line by line and reproduce it. That is the
Short format.

---

## 4. The Rule for Generating the Short Format

The Short format is **not** produced by filtering the Long JSON's prose.
It is a **separate rendering** that uses only:

- the problem statement,
- the derivation (the sequence of equations, with brief inline
  annotations),
- the final boxed answer.

Everything else in the JSON — step `answer` sentences, `explanation`
paragraphs, `tip`, `warning`, `reality_checks`, `common_errors`,
`takeaways` — **is dropped entirely from the Short render.** Not trimmed.
Dropped.

So the Short format needs the derivation stored as its own structured
field — a clean list of (equation, annotation) pairs — so it can be
rendered on its own without any of the teaching scaffolding:

```json
"derivation": {
  "lines": [
    { "latex": "x = uT\\cos\\theta", "note": "horizontal position at t=T" },
    { "latex": "y = uT\\sin\\theta - \\tfrac{1}{2}gT^2", "note": "vertical position at t=T" },
    { "latex": "D^2 = (x-d)^2 + (y - d\\tan\\phi)^2", "note": "distance² to bunker" },
    { "latex": "\\frac{d(D^2)}{d\\theta} = 0", "note": "minimize" },
    { "latex": "d\\sin\\theta = (\\tfrac{1}{2}gT^2 + d\\tan\\phi)\\cos\\theta", "note": "uT cosθ sinθ terms cancel" },
    { "latex": "\\theta = \\arctan\\!\\big[(\\tfrac{1}{2}gT^2 + d\\tan\\phi)/d\\big]", "note": "solve for θ", "boxed": true }
  ]
}
```

- **Short render** = problem statement + these derivation lines + the boxed
  line. Nothing else.
- **Long render** = all of that, wrapped in the step headers, answer boxes,
  explanations, reality check, common errors, and takeaways.

---

## 5. The Test

A correct Short format:

1. Has **no** STEP headers, **no** "ANSWER:" labels.
2. Has **no** Reality Check, Where Students Go Wrong, or Takeaways.
3. Has **no** warning or tip boxes.
4. Is **mostly equations**, flowing top to bottom.
5. Any words present are **short annotations to the right of a line**, not
   sentences or paragraphs.
6. Ends in a single boxed answer.

If the Short render contains the word "ANSWER:" or a "STEP 1" header or a
"Reality Check" heading, it is wrong — it is still the Long skeleton. The
Short format is a worked derivation and nothing more.

---

## 6. System Prompt Language (paste into the generation prompt)

> Produce the solution as JSON with a dedicated `derivation` field: an
> ordered list of lines, each a LaTeX equation with an optional short
> `note` (3–8 words) describing that step. The final line is flagged
> `boxed`.
>
> Two formats render from this JSON:
>
> **SHORT = a worked derivation only.** Render the problem statement, the
> `derivation` lines (equations with their short notes), and the boxed
> answer. Render NOTHING else — no step headers, no "ANSWER:" labels, no
> tip/warning boxes, no reality check, no common-errors, no takeaways. The
> Short format is what a student writes on paper when they already
> understand the problem: clean math, flowing top to bottom, a few words
> of annotation per line, ending in the boxed result. It is NOT the Long
> format with shortened sentences — it is the derivation alone.
>
> **LONG = the full teaching document.** Render everything: the step
> headers, the answer boxes, the explanation paragraphs, the tip and
> warning boxes, the reality check, the common errors, and the takeaways,
> all wrapped around the same derivation.
>
> The derivation is the shared core. SHORT shows only that core as clean
> worked math. LONG wraps that core in teaching. If your SHORT render
> contains a STEP header, an "ANSWER:" label, or a Reality Check heading,
> it is wrong — you have rendered the Long skeleton instead of a bare
> derivation.

---

## 7. For Problems That Are Pure Math

Most physics problems are a series of mathematical steps. For these — like
the projectile problem above — the Short format is simply that sequence of
steps, worked cleanly, ending in the boxed answer. This is the common case.

If a problem genuinely has a conceptual decision with no math (rare), the
Short format states it in one line and moves on. But the default
assumption is: **the Short format is a worked derivation.**
