# HAWKING — The Step Labels Are FIXED. Do Not Invent Them.

---

## 0. Why This Matters — The Philosophy Behind the Labels

Before you read the technical fix, understand **why** these labels exist
and why getting them wrong breaks the entire product.

Hawking is not a solution manual. It is not a calculator. It is a
**thinking trainer**. The goal is not to show the student the answer to
this problem. The goal is to teach the student **how a physicist thinks
through any problem** — so that the next time they see a problem they have
never seen before, they know what to do.

The four fixed steps are the **cognitive framework** for doing physics:

```
STEP 1 — RECALL THE PRINCIPLE
  Before touching any numbers, ask: what law or principle governs this?
  Newton? Gauss? Conservation of energy? Identify the tool first.

STEP 2 — WHAT GOES IN
  What does the problem give you? What are you solving for?
  Map the knowns and unknowns before setting up any equation.

STEP 3 — MAP THE DERIVATION
  Before calculating, sketch the path. Where does the solution go?
  What connects the principle to the answer?

STEPS 4→6 — SET UP · DERIVE · ASSEMBLE
  Now execute. The thinking is done; this is the calculation.
```

A student who sees this structure on fifty different problems — mechanics,
electrostatics, thermodynamics, optics — starts to internalize it. They
stop asking "what formula do I use?" and start asking "what principle
governs this?" That is the shift Hawking is trying to create.

**The labels must be identical every time, because repetition is the
mechanism.** The student needs to see "RECALL THE PRINCIPLE" on the
projectile problem, on the buoyancy problem, on the flux problem — and
slowly realize: *oh, this is always the first move, no matter what the
problem is.* If the label changes to "Recall the principle of projectile
motion" on one problem and "Identify the conservation law" on another,
the repetition is broken. The pattern never registers. The student never
builds the habit.

The fixed labels are not a style choice. They are the teaching mechanism.
Changing them — even to something that sounds more descriptive or more
specific — destroys the thing that makes Hawking different from a
textbook solution.

> **Every time a student opens a Hawking solution, they should see the
> same four signposts. Over time those four words become a mental
> checklist they carry into every problem they ever face.**

This is why the labeling is non-negotiable. Now read the technical fix.

---

## Read This First — The Bug

The step labels are coming out **wrong**. The agent is generating its own
titles that describe what each step does on the specific problem, like:

- ❌ "Recall the principle of projectile motion and explosion timing"
- ❌ "Substitute given parameters and express distance to bunker"
- ❌ "Find angle θ that minimizes the squared distance D²"

**These are all wrong.** The step labels are **not** descriptions of what
the step does on this problem. They are **fixed, universal category names**
that are the SAME on every single problem, forever.

> **The step labels are a fixed set of six names. They never change from
> one problem to the next. Do not write a custom title for a step. Do not
> describe what the step does. Use the exact fixed label.**

---

## 1. The Six Fixed Labels — Use These Exact Words, Always

Every Hawking solution has exactly these step labels, in this exact order,
with these exact words, on EVERY problem:

| Step | EXACT LABEL (never changes) | Title color |
|---|---|---|
| STEP 1 | **RECALL THE PRINCIPLE** | purple |
| STEP 2 | **WHAT GOES IN** | orange |
| STEP 3 | **MAP THE DERIVATION** | teal |
| STEPS 4→6 | **SET UP · DERIVE · ASSEMBLE** | blue |

That is the complete, closed list. There are no other step labels. The
label text is **identical on every problem** — a projectile problem, a
thermodynamics problem, an optics problem, all use these same four labels
word for word.

### What this looks like, correctly:

```
STEP 1   RECALL THE PRINCIPLE
STEP 2   WHAT GOES IN
STEP 3   MAP THE DERIVATION
STEPS 4→6   SET UP · DERIVE · ASSEMBLE
```

### What the agent is doing WRONG:

```
STEP 1   Recall the principle of projectile motion and explosion timing
                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                  WRONG — this is a description, not the label

STEP 2   Substitute given parameters and express distance to bunker
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         WRONG — the label is "WHAT GOES IN", not this

STEP 3   Find angle θ that minimizes the squared distance D²
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         WRONG — the label is "MAP THE DERIVATION", not this
```

---

## 2. The Label Is The Category. The Content Is Problem-Specific.

The confusion is between the **label** (fixed) and the **content** (varies).

- The **label** is the category name. It is ALWAYS one of the four fixed
  names above. It never mentions the specific problem.
- The **content** inside each step (the ANSWER box and the explanation)
  IS specific to the problem.

So for the projectile problem:

```
STEP 1   RECALL THE PRINCIPLE          ← fixed label, same on every problem
         ANSWER: The position of a projectile fired at angle θ...
                 ^^^ this content is problem-specific, and that's correct

STEP 2   WHAT GOES IN                   ← fixed label, same on every problem
         ANSWER: Set the explosion coordinates as x_e = u cosθ·T...
                 ^^^ this content is problem-specific, and that's correct

STEP 3   MAP THE DERIVATION             ← fixed label, same on every problem
         ANSWER: Minimize D² between the shell and bunker at t = T...
                 ^^^ this content is problem-specific, and that's correct
```

The label tells the student **what kind of thinking move** this is
(recalling the principle, identifying the inputs, mapping the path). The
problem-specific detail goes in the ANSWER box and the explanation
BELOW the label — never in the label itself.

---

## 3. What Each Fixed Label Means

So the agent understands WHY each label is what it is (but still uses the
exact fixed words):

- **STEP 1 — RECALL THE PRINCIPLE**
  Which law or principle governs this problem, and why. Always this label,
  whether the principle is projectile motion, Gauss's law, or the first law
  of thermodynamics.

- **STEP 2 — WHAT GOES IN**
  What data, variables, and setup the problem gives you, and what you're
  solving for. Always this label. (NOT "Substitute parameters," NOT
  "Identify inputs" — the label is literally "WHAT GOES IN".)

- **STEP 3 — MAP THE DERIVATION**
  A one-paragraph preview of the solution path before executing it. Always
  this label. (NOT "Find angle θ," NOT "Set up the minimization" — the
  label is literally "MAP THE DERIVATION".)

- **STEPS 4→6 — SET UP · DERIVE · ASSEMBLE**
  The actual continuous calculation. Always this label.

---

## 4. The Data Model Must Separate Label From Content

The reason the agent is getting this wrong is probably that the step's
title is being generated as free text. Fix the data model so the label is
a FIXED CONSTANT, not a generated field.

### WRONG data model (generates the label as text):
```json
{
  "step1": {
    "title": "Recall the principle of projectile motion and explosion timing",
    "answer": "..."
  }
}
```
This lets the model write anything into `title`. That is the bug.

### CORRECT data model (label is a hardcoded constant, not generated):
```json
{
  "step1": {
    "answer": "The position of a projectile fired at angle θ...",
    "explanation": "Projectile motion in two dimensions..."
  }
}
```
The renderer supplies the label from a FIXED constant — the model never
generates it:

```javascript
const STEP_LABELS = {
  step1: "RECALL THE PRINCIPLE",
  step2: "WHAT GOES IN",
  step3: "MAP THE DERIVATION",
  derivation: "SET UP · DERIVE · ASSEMBLE"
};
```

The model generates ONLY the `answer` and `explanation` content. The label
is hardcoded in the renderer and is identical on every problem. This makes
it structurally impossible for the label to be wrong.

---

## 5. If The Model Must Generate The Label (less safe, but if needed)

If for some reason the label has to come from the model's JSON, then the
system prompt MUST constrain it to the exact enum. Add this to the prompt:

> The step labels are a FIXED, CLOSED SET. You MUST use these exact
> strings, letter for letter, on every problem:
> - step1 label is always exactly: "RECALL THE PRINCIPLE"
> - step2 label is always exactly: "WHAT GOES IN"
> - step3 label is always exactly: "MAP THE DERIVATION"
> - the derivation label is always exactly: "SET UP · DERIVE · ASSEMBLE"
>
> NEVER write a custom or descriptive step label. NEVER describe what the
> step does in the label. NEVER mention the specific problem in the label.
> The label is a fixed category name, identical on every problem. If you
> write "Recall the principle of projectile motion" instead of "RECALL THE
> PRINCIPLE", that is a failure. The problem-specific content goes ONLY in
> the `answer` and `explanation` fields, never in the label.

But the safest fix is §4 — hardcode the labels in the renderer so the
model cannot touch them at all.

---

## 6. The Test

Open any generated solution and check the step labels. They must read,
EXACTLY, on every problem:

1. STEP 1 → **RECALL THE PRINCIPLE** (not "...of projectile motion...")
2. STEP 2 → **WHAT GOES IN** (not "Substitute parameters..." or
   "Identify inputs...")
3. STEP 3 → **MAP THE DERIVATION** (not "Find angle θ..." or "Set up the
   minimization...")
4. STEPS 4→6 → **SET UP · DERIVE · ASSEMBLE**

If any step label contains a word specific to the problem (projectile,
angle, bunker, distance, parameters, θ, D²), it is wrong. The label must
be one of the four fixed strings and nothing else.
