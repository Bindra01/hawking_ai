"use client";

import { Step } from "@/lib/types";
import type { Answer } from "@/lib/step-eval";
import MathText from "../MathText";

interface McqStepProps {
  step: Step;
  answer: Answer | null;
  submitted: boolean;
  color: string;
  onAnswerChange: (answer: Answer) => void;
  // When set, the terminal predict step suppresses correct/incorrect cues: the
  // student's selected option gets a calm slate-teal highlight, no ✓/✗ and no
  // red text, and no option is marked as "the correct answer". Grading still
  // flows through evaluateStep — only the visual treatment changes.
  neutral?: boolean;
}

export default function McqStep({
  step,
  answer,
  submitted,
  color,
  onAnswerChange,
  neutral,
}: McqStepProps) {
  const options = step.options ?? [];
  const selected = answer && answer.kind === "mcq" ? answer.index : null;

  return (
    <div className="flex flex-col gap-3 mt-1">
      {options.map((option, i) => {
        let borderColor = "#37374a";
        let bg = "#1a1a2e";
        let textColor = "#e5e5e5";
        let radioFill = "transparent";
        let indicator = "";

        if (submitted) {
          if (neutral) {
            // Terminal predict step: highlight only the student's pick with a
            // calm slate-teal treatment — no ✓/✗, no red text, and no reveal of
            // which option was "correct".
            if (i === selected) {
              borderColor = "#6fb3b8";
              bg = "#0e2326";
              radioFill = "#6fb3b8";
            }
          } else if (option.correct) {
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
            onClick={() => !submitted && onAnswerChange({ kind: "mcq", index: i })}
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
  );
}
