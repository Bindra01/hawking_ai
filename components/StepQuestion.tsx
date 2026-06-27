"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Step, getStepFormat } from "@/lib/types";
import { isAnswerReady, evaluateStep, type Answer } from "@/lib/step-eval";
import FeedbackCard from "./FeedbackCard";
import TipCard from "./TipCard";
import MathText from "./MathText";
import McqStep from "./steps/McqStep";
import ClaimStep from "./steps/ClaimStep";
import MultiSelectStep from "./steps/MultiSelectStep";
import BuildStep from "./steps/BuildStep";

export const STEP_COLORS: Record<string, string> = {
  trap: "#ff4b4b",
  identify: "#ff9600",
  principle: "#ce82ff",
  setup: "#1cb0f6",
  connect: "#ff4b4b",
  sanity: "#7c3aed",
  why: "#ff9600",
  solve: "#6fb3b8",
  approach: "#5b8cff",
  depends: "#38bdf8",
  scale: "#34d399",
  limit: "#fbbf24",
  form: "#5eead4",
};

// The selection highlight is always the standard UI blue, regardless of the
// step type's accent color, so "this option is currently picked" looks uniform
// across every problem. After submit, the step components switch to the
// purple (correct) / red (incorrect) result colors on their own.
const SELECT_COLOR = "#1cb0f6";

export const STEP_BG: Record<string, string> = {
  trap: "#2e1a1a",
  identify: "#2e1e0a",
  principle: "#1e0a2e",
  setup: "#0a1e2e",
  connect: "#2e1a1a",
  sanity: "#0d0520",
  why: "#2e1e0a",
  solve: "#0e2326",
  approach: "#11163a",
  depends: "#0b2438",
  scale: "#08291f",
  limit: "#2a2008",
  form: "#06251f",
};

interface StepQuestionProps {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  isLast: boolean;
  onNext: (correct: boolean, answer: Answer | null) => void;
}

export default function StepQuestion({
  step,
  stepIndex,
  totalSteps,
  isLast,
  onNext,
}: StepQuestionProps) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; feedback: string } | null>(
    null
  );

  const color = STEP_COLORS[step.type] ?? "#afafbf";
  const bg = STEP_BG[step.type] ?? "#1a1a2e";
  const format = getStepFormat(step);

  // The terminal predict step ("PREDICT THE FORM" — a `solve` step that is also
  // the last step). For new predict-last flows the PlayScreen reveal beat never
  // fires, so this is the student's final feedback surface and it must stay
  // non-committal (no correct/incorrect cues). Legacy …→solve→sanity flows have
  // `solve` NOT last, so isPredict is false there and they keep current behavior.
  const isPredict = step.type === "solve" && isLast;

  // The terminal "ASSEMBLE THE FORM" step (a `form` build that is also the last
  // step). Decision #817 = soften tone, keep grading: BuildStep keeps its
  // correct/incorrect tile coloring, but the terminal CTA is neutralized to
  // "SEE RECAP" (the exact value lands in the recap, not here). Keyed off the
  // `form` type ONLY — NOT `format === "build" && isLast` — so legacy terminal
  // build steps are unaffected.
  const isTerminalForm = step.type === "form" && isLast;

  const ready = isAnswerReady(step, answer);

  function handleAnswerChange(next: Answer) {
    if (submitted) return;
    setAnswer(next);
  }

  function handleCheck() {
    if (!ready || answer === null) return;
    const evaluated = evaluateStep(step, answer);
    setResult(evaluated);
    setSubmitted(true);
    if (!isPredict && !evaluated.correct) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
    }
  }

  function handleContinue() {
    if (!showTip) {
      setShowTip(true);
      return;
    }
    onNext(result?.correct ?? false, answer);
  }

  const isCorrect = submitted && (result?.correct ?? false);

  function renderStep() {
    const childProps = {
      step,
      answer,
      submitted,
      color: SELECT_COLOR,
      onAnswerChange: handleAnswerChange,
    };
    switch (format) {
      case "claim":
        return <ClaimStep {...childProps} />;
      case "multiselect":
        return <MultiSelectStep {...childProps} />;
      case "build":
        return <BuildStep {...childProps} />;
      case "mcq":
      default:
        return <McqStep {...childProps} neutral={isPredict} />;
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Step badge */}
      <div
        className="self-start flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ background: bg, border: `1.5px solid ${color}` }}
      >
        <span className="text-base">{step.icon}</span>
        <span
          className="text-xs font-black uppercase"
          style={{ color, letterSpacing: "1.5px", fontSize: "10px" }}
        >
          {step.label}
        </span>
      </div>

      {/* Question */}
      <motion.div
        animate={shake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        <MathText
          text={step.prompt}
          className="text-base font-black leading-snug"
          style={{ color: "#e5e5e5", fontSize: "17px" }}
        />
      </motion.div>

      {/* Format-specific interaction */}
      {renderStep()}

      {/* Feedback + tip */}
      <AnimatePresence>
        {submitted && result && (
          <FeedbackCard correct={isCorrect} feedback={result.feedback} neutral={isPredict} />
        )}
        {showTip && <TipCard tip={step.tip} />}
      </AnimatePresence>

      {/* Bottom button — fixed positioning handled by parent */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: "linear-gradient(to top, #131327 80%, transparent)", maxWidth: 480, margin: "0 auto" }}>
        {!submitted ? (
          <button
            onClick={handleCheck}
            disabled={!ready}
            className="btn-press w-full py-4 rounded-2xl font-black text-sm uppercase"
            style={{
              background: !ready ? "#2a2a40" : "#7c3aed",
              color: !ready ? "#6b6b80" : "#fff",
              boxShadow: !ready ? "0 5px 0 #1a1a30" : "0 5px 0 #5b21b6",
              letterSpacing: "1.5px",
              fontSize: "13px",
              border: "none",
              cursor: !ready ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            CHECK
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className="btn-press w-full py-4 rounded-2xl font-black text-sm uppercase"
            style={{
              // Terminal predict step uses calm slate-teal regardless of
              // correctness so the button never signals right/wrong.
              background: isPredict ? "#6fb3b8" : isCorrect ? "#7c3aed" : "#ff4b4b",
              color: "#fff",
              boxShadow: isPredict
                ? "0 5px 0 #0e2326"
                : `0 5px 0 ${isCorrect ? "#5b21b6" : "#cc3333"}`,
              letterSpacing: "1.5px",
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
            }}
          >
            {!showTip ? "SEE TIP" : isPredict || isTerminalForm ? "SEE RECAP" : isLast ? "FINISH 🎉" : "CONTINUE"}
          </button>
        )}
      </div>
    </div>
  );
}
