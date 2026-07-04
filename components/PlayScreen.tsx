"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Problem } from "@/lib/types";
import { calcXP, calcStars } from "@/lib/xp";
import {
  type Answer,
  describeAnswer,
  describeCorrectAnswer,
} from "@/lib/step-eval";
import { StepSummary } from "@/lib/chat-context";
import { stepIcon } from "@/lib/step-icons";
import StepQuestion from "./StepQuestion";
import CompletionScreen from "./CompletionScreen";
import MathText from "./MathText";

type Phase = "intro" | "playing" | "reveal" | "complete";

// Non-committal reveal copy (legacy …→solve→sanity flows only): the student can
// CONTINUE after either a right or wrong predict pick, so the card may never
// congratulate or assert correctness — it stays neutral.
const REVEAL = {
  heading: "Here's how it works out",
  label: "The answer",
  body: "Given the form you predicted, this is where the numbers land.",
};

interface PlayScreenProps {
  problem: Problem;
}

export default function PlayScreen({ problem }: PlayScreenProps) {
  const flow = problem.solution_flow;
  const steps = flow.steps;

  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [answers, setAnswers] = useState<(Answer | null)[]>([]);
  const [stepSummaries, setStepSummaries] = useState<StepSummary[]>([]);
  const [showScenario, setShowScenario] = useState(false);
  // When non-null, the student is reviewing a completed step (read-only).
  // Tapping a completed step icon sets this; tapping the current step icon or
  // the "BACK TO CURRENT" button clears it.
  const [reviewStepIndex, setReviewStepIndex] = useState<number | null>(null);

  // Index of the dedicated "solve" (PREDICT THE FORM) step. -1 for legacy /
  // un-regenerated problems that predate the solve step — those flow unchanged
  // (no reveal beat).
  const solveIdx = steps.findIndex((s) => s.type === "solve");

  function handleStart() {
    setPhase("playing");
  }

  function handleNext(correct: boolean, answer: Answer | null) {
    const newResults = [...results, correct];
    setResults(newResults);
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (stepIndex + 1 >= steps.length) {
      // Build the per-step recap from the freshly-computed locals (not the
      // async state) so the LAST step's summary isn't dropped.
      const summaries: StepSummary[] = steps.map((s, i) => ({
        label: s.label,
        prompt: s.prompt,
        correct: newResults[i] ?? false,
        studentAnswer: describeAnswer(s, newAnswers[i] ?? null),
        correctAnswer: describeCorrectAnswer(s),
      }));
      setStepSummaries(summaries);

      const stepsCorrect = newResults.filter(Boolean).length;
      const xpEarned = calcXP(stepsCorrect, steps.length);
      const stars = calcStars(stepsCorrect, steps.length);

      // Show the recap immediately. CompletionScreen renders entirely from
      // in-memory results (journey/stars/xp), so it never needs the POST
      // response — persisting the attempt is fire-and-forget in the background.
      setPhase("complete");

      void fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // keepalive lets the request outlive this page, so tapping CONTINUE
        // immediately (which navigates to /home) can't abort the save.
        keepalive: true,
        body: JSON.stringify({
          problem_id: problem.id,
          steps_correct: stepsCorrect,
          steps_total: steps.length,
          xp_earned: xpEarned,
          stars,
        }),
      }).catch(() => {
        // non-blocking: a failed save must not block the recap
      });
    } else if (stepIndex === solveIdx && solveIdx !== -1) {
      // The student just answered the solve step (and it's not the last step):
      // show the in-flow reveal card before advancing. Do NOT advance stepIndex
      // yet — sanity remains steps[stepIndex + 1] when we resume from reveal.
      setPhase("reveal");
    } else {
      setStepIndex(stepIndex + 1);
      setReviewStepIndex(null);
    }
  }

  const stepsCorrect = results.filter(Boolean).length;
  const xpEarned = calcXP(stepsCorrect, steps.length);
  const stars = calcStars(stepsCorrect, steps.length);

  // The ordered journey through the problem: each step's role (icon/label),
  // its takeaway (tip), and whether the student got it right. Drives the
  // end-of-problem "Solution Story" recap so the steps read as one connected
  // method rather than isolated questions. results[i] aligns with steps[i].
  const journey = steps.map((s, i) => ({
    icon: stepIcon(s.type),
    label: s.label,
    tip: s.tip ?? "",
    correct: results[i] ?? false,
  }));

  // During reveal we haven't advanced stepIndex yet (it still points at the
  // solve step), so compute progress from solveIdx + 1 to show the solve step
  // as complete and the bar sitting between solve and sanity.
  const progressIndex = phase === "reveal" ? solveIdx + 1 : stepIndex;
  const progress = phase === "intro" ? 0 : (progressIndex / steps.length) * 100;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#131327", maxWidth: 480, margin: "0 auto" }}
    >
      {/* Header bar */}
      {phase !== "complete" && (
        <div className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3" style={{ background: "#131327" }}>
          <Link href="/home" className="text-2xl" style={{ color: "#afafbf" }}>✕</Link>
          <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: "#2a2a40" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "#7c3aed" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-col gap-5 px-4 pt-4 pb-32"
            >
              {/* Subject badge */}
              <div
                className="self-start px-3 py-1.5 rounded-full text-xs font-black uppercase"
                style={{
                  background: "#1a1a2e",
                  color: "#1cb0f6",
                  border: "1.5px solid #1cb0f6",
                  letterSpacing: "1.2px",
                  fontSize: "10px",
                }}
              >
                {problem.subject.replace("_", " ")} · {problem.topic}
              </div>

              {/* Problem statement */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "#1a1a2e", border: "2px solid #2a2a40" }}
              >
                <MathText
                  text={problem.scenario}
                  className="text-base font-semibold leading-relaxed"
                  style={{ color: "#e5e5e5" }}
                />
              </div>

{/* Step preview */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-black uppercase" style={{ color: "#6b6b80", letterSpacing: "1.5px" }}>
                  Your thinking steps
                </p>
                <div className="flex gap-2">
                  {steps.map((s, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className="text-2xl">{stepIcon(s.type)}</span>
                      <span className="text-xs font-bold" style={{ color: "#6b6b80", fontSize: "9px" }}>
                        {s.label.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* LET'S GO */}
              <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: "linear-gradient(to top, #131327 80%, transparent)", maxWidth: 480, margin: "0 auto" }}>
                <button
                  onClick={handleStart}
                  className="btn-press w-full py-4 rounded-2xl font-black text-sm uppercase"
                  style={{
                    background: "#7c3aed",
                    color: "#fff",
                    boxShadow: "0 5px 0 #5b21b6",
                    letterSpacing: "1.5px",
                    fontSize: "13px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  LET'S GO
                </button>
              </div>
            </motion.div>
          )}

          {phase === "playing" && (
            <motion.div
              key={`step-${reviewStepIndex ?? stepIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="px-4 pt-4 pb-36"
            >
              {/* Persistent goal + step breadcrumb: keeps the student anchored
                  to the ONE problem they're solving, with conquered steps lit
                  up so each step reads as part of a connected method.
                  Tapping the goal card toggles the full problem statement so
                  the student can re-read the scenario at any step. */}
              <div className="flex flex-col gap-2.5 mb-4">
                <button
                  type="button"
                  onClick={() => setShowScenario((v) => !v)}
                  className="rounded-xl px-3 py-2 flex items-start gap-2 w-full text-left"
                  style={{
                    background: "#1a1a2e",
                    border: showScenario ? "1.5px solid #7c3aed" : "1.5px solid #2a2a40",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                >
                  <span className="text-sm mt-0.5">🎯</span>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-black uppercase"
                        style={{ color: "#6b6b80", letterSpacing: "1.2px", fontSize: "9px" }}
                      >
                        Goal
                      </span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: "#7c3aed", fontSize: "9px", letterSpacing: "0.5px" }}
                      >
                        {showScenario ? "HIDE PROBLEM" : "VIEW PROBLEM"}
                      </span>
                    </div>
                    <MathText
                      text={problem.goal}
                      className="text-sm font-semibold leading-snug"
                      style={{ color: "#e5e5e5" }}
                    />
                  </div>
                </button>
                <AnimatePresence>
                  {showScenario && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="rounded-xl px-3 py-2.5"
                        style={{ background: "#1a1a2e", border: "1.5px solid #2a2a40" }}
                      >
                        <span
                          className="text-xs font-black uppercase block mb-1"
                          style={{ color: "#6b6b80", letterSpacing: "1.2px", fontSize: "9px" }}
                        >
                          Problem Statement
                        </span>
                        <MathText
                          text={problem.scenario}
                          className="text-sm font-semibold leading-relaxed"
                          style={{ color: "#e5e5e5" }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-1.5" role="list" aria-label="Problem steps">
                  {steps.map((s, i) => {
                    const done = i < stepIndex;
                    const current = i === stepIndex;
                    const reviewing = reviewStepIndex === i;
                    const status = done ? "completed" : current ? "current" : "upcoming";
                    const canTap = done || current;
                    return (
                      <div key={i} role="listitem" className="flex items-center gap-1.5 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!canTap) return;
                            if (current) {
                              setReviewStepIndex(null); // back to current step
                            } else if (done) {
                              setReviewStepIndex(i); // review a completed step
                            }
                          }}
                          className="flex items-center justify-center rounded-full"
                          style={{
                            width: 26,
                            height: 26,
                            fontSize: "13px",
                            background: reviewing
                              ? "#2e1065"
                              : current && reviewStepIndex === null
                              ? "#7c3aed"
                              : done
                              ? "#1e1a0e"
                              : "#1a1a2e",
                            border: reviewing
                              ? "2px solid #a78bfa"
                              : current && reviewStepIndex === null
                              ? "2px solid #a78bfa"
                              : done
                              ? "2px solid #ffc800"
                              : "2px solid #2a2a40",
                            filter: !done && !current ? "grayscale(1) opacity(0.5)" : "none",
                            cursor: canTap ? "pointer" : "default",
                            padding: 0,
                            lineHeight: 1,
                            appearance: "none" as const,
                            outline: "none",
                          }}
                          aria-label={`Step ${i + 1}: ${s.label}, ${status}${canTap ? " (tap to review)" : ""}`}
                          aria-current={current && reviewStepIndex === null ? "step" : undefined}
                        >
                          {done ? "✓" : stepIcon(s.type)}
                        </button>
                        {i < steps.length - 1 && (
                          <div
                            className="flex-1 h-0.5 rounded-full"
                            style={{ background: i < stepIndex ? "#ffc800" : "#2a2a40" }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {reviewStepIndex !== null ? (
                <>
                  <StepQuestion
                    key={`review-${reviewStepIndex}`}
                    step={steps[reviewStepIndex]}
                    stepIndex={reviewStepIndex}
                    totalSteps={steps.length}
                    isLast={false}
                    onNext={() => {}}
                    readOnly
                    previousAnswer={answers[reviewStepIndex]}
                  />
                  {/* Fixed "back to current step" button */}
                  <div
                    className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
                    style={{
                      background: "linear-gradient(to top, #131327 80%, transparent)",
                      maxWidth: 480,
                      margin: "0 auto",
                    }}
                  >
                    <button
                      onClick={() => setReviewStepIndex(null)}
                      className="btn-press w-full py-4 rounded-2xl font-black text-sm uppercase"
                      style={{
                        background: "#7c3aed",
                        color: "#fff",
                        boxShadow: "0 5px 0 #5b21b6",
                        letterSpacing: "1.5px",
                        fontSize: "13px",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      BACK TO CURRENT STEP
                    </button>
                  </div>
                </>
              ) : (
                <StepQuestion
                  key={`active-${stepIndex}`}
                  step={steps[stepIndex]}
                  stepIndex={stepIndex}
                  totalSteps={steps.length}
                  isLast={stepIndex === steps.length - 1}
                  onNext={handleNext}
                />
              )}
            </motion.div>
          )}

          {phase === "reveal" && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col justify-center px-4 pt-4 pb-36"
              style={{ minHeight: "70vh" }}
            >
              <div
                className="relative rounded-3xl flex flex-col items-center gap-4 text-center overflow-hidden"
                style={{
                  background: "#1a1a2e",
                  border: "2px solid #2a2a40",
                  padding: "28px 22px",
                }}
              >
                {/* subtle slate-teal glow behind the medallion */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: -40,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 220,
                    height: 220,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, rgba(111,179,184,.16), transparent 70%)",
                  }}
                />
                <div
                  className="relative flex items-center justify-center rounded-full"
                  style={{
                    width: 74,
                    height: 74,
                    background: "#0e2326",
                    border: "2.5px solid #6fb3b8",
                    fontSize: "34px",
                    boxShadow: "0 0 0 6px rgba(111,179,184,.12)",
                  }}
                >
                  🔮
                </div>
                <div
                  className="relative font-black uppercase"
                  style={{
                    color: "#6fb3b8",
                    fontSize: "11px",
                    letterSpacing: "2px",
                  }}
                >
                  The Answer
                </div>
                <div
                  className="relative font-black"
                  style={{ color: "#e5e5e5", fontSize: "26px", lineHeight: 1.1 }}
                >
                  {REVEAL.heading}
                </div>

                <div
                  className="relative w-full rounded-2xl flex flex-col gap-1.5"
                  style={{
                    background: "#0e2326",
                    border: "2px solid #6fb3b8",
                    padding: "18px 16px",
                  }}
                >
                  <div
                    className="font-black uppercase"
                    style={{
                      color: "#6fb3b8",
                      fontSize: "10px",
                      letterSpacing: "1.8px",
                    }}
                  >
                    {REVEAL.label}
                  </div>
                  <MathText
                    text={problem.final_answer}
                    className="font-black"
                    style={{ color: "#fff", fontSize: "30px", letterSpacing: ".5px" }}
                  />
                </div>

                <div
                  className="relative font-bold leading-snug"
                  style={{ color: "#afafbf", fontSize: "13px", maxWidth: 320 }}
                >
                  {REVEAL.body}
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: "linear-gradient(to top, #131327 80%, transparent)", maxWidth: 480, margin: "0 auto" }}>
                <button
                  onClick={() => {
                    setStepIndex(solveIdx + 1);
                    setPhase("playing");
                  }}
                  className="btn-press w-full py-4 rounded-2xl font-black text-sm uppercase"
                  style={{
                    background: "#7c3aed",
                    color: "#fff",
                    boxShadow: "0 5px 0 #5b21b6",
                    letterSpacing: "1.5px",
                    fontSize: "13px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  CONTINUE
                </button>
              </div>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <CompletionScreen
                stars={stars}
                correct={stepsCorrect}
                total={steps.length}
                xpEarned={xpEarned}
                goal={problem.goal}
                finalAnswer={problem.final_answer}
                journey={journey}
                problem={problem}
                stepSummaries={stepSummaries}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
