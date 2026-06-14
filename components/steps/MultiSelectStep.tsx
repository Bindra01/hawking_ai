"use client";

import { Step } from "@/lib/types";
import type { Answer } from "@/lib/step-eval";
import MathText from "../MathText";

interface MultiSelectStepProps {
  step: Step;
  answer: Answer | null;
  submitted: boolean;
  color: string;
  onAnswerChange: (answer: Answer) => void;
}

export default function MultiSelectStep({
  step,
  answer,
  submitted,
  color,
  onAnswerChange,
}: MultiSelectStepProps) {
  const data = step.multiselect;
  if (!data) return null;

  const selected =
    answer && answer.kind === "multiselect" ? answer.indices : [];
  const selectedSet = new Set(selected);

  function toggle(i: number) {
    if (submitted) return;
    const next = new Set(selectedSet);
    if (next.has(i)) {
      next.delete(i);
    } else {
      next.add(i);
    }
    onAnswerChange({
      kind: "multiselect",
      indices: [...next].sort((a, b) => a - b),
    });
  }

  return (
    <div className="flex flex-col gap-3 mt-1">
      {data.items.map((item, i) => {
        const isSelected = selectedSet.has(i);

        let borderColor = "#37374a";
        let bg = "#1a1a2e";
        let textColor = "#e5e5e5";
        let boxBorder = "#37374a";
        let boxFill = "transparent";
        let indicator = "";

        if (submitted) {
          if (item.matters) {
            // Quantities that actually matter — always marked correct (green ✓).
            borderColor = "#7c3aed";
            bg = "#1a0829";
            boxBorder = "#7c3aed";
            boxFill = "#7c3aed";
            indicator = "✓";
          } else if (isSelected) {
            // User selected something that doesn't matter — wrong (red ✗).
            borderColor = "#ff4b4b";
            bg = "#2e1a1a";
            textColor = "#ff4b4b";
            boxBorder = "#ff4b4b";
            boxFill = "#ff4b4b";
            indicator = "✗";
          }
        } else if (isSelected) {
          borderColor = color;
          bg = "#1a1a2e";
          boxBorder = color;
          boxFill = color;
          indicator = "✓";
        }

        return (
          <button
            key={i}
            onClick={() => toggle(i)}
            disabled={submitted}
            className="flex items-center gap-3 text-left w-full p-4 rounded-2xl transition-all"
            style={{
              minHeight: 56,
              background: bg,
              border: `2px solid ${borderColor}`,
              cursor: submitted ? "default" : "pointer",
            }}
          >
            {/* Checkbox */}
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                border: `2.5px solid ${boxBorder}`,
                background: boxFill,
                color: "#fff",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {indicator}
            </div>
            <MathText
              text={item.text}
              className="text-sm font-semibold leading-snug"
              style={{ color: textColor }}
            />
          </button>
        );
      })}
    </div>
  );
}
