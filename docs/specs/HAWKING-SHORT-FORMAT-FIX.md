# HAWKING — Short vs Long Format: Prompt Fix

## The Problem This Document Solves

The Solve feature currently generates **Short and Long solutions that look
almost identical.** They should be dramatically different — the Short is a
quick exam-style walkthrough (~2 pages), the Long is a full teaching
document (~5–6 pages). This document is the authoritative instruction for
making them genuinely different.

**This file overrides any conflicting guidance elsewhere. Read it fully.**

---

## 1. Root Cause — Why They Come Out The Same

The most common mistake is asking the model to **generate two separate
solutions** — "write a short version" and "write a long version." When you
do that, the model writes essentially the same content twice, maybe
trimming a sentence or two. That is why they look identical.

**The fix: generate ONE solution, then produce two formats from it.**

```
                    ┌──────────────────────────────┐
                    │   ONE model call generates   │
                    │   the FULL solution as JSON,  │
                    │   with every Reality Check,   │
                    │   Error, and Takeaway tagged  │
                    │   priority: "high" or "low"   │
                    └───────────────┬──────────────┘
                                   │
                   ┌───────────────┴─────────────────┐
                   ▼                                  ▼
            ┌────────────────┐              ┌────────────────────┐
            │  SHORT FORMAT  │              │    LONG FORMAT      │
            │                │              │                     │
            │  Render ONLY   │              │  Render EVERYTHING  │
            │  high-priority │              │  (all items, all    │
            │  items + trim  │              │  prose, all boxes)   │
            │  the prose     │              │                     │
            └────────────────┘              └─────────────────────┘
```

**The Short format is not a different solution. It is the same solution
with the low-priority material hidden and the prose trimmed.** This
guarantees they agree with each other and are genuinely different in depth.

---

## 2. The Two Formats Are Fundamentally Different

Do not think of these as "short-ish" and "long-ish" versions of the same
page. They serve different moments:

| | SHORT FORMAT | LONG FORMAT |
|---|---|---|
| **Who it's for** | A student who already gets the topic and wants to check their method and answer fast | A student who is learning the topic and wants to understand every move |
| **When used** | Night before an exam, quick revision, "just show me the method" | First time seeing this kind of problem, deep study |
| **Length** | ~650 words / ~2 pages | ~1700 words / ~5–6 pages |
| **Ratio** | **1** | **~2.6× the Short** |
| **Reading time** | Under a minute | Five minutes |
| **Feel** | Terse. Every line earns its place. | A teacher walking you through it patiently. |

**Concrete length target: the Long format must be at least 2.5× the word
count of the Short format for the same problem. If your Short is 650 words,
your Long should be ~1700. If they are within 1.5× of each other, the Short
is too long or the Long is too thin — regenerate.**

---

## 3. Exactly What Each Format Contains

This is the single most important section. Follow it literally.

### SHORT FORMAT — what to KEEP and what to CUT

| Section | Short Format |
|---|---|
| Cover | Compact — wordmark inline with subtitle, NOT a full-page cover |
| Problem statement | Kept, brief |
| Framing line | **CUT** |
| Step 1 ANSWER box | Kept |
| Step 1 explanation prose | **CUT to one sentence, or cut entirely** |
| Step 2 ANSWER box | Kept |
| Step 2 explanation prose | **CUT to one sentence, or cut entirely** |
| Step 2 WARNING box | Kept ONLY if it's the #1 make-or-break trap |
| Step 3 ANSWER box | Kept |
| Step 3 explanation prose | **CUT entirely** |
| All TIP boxes | **CUT entirely** (unless a tip IS the key insight) |
| Steps 4→6 derivation | **KEPT IN FULL** — the math is the content, never cut |
| Final answer | Kept |
| Reality Check | **Top 2 items only** (priority: high) |
| Where Students Go Wrong | **Top 2 items only** (priority: high) |
| Takeaways | **Top 3 items only** (priority: high) |
| Footer + feedback note | Kept |

### LONG FORMAT — what to INCLUDE (everything)

| Section | Long Format |
|---|---|
| Cover | Full — wordmark, title, tags, generous spacing |
| Problem statement | Full |
| Framing line | **INCLUDED** — the italic one-liner setting up the problem |
| Step 1 ANSWER box | Full |
| Step 1 explanation prose | **FULL — 1–2 paragraphs explaining WHY this principle** |
| Step 2 ANSWER box | Full |
| Step 2 explanation prose | **FULL — 1–2 paragraphs of setup detail** |
| Step 2 WARNING box | Included |
| Step 3 ANSWER box | Full |
| Step 3 explanation prose | **FULL — the paragraph previewing the derivation path** |
| TIP boxes | **ALL INCLUDED** — every tip box |
| Steps 4→6 derivation | Full, with subsection headers |
| Final answer | Full |
| Reality Check | **ALL items** (high + low priority) |
| Where Students Go Wrong | **ALL items** (high + low priority) |
| Takeaways | **ALL items** (high + low priority) |
| Footer + feedback note | Included |

**The derivation (Steps 4→6) is the ONE part that is identical in both
formats.** Everything else is either trimmed (Short) or full (Long).

---

## 4. The Generation Rule — CRITICAL

**Generate the solution ONCE, as structured JSON, with priority tags.
Then render twice by filtering. Never make two separate "write a short /
write a long" calls.**

### Step A — One generation call

The model produces the complete Long-format solution as JSON. Every item
in reality_checks, common_errors, and takeaways carries a `priority`
field: "high" or "low". Every step has its full `explanation` prose, plus
its `tip` / `warning` where relevant.

```json
{
  "step1": {
    "answer": "...",                           // shown in both
    "explanation": "Full 1-2 paragraph prose", // LONG ONLY
    "tip": { "text": "...", "priority": "low" }// LONG ONLY unless high
  },
  "reality_checks": [
    { "heading": "...", "text": "...", "priority": "high" }, // both
    { "heading": "...", "text": "...", "priority": "high" }, // both
    { "heading": "...", "text": "...", "priority": "low"  }, // long only
    { "heading": "...", "text": "...", "priority": "low"  }  // long only
  ]
}
```

### Step B — Render SHORT by filtering

```
SHORT = the same JSON, but:
  - drop every step.explanation      (keep step.answer)
  - drop every step.tip              (unless priority:"high")
  - drop every step.warning          (unless priority:"high" AND it's the #1 trap)
  - drop framing_line
  - reality_checks  → keep only priority:"high", max 2
  - common_errors   → keep only priority:"high", max 2
  - takeaways       → keep only priority:"high", max 3
  - KEEP derivation in full
```

### Step C — Render LONG by using everything

```
LONG = the same JSON, nothing dropped. All prose, all boxes, all items.
```

This guarantees the two formats are **consistent** (same physics, same
answer) and **genuinely different** (Short is a filtered subset).

### Why not two separate calls?
- Two calls = the model writes similar content twice → they look the same (the current bug).
- One call + filtering = the Short is provably a trimmed subset of the Long → they are different by construction, and can never contradict each other.

**When tagging priority, be decisive.** Roughly the top third of items in
each list are "high", the rest are "low". If everything is tagged "high",
the Short format will not shrink and the bug returns. Force the split: in a
list of 4 reality checks, exactly 2 are high; in 4 errors, exactly 2 are
high; in 5 takeaways, exactly 3 are high.

---

## 5. Side-by-Side — The SAME Problem in Both Formats

Same problem, same answer. The Short is a strict subset of the Long.

### Problem
> A uniform solid cylinder of mass m rests on two horizontal planks. A
> thread is wound asymmetrically and pulled vertically down with force F.
> Max F before sliding is F_max = αKmg/(θ − λK). Find α + θ − λ.

### ───────── SHORT FORMAT (what the student sees on "Short") ─────────

```
STEP 1  RECALL THE PRINCIPLE
ANSWER: Rolling without slipping. Three equations: ΣF = ma, Στ = Iε,
and a = εR. Impose f ≤ kN at the end.

STEP 2  WHAT GOES IN
ANSWER: Thread leaves tangentially → torque FR about axis. N and f are
totals over both planks.
⚠ "Asymmetrically" is a red herring. R is never given, so it must cancel.

STEP 3  MAP THE DERIVATION
ANSWER: Vertical: N = mg + F. Horizontal: f = ma. Torque: FR − fR = ½mRa.
Eliminate a → f = ⅔F. Impose f ≤ kN.

STEPS 4→6  SET UP · DERIVE · ASSEMBLE
  N = mg + F            vertical equilibrium
  f = ma                horizontal
  FR − fR = ½mR²ε       torque about centre
  a = εR                rolling constraint
Substitute: F − f = ½f  ⟹  f = ⅔F
Impose f ≤ kN:  ⅔F ≤ k(mg + F)  ⟹  F(2 − 3k) ≤ 3kmg
┌─────────────────────────┐
│  F_max = 3kmg/(2 − 3k)  │
└─────────────────────────┘
α = 3, θ = 2, λ = 3  ⟹  α + θ − λ = 2

Reality Check
✓ k → 0: F_max → 0. No friction → spins in place.
✓ k → 2/3: F_max → ∞. Sliding becomes impossible above k = 2/3.

Where Students Go Wrong
1. Writing N = mg instead of N = mg + F.
2. Setting f = kN from the start instead of solving dynamics first.

Takeaways
• Rigid-body = three equations: ΣF = ma, Στ = Iε, a = εR.
• Static friction is an unknown. Solve for it; impose f ≤ kN last.
• If the applied force changes N, expect a denominator in the answer.

[Footer + feedback note]
```

**That is the whole Short format. ~650 words. Every line earns its place.**

### ───────── LONG FORMAT (what the student sees on "Long") ─────────

```
[Framing line, italic]
A disguised rolling-without-slipping problem. The cylinder is a rigid body
acted on by three forces: gravity, the thread tension, and the contact
force from the planks. "No sliding" means the required friction must not
exceed kN — and the twist is that F itself increases N.

STEP 1  RECALL THE PRINCIPLE
ANSWER: Rolling without slipping. Three equations: ΣF = ma, Στ = Iε,
and a = εR. Impose f ≤ kN at the end.

For a rigid body in plane motion, three equations fully determine the
dynamics: ΣF = ma_cm for translation, Στ = Iε for rotation about the
centre, and the rolling constraint a = εR linking them. For a uniform
solid cylinder about its own axis, I = ½mR².

Static friction is not a fixed quantity. It takes whatever value the
rolling constraint demands, up to its ceiling f ≤ kN. The "maximum F" is
the value at which the demanded friction exactly equals kN.

💡 TIP: In every "maximum force before slipping" problem, solve the
dynamics first assuming rolling, obtain f and N as functions of F, and
only then apply f ≤ kN. Never start by setting f = kN — that is the last
step, not the first.

STEP 2  WHAT GOES IN
ANSWER: The thread leaves tangentially and hangs vertically, so its line
of action is a vertical line at perpendicular distance R from the axis. F
contributes torque FR about the centre but no horizontal force. N and f
are totals over both planks.

[full 1-2 paragraph explanation of the force geometry...]

⚠ WARNING: "Asymmetrically" is a red herring for the axis dynamics. It
only tells you the thread is wound off-centre along the length, so it
clears the gap between planks. It does not change m, I, or any equation.
R is never given, so it must cancel.

STEP 3  MAP THE DERIVATION
ANSWER: Vertical equilibrium gives N = mg + F. Horizontal law gives
f = ma. Torque about the centre gives FR − fR = ½mRa. Eliminate a to get
f = ⅔F. Then impose f ≤ kN and solve the inequality for F.

The whole solution is one elimination. The only subtlety is the last
step: F appears on both sides of f ≤ kN, because pulling the thread down
presses the cylinder harder onto the planks...

STEPS 4→6  SET UP · DERIVE · ASSEMBLE
[full derivation, identical to Short]

Final Answer: F_max = 3kmg/(2 − 3k), α + θ − λ = 2

Reality Check
✓ k → 0 (frictionless): F_max → 0. No friction → no horizontal force,
  cylinder spins in place under any pull. Correct.
✓ k → 2/3: Denominator → 0, F_max → ∞. Above k = 2/3, the friction
  ceiling rises faster than demanded friction — sliding impossible. A
  real physical threshold, not an algebraic accident.
✓ Is F_max positive and increasing in k? For 0 < k < 2/3 both numerator
  and denominator positive, dF/dk > 0 — rougher planks allow a harder
  pull. Correct.
✓ Does R appear? No — R was never given, so any answer containing it
  would be wrong. It cancelled between torque and rolling constraint.

Where Students Go Wrong
1. Writing N = mg instead of N = mg + F. The thread pulls the cylinder
   down, so F adds to the normal reaction. This feedback is what puts F
   into the denominator; with N = mg you get no denominator at all.
2. Setting f = kN from the start. Static friction is unknown — solve the
   dynamics first (f = ⅔F), then impose f ≤ kN last.
3. [third error — present in Long only]
4. [fourth error — present in Long only]

Take These Into Your Next Problem
• Rigid-body = three equations: ΣF = ma, Στ = Iε, a = εR.
• Static friction is an unknown, not a formula. Solve for it; impose last.
• If the applied force changes N, expect a denominator.
• [fourth takeaway — Long only]
• [fifth takeaway — Long only]

[Footer + feedback note]
```

**Compare the two.** The Short is the skeleton: answer boxes, derivation,
two checks, two errors. The Long wraps that skeleton in teaching: the
framing line, the "why" paragraphs under each answer, the tip box, two
extra reality checks, two extra errors, two extra takeaways. Same physics,
same F_max = 3kmg/(2−3k), same final answer — but one is a 2-page revision
aid and the other is a 6-page lesson.

---

## 6. System Prompt Language (paste this into the generation prompt)

Add this block to the system prompt that generates the Solution JSON:

> You generate ONE physics solution as structured JSON — the complete,
> full-depth (Long) version. You never write a "short version" and a
> "long version" separately.
>
> Every item in reality_checks, common_errors, and takeaways MUST carry a
> `priority` field set to "high" or "low". Be decisive: roughly the top
> third of each list is "high", the rest "low". Do NOT tag everything
> "high" — if you do, the short format cannot shrink, which is a failure.
> In a list of 4, exactly 2 are high. In a list of 5, exactly 3 are high.
>
> Every step MUST have two separate fields: an `answer` (one or two
> sentences — the boxed takeaway, shown in BOTH formats) and an
> `explanation` (1–2 full paragraphs of teaching — shown in the LONG
> format ONLY). Keep them clearly separate. The answer is the skeleton;
> the explanation is the teaching layer. If you fold the explanation into
> the answer, the short format will be as long as the long format — a
> failure.
>
> The two formats are produced by the renderer, not by you:
> - LONG = the full JSON, nothing dropped.
> - SHORT = answers + full derivation + high-priority items only; all
>   explanation prose, tips, framing line, and low-priority items dropped.
>
> This means SHORT must come out to roughly 40% of the length of LONG for
> the same problem. If your JSON is structured so that the short render
> would not be dramatically shorter than the long render, you have
> written it wrong — push the teaching depth into `explanation` and
> low-priority items so the short render collapses to a lean skeleton.

---

## 7. Acceptance Test (run this to confirm the fix worked)

Generate a solution, render both formats, and check:

1. **Length ratio:** Long word count ÷ Short word count ≥ 2.5. If it's
   close to 1.0, the bug is still present.
2. **Short has no explanation prose:** every step in Short shows only its
   answer line, no teaching paragraphs.
3. **Short has no framing line, no tip boxes.**
4. **Short reality checks ≤ 2, errors ≤ 2, takeaways ≤ 3.**
5. **Long reality checks ≥ 3 (or all), errors ≥ 3, takeaways ≥ 4.**
6. **Both show the identical derivation and identical final answer.**
7. **Priority split is real:** not every item is tagged "high". At least
   a third of each list is "low".

If any check fails, the generation prompt is not enforcing the structure —
revisit §4 and §6.
