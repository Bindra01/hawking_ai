"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Step, StepOption } from "@/lib/types";
import FeedbackCard from "./FeedbackCard";
import TipCard from "./TipCard";
import MathText from "./MathText";

const STEP_COLORS: Record<string, string> = {
  trap: "#ff4b4b",
  identify: "#ff9600",
  principle: "#ce82ff",
  setup: "#1cb0f6",
  connect: "#ff4b4b",
  sanity: "#7c3aed",
  why: "#ff9600",
};

const STEP_BG: Record<string, string> = {
  trap: "#2e1a1a",
  identify: "#2e1e0a",
  principle: "#1e0a2e",
  setup: "#0a1e2e",
  connect: "#2e1a1a",
  sanity: "#0d0520",
  why: "#2e1e0a",
};

interface StepQuestionProps {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  isLast: boolean;
  onNext: (correct: boolean) => void;
}

export default function StepQuestion({
  step,
  stepIndex,
  totalSteps,
  isLast,
  onNext,
}: StepQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [shake, setShake] = useState(false);

  const color = STEP_COLORS[step.type] ?? "#afafbf";
  const bg = STEP_BG[step.type] ?? "#1a1a2e";

  function handleCheck() {
    if (selected === null) return;
    setSubmitted(true);
    const correct = step.options[selected].correct;
    if (!correct) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
    }
  }

  function handleContinue() {
    if (!showTip) {
      setShowTip(true);
      return;
    }
    const correct = selected !== null && step.options[selected].correct;
    onNext(correct);
  }

  const isCorrect = submitted && selected !== null && step.options[selected].correct;
  const selectedOption: StepOption | null = selected !== null ? step.options[selected] : null;

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

      {/* Options */}
      <div className="flex flex-col gap-3 mt-1">
        {step.options.map((option, i) => {
          let borderColor = "#37374a";
          let bg = "#1a1a2e";
          let textColor = "#e5e5e5";
          let radioFill = "transparent";
          let indicator = "";

          if (submitted) {
            if (option.correct) {
              borderColor = "#7c3aed";
              bg = "#1a0829";
              radioFill = "#7c3aed";
              indicator = "✓";
            } else if (i === selected && !option.correct) {
              borderColor = "#ff4b4b";
              bg = "#2e1a1a";
              radioFill = "#ff4b4b";
              indicator = "✗";
              textColor = "#ff4b4b";
            }
          } else if (i === selected) {
            borderColor = color;
            radioFill = color;
          }

          return (
            <button
              key={i}
              onClick={() => !submitted && setSelected(i)}
              disabled={submitted}
              className="flex items-center gap-3 text-left w-full p-4 rounded-2xl transition-all"
              style={{
                background: bg,
                border: `2px solid ${borderColor}`,
                cursor: submitted ? "default" : "pointer",
              }}
            >
              {/* Radio circle */}
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: `2.5px solid ${borderColor}`,
                  background: radioFill,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {indicator}
              </div>
              <MathText
                text={option.text}
                className="text-sm font-semibold leading-snug"
                style={{ color: textColor }}
              />
            </button>
          );
        })}
      </div>

      {/* Feedback + tip */}
      <AnimatePresence>
        {submitted && selectedOption && (
          <FeedbackCard
            correct={isCorrect}
            feedback={selectedOption.feedback}
          />
        )}
        {showTip && <TipCard tip={step.tip} />}
      </AnimatePresence>

      {/* Bottom button — fixed positioning handled by parent */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: "linear-gradient(to top, #131327 80%, transparent)", maxWidth: 480, margin: "0 auto" }}>
        {!submitted ? (
          <button
            onClick={handleCheck}
            disabled={selected === null}
            className="btn-press w-full py-4 rounded-2xl font-black text-sm uppercase"
            style={{
              background: selected === null ? "#2a2a40" : "#7c3aed",
              color: selected === null ? "#6b6b80" : "#fff",
              boxShadow: selected === null ? "0 5px 0 #1a1a30" : "0 5px 0 #5b21b6",
              letterSpacing: "1.5px",
              fontSize: "13px",
              border: "none",
              cursor: selected === null ? "not-allowed" : "pointer",
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
              background: isCorrect ? "#7c3aed" : "#ff4b4b",
              color: "#fff",
              boxShadow: `0 5px 0 ${isCorrect ? "#5b21b6" : "#cc3333"}`,
              letterSpacing: "1.5px",
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
            }}
          >
            {!showTip ? "SEE TIP" : isLast ? "FINISH 🎉" : "CONTINUE"}
          </button>
        )}
      </div>
    </div>
  );
}
