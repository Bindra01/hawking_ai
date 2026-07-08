"use client";

import { Step } from "@/lib/types";
import type { Answer } from "@/lib/step-eval";
import {
  assemblePredictFormula,
  predictConstants,
  predictEntries,
  roleForChoice,
  type PredictChoice,
} from "@/lib/predict-form";
import MathText from "../MathText";

interface PredictStepProps {
  step: Step;
  answer: Answer | null;
  submitted: boolean;
  color: string;
  onAnswerChange: (answer: Answer) => void;
}

// The three choices, in render order. `key` is the stored PredictChoice; `role`
// is the ground-truth role that choice maps to (null for "No effect").
const CHOICES: {
  key: PredictChoice;
  label: string;
  arrow: string;
}[] = [
  { key: "up", label: "Increases", arrow: "▲" },
  { key: "down", label: "Decreases", arrow: "▼" },
  { key: "none", label: "No effect", arrow: "" },
];

// One "Your form" / "Correct form" panel shown after an incorrect submit. Both
// panels share this identical structure and differ only by color/label/icon.
function ResultFormPanel({
  icon,
  label,
  labelColor,
  outerBg,
  outerBorder,
  boxBg,
  boxBorder,
  formula,
}: {
  icon: string;
  label: string;
  labelColor: string;
  outerBg: string;
  outerBorder: string;
  boxBg: string;
  boxBorder: string;
  formula: string;
}) {
  return (
    <div
      className="flex flex-col gap-2.5"
      style={{
        borderRadius: 18,
        padding: 16,
        background: outerBg,
        border: `2px solid ${outerBorder}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span
          className="font-black uppercase"
          style={{ fontSize: 11, letterSpacing: "1.6px", color: labelColor }}
        >
          {label}
        </span>
      </div>
      <div
        className="w-full flex justify-center"
        style={{
          borderRadius: 12,
          padding: 14,
          background: boxBg,
          border: `1.5px solid ${boxBorder}`,
        }}
      >
        <MathText text={formula} style={{ fontSize: 24, color: "#e5e5e5" }} />
      </div>
    </div>
  );
}

export default function PredictStep({
  step,
  answer,
  submitted,
  color,
  onAnswerChange,
}: PredictStepProps) {
  const data = step.predict;
  if (!data) return null;

  const choices: Record<string, PredictChoice> =
    answer && answer.kind === "predict" ? answer.choices : {};

  // Overall verdict (only meaningful after submit): every variable's chosen role
  // must equal its ground-truth role.
  const isCorrect =
    submitted &&
    data.variables.every(
      (v) => roleForChoice(choices[v.symbol] ?? "none") === v.role
    );

  function select(symbol: string, choice: PredictChoice) {
    if (submitted) return;
    onAnswerChange({
      kind: "predict",
      choices: { ...choices, [symbol]: choice },
    });
  }

  // Assembled formulas for the post-submit panels.
  const constants = predictConstants(step);
  const { student } = predictEntries(step, choices);
  const studentFormula = assemblePredictFormula(
    data.target,
    student,
    constants
  );

  return (
    <div className="flex flex-col gap-3.5 mt-1">
      {/* One row per FREE variable — fixed constants are not shown as rows. */}
      {data.variables.map((v) => {
        const chosen = choices[v.symbol];
        // Ground-truth choice for this variable (never "none").
        const truthChoice: PredictChoice =
          v.role === "numerator" ? "up" : "down";
        const rowRight =
          submitted && !isCorrect && chosen !== truthChoice;

        let rowBorder = "#2a2a40";
        let rowBg = "#15152a";
        let rowOpacity = 1;
        if (submitted) {
          rowOpacity = 0.92;
          if (rowRight) {
            rowBorder = "#ff4b4b";
            rowBg = "#211416";
          }
        } else if (chosen) {
          // answered row gets a subtle blue frame so scanned progress is visible
          rowBorder = "#234a63";
        }

        return (
          <div
            key={v.symbol}
            className="rounded-2xl p-3.5"
            style={{
              background: rowBg,
              border: `2px solid ${rowBorder}`,
              opacity: rowOpacity,
            }}
          >
            {/* Variable chip + prompt line */}
            <div className="flex items-baseline gap-2 mb-3">
              <span
                className="inline-flex items-center justify-center shrink-0"
                style={{
                  minWidth: 30,
                  height: 30,
                  padding: "0 9px",
                  borderRadius: 9,
                  background: "#06251f",
                  border: "1.5px solid #2a4a44",
                  color: "#5eead4",
                }}
              >
                <MathText
                  text={`$${v.symbol}$`}
                  style={{ fontSize: 17, fontWeight: 700 }}
                />
              </span>
              <MathText
                text={`If ${v.label} $${v.symbol}$ increases, $${data.target}$…`}
                className="text-sm font-bold leading-snug"
                style={{ color: "#e5e5e5" }}
              />
            </div>

            {/* Three-column choices grid */}
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              {CHOICES.map((c) => {
                const selected = chosen === c.key;
                const isTruth = c.key === truthChoice;

                // Base (pre-submit) styling.
                let border = "#37374a";
                let bg = "#1a1a2e";
                let textColor = "#cfcfe0";
                let arrowColor = "#7f7f95";
                let opacity = 1;
                let borderStyle: "solid" | "dashed" = "solid";
                let tag: { text: string; bg: string; color: string } | null =
                  null;

                if (submitted) {
                  // Locked, non-interactive after submit.
                  textColor = "#6b6b80";
                  arrowColor = "#4d4d60";
                  opacity = 0.45;
                  if (isCorrect) {
                    if (selected) {
                      // Locked correct selection: purple result chrome.
                      border = "#7c3aed";
                      textColor = "#c9a9ff";
                      bg = "#1a0829";
                      arrowColor = "#a78bfa";
                      opacity = 1;
                    }
                  } else if (rowRight) {
                    if (selected) {
                      // Student's incorrect pick.
                      border = "#ff4b4b";
                      textColor = "#ff8080";
                      bg = "#2e1a1a";
                      arrowColor = "#ff4b4b";
                      opacity = 1;
                      tag = { text: "Your pick", bg: "#ff4b4b", color: "#fff" };
                    } else if (isTruth) {
                      // The answer they should have picked (hinted in teal).
                      border = "#5eead4";
                      textColor = "#5eead4";
                      bg = "#06251f";
                      arrowColor = "#5eead4";
                      opacity = 1;
                      borderStyle = "dashed";
                      tag = { text: "Correct", bg: "#5eead4", color: "#06251f" };
                    }
                  } else if (selected) {
                    // Correct pick on a right row within a mismatch verdict.
                    border = "#7c3aed";
                    textColor = "#c9a9ff";
                    bg = "#1a0829";
                    arrowColor = "#a78bfa";
                    opacity = 1;
                  }
                } else if (selected) {
                  // Pre-submit selection = SELECT_COLOR blue.
                  border = color;
                  textColor = color;
                  bg = "#0e2233";
                  arrowColor = color;
                }

                return (
                  <button
                    key={c.key}
                    onClick={() => select(v.symbol, c.key)}
                    disabled={submitted}
                    className="relative flex items-center justify-center gap-1.5 font-extrabold transition-all"
                    style={{
                      minHeight: 46,
                      padding: "8px 4px",
                      borderRadius: 14,
                      background: bg,
                      border: `2px ${borderStyle} ${border}`,
                      color: textColor,
                      fontSize: "12.5px",
                      opacity,
                      cursor: submitted ? "default" : "pointer",
                      textAlign: "center",
                    }}
                  >
                    {tag && (
                      <span
                        className="absolute font-black uppercase"
                        style={{
                          top: -8,
                          right: 8,
                          fontSize: 8,
                          letterSpacing: "0.5px",
                          padding: "1px 5px",
                          borderRadius: 6,
                          background: tag.bg,
                          color: tag.color,
                        }}
                      >
                        {tag.text}
                      </span>
                    )}
                    {c.arrow && (
                      <span style={{ fontSize: 13, lineHeight: 1, color: arrowColor }}>
                        {c.arrow}
                      </span>
                    )}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Post-submit result panels — driven by predict data, not FeedbackCard. */}
      {submitted && isCorrect && (
        <div
          className="flex flex-col items-center gap-3 text-center"
          style={{
            borderRadius: 20,
            padding: "22px 20px",
            background: "#1a0829",
            border: "2px solid #7c3aed",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              background: "#2e1065",
              border: "2.5px solid #7c3aed",
              fontSize: 26,
            }}
          >
            ✅
          </div>
          <div
            className="font-black uppercase"
            style={{ fontSize: 11, letterSpacing: "2px", color: "#c9a9ff" }}
          >
            Correct Form
          </div>
          <div className="font-black" style={{ fontSize: 19, color: "#e5e5e5", lineHeight: 1.25 }}>
            Yes, this is the correct form
          </div>
          <div
            className="w-full flex justify-center"
            style={{
              borderRadius: 14,
              background: "#06251f",
              border: "2px solid #5eead4",
              padding: 16,
            }}
          >
            <MathText
              text={data.correctFormula}
              style={{ fontSize: 26, color: "#e5e5e5" }}
            />
          </div>
        </div>
      )}

      {submitted && !isCorrect && (
        <div className="flex flex-col gap-3">
          <ResultFormPanel
            icon="❌"
            label="Your form"
            labelColor="#ff8080"
            outerBg="#2e1a1a"
            outerBorder="#ff4b4b"
            boxBg="#211012"
            boxBorder="#52272a"
            formula={studentFormula}
          />
          <ResultFormPanel
            icon="✅"
            label="Correct form"
            labelColor="#5eead4"
            outerBg="#06251f"
            outerBorder="#5eead4"
            boxBg="#041b17"
            boxBorder="#1f4a42"
            formula={data.correctFormula}
          />
        </div>
      )}
    </div>
  );
}
