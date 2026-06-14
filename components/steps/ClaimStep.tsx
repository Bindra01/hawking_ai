"use client";

import { Step } from "@/lib/types";
import type { Answer } from "@/lib/step-eval";
import MathText from "../MathText";

interface ClaimStepProps {
  step: Step;
  answer: Answer | null;
  submitted: boolean;
  color: string;
  onAnswerChange: (answer: Answer) => void;
}

export default function ClaimStep({
  step,
  answer,
  submitted,
  color,
  onAnswerChange,
}: ClaimStepProps) {
  const claim = step.claim;
  if (!claim) return null;

  const saidTrap = answer && answer.kind === "claim" ? answer.saidTrap : null;

  // Each button represents a choice: saidTrap === true => "IT'S A TRAP".
  const choices: { label: string; saidTrap: boolean }[] = [
    { label: "SOUND RIGHT", saidTrap: false },
    { label: "IT'S A TRAP", saidTrap: true },
  ];

  return (
    <div className="flex flex-col gap-4 mt-1">
      {/* Statement card */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "#1a1a2e", border: "2px solid #37374a" }}
      >
        <MathText
          text={claim.statement}
          className="text-base font-bold leading-snug"
          style={{ color: "#e5e5e5", fontSize: "16px" }}
        />
      </div>

      {/* Two stacked choice buttons */}
      <div className="flex flex-col gap-3">
        {choices.map((choice) => {
          const isChosen = saidTrap === choice.saidTrap;
          // The correct choice is the one whose saidTrap matches claim.isTrap.
          const isCorrectChoice = choice.saidTrap === claim.isTrap;

          let borderColor = "#37374a";
          let bg = "#1a1a2e";
          let textColor = "#e5e5e5";
          let indicator = "";

          if (submitted) {
            if (isCorrectChoice) {
              borderColor = "#7c3aed";
              bg = "#1a0829";
              textColor = "#fff";
              indicator = "✓";
            } else if (isChosen) {
              borderColor = "#ff4b4b";
              bg = "#2e1a1a";
              textColor = "#ff4b4b";
              indicator = "✗";
            }
          } else if (isChosen) {
            borderColor = color;
            bg = "#1a1a2e";
          }

          return (
            <button
              key={choice.label}
              onClick={() =>
                !submitted &&
                onAnswerChange({ kind: "claim", saidTrap: choice.saidTrap })
              }
              disabled={submitted}
              className="flex items-center justify-center gap-2 w-full rounded-2xl font-black uppercase transition-all"
              style={{
                minHeight: 56,
                padding: "16px",
                background: bg,
                border: `2px solid ${borderColor}`,
                color: textColor,
                letterSpacing: "1px",
                fontSize: "15px",
                cursor: submitted ? "default" : "pointer",
              }}
            >
              {choice.label}
              {indicator && <span style={{ fontSize: 16 }}>{indicator}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
