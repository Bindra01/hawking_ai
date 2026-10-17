# HAWKING — Tighten the Solution Generation System Prompt

## Context

The solution generation loop is working but making inconsistent physics
mistakes when called via raw API. This does not happen as often in
consumer AI apps (ChatGPT, Claude.ai) because those apps have a large,
well-tuned system prompt already baked in that tells the model to verify
its reasoning, check answers, and not hallucinate. Our raw API call
currently has none of that scaffolding — only the Hawking formatting
instructions. This file tells the agent exactly what to add and how.

---

## 1. Immediate Fix — API Parameters

Before touching the system prompt, fix the API call parameters. This
single change will cut the error rate significantly.

```python
response = client.chat.completions.create(
    model="gpt-4o",    # always use the strongest available model
    temperature=0,      # CRITICAL — physics is not creative writing.
                        # temperature=0 gives deterministic, highest-
                        # probability output. Default temp=1.0 introduces
                        # randomness that causes arithmetic slips and
                        # wrong formula choices.
    max_tokens=4000,
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": problem_text}
    ]
)
```

**temperature=0 is the single highest-leverage change. Do this first.**

---

## 2. Add This Block to the Existing System Prompt

Find the system prompt that currently handles solution generation. Add
the following block to it. Do not replace the existing Hawking formatting
instructions — add this before them.

```
====================================================
ACCURACY REQUIREMENTS — follow all of these strictly
====================================================

RULE 1 — DERIVE BEFORE WRITING.
Before generating any JSON or structured output, work through the
problem completely in your internal reasoning. Identify the principle,
set up the equations, carry out the algebra, and reach the final
numerical answer. Only then write the structured solution. Never
generate the JSON structure and fill in the physics simultaneously —
this causes errors that cascade through the entire solution because
you are solving and formatting at the same time.

RULE 2 — VERIFY THE ANSWER BEFORE WRITING IT.
After reaching a numerical result, run at least two of these checks
before writing the output:
  - DIMENSIONS: do the units of the answer match what was asked for?
  - LIMITING CASES: what happens when a parameter → 0 or → ∞?
    Does the answer behave as physics demands?
  - SIGN: is the sign of the result physically reasonable?
  - MAGNITUDE: is the number in the right ballpark for this type
    of problem?
If any check fails, find the error and fix it before writing anything.
A wrong answer presented confidently is worse than no answer.

RULE 3 — NEVER GUESS A FORMULA.
If you are not certain of a formula or derivation step, do not proceed
and fill in a plausible-looking result. Instead, flag the uncertainty
explicitly. An honest flag is far less damaging than a confident error
that a student trusts and learns from.

RULE 4 — VERIFY ALGEBRA LINE BY LINE.
After each line of algebra, confirm that it follows from the previous
line. Do not skip steps. A skipped step that "looks right" is the most
common source of physics solution errors.

RULE 5 — CONVERT TO SI UNITS AT THE START.
Convert all given quantities to SI units before writing the first
equation. Do not mix cm with m, eV with J, or g with kg mid-calculation.
State the converted values explicitly so errors are visible.

RULE 6 — USE THESE EXACT PHYSICAL CONSTANTS.
Do not use approximate or remembered values. Use these:
  h  = 6.626 × 10⁻³⁴ J·s      (Planck's constant)
  c  = 3.0   × 10⁸  m/s        (speed of light)
  e  = 1.602 × 10⁻¹⁹ C         (electron charge)
  g  = 10 m/s² unless specified  (use 9.8 if problem states it)
  ε₀ = 8.85  × 10⁻¹² F/m       (permittivity of free space)
  k  = 9.0   × 10⁹  N·m²/C²    (Coulomb's constant = 1/4πε₀)
  mₑ = 9.11  × 10⁻³¹ kg        (electron mass)
  mₚ = 1.67  × 10⁻²⁷ kg        (proton mass)
  Nₐ = 6.022 × 10²³ mol⁻¹      (Avogadro's number)
  R  = 8.314 J/(mol·K)          (universal gas constant)
  kB = 1.38  × 10⁻²³ J/K       (Boltzmann's constant)
  σ  = 5.67  × 10⁻⁸ W/(m²·K⁴) (Stefan–Boltzmann constant)
====================================================
```

---

## 3. Recommended — Split Into Two API Calls

The current architecture asks one API call to simultaneously:
- solve the physics correctly
- format the output as structured JSON
- label and prioritize content
- generate appropriate teaching commentary

This is too much to do reliably in one pass. The formatting burden
distracts from the physics, and physics errors slip through.

**Split it into two calls:**

### Call 1 — Pure Physics (no formatting)

```python
PHYSICS_PROMPT = """
You are an expert physics problem solver. Your only job in this call
is to solve the problem completely and correctly.

Work through the problem step by step:
1. Identify the governing principle or law.
2. State all given quantities (converted to SI units).
3. Set up the equations.
4. Carry out the algebra and arithmetic, showing every step.
5. State the final answer with units.
6. Verify with at least two checks (dimensions, limiting cases,
   sign, or magnitude).

Do not format the output. Do not produce JSON. Write your working
in plain text as a physicist would on a whiteboard. Your only goal
is a correct, verified answer.
"""

physics_response = client.chat.completions.create(
    model="gpt-4o",
    temperature=0,
    messages=[
        {"role": "system", "content": PHYSICS_PROMPT},
        {"role": "user",   "content": problem_text}
    ]
)

verified_solution = physics_response.choices[0].message.content
```

### Call 2 — Pure Formatting (no physics solving)

```python
FORMAT_PROMPT = """
You are a formatter for the Hawking physics learning app. You will
receive a fully worked and verified physics solution. Your job is
to format it as a Hawking solution JSON.

CRITICAL: Do not re-solve the problem. Do not change any of the
physics, algebra, or numerical answers. Take the verified working
you are given and restructure it into the Hawking format exactly.
If you change a number or a formula, that is a failure.

[Insert your existing Hawking JSON schema and formatting rules here]
[Insert the fixed step label rules from HAWKING-STEP-LABELS-FIX.md]
[Insert the short vs long format rules from HAWKING-SHORT-FORMAT-FIX.md]
"""

format_response = client.chat.completions.create(
    model="gpt-4o",
    temperature=0,
    messages=[
        {"role": "system", "content": FORMAT_PROMPT},
        {"role": "user",   "content": f"Here is the verified solution to format:\n\n{verified_solution}"}
    ]
)
```

### Why this works

- Call 1 has zero formatting burden — the model focuses entirely on
  getting the physics right.
- Call 2 has zero physics burden — the model takes a verified answer
  and restructures it, with no risk of introducing new errors.
- If Call 1 produces a wrong answer, it is caught at the physics stage
  before any formatting happens.
- This mirrors how consumer AI apps handle hard reasoning tasks
  internally — separate the reasoning from the presentation.

### Cost

Two calls instead of one costs roughly 2× the tokens. For a physics
solution this is typically an extra ~$0.01–0.03 per problem. Given
that a wrong solution reaching a student costs far more in trust and
credibility, this is worth it.

---

## 4. Summary — What to Do, In Order

1. **Set `temperature=0`** in the API call. Do this immediately.
   Highest leverage, zero cost.

2. **Add the ACCURACY REQUIREMENTS block** (§2 above) to the top of
   the existing system prompt. Do not remove any existing instructions.

3. **Add the physical constants block** to the system prompt so the
   model never uses a wrong constant.

4. **When ready, split into two calls** (§3 above). This is the
   architectural fix that makes the system robust under stress testing.
   It is the right long-term approach.

5. **Commit this file to the repo** alongside the other Hawking spec
   files so future sessions have access to it.
