"use client";

import { Step } from "@/lib/types";
import type { Answer } from "@/lib/step-eval";
import MathText from "../MathText";

interface BuildStepProps {
  step: Step;
  answer: Answer | null;
  submitted: boolean;
  color: string;
  onAnswerChange: (answer: Answer) => void;
}

export default function BuildStep({
  step,
  answer,
  submitted,
  color,
  onAnswerChange,
}: BuildStepProps) {
  const data = step.build;
  if (!data) return null;

  const order = answer && answer.kind === "build" ? answer.order : [];
  const placedSet = new Set(order);

  // Whether the final arrangement is correct (only meaningful after submit).
  const placedTiles = order.map((i) => data.tiles[i]);
  const isCorrect =
    submitted &&
    data.accepted.some(
      (arr) =>
        arr.length === placedTiles.length &&
        arr.every((t, idx) => t === placedTiles[idx])
    );
  const distractorTiles = new Set(data.distractors.map((d) => d.tile));

  function place(i: number) {
    if (submitted) return;
    if (placedSet.has(i)) return;
    onAnswerChange({ kind: "build", order: [...order, i] });
  }

  function remove(posInOrder: number) {
    if (submitted) return;
    const next = order.filter((_, idx) => idx !== posInOrder);
    onAnswerChange({ kind: "build", order: next });
  }

  const rowBorder = submitted
    ? isCorrect
      ? "#7c3aed"
      : "#ff4b4b"
    : "#37374a";
  const rowBg = submitted ? (isCorrect ? "#1a0829" : "#2e1a1a") : "#15152a";

  return (
    <div className="flex flex-col gap-4 mt-1">
      {/* Answer row — the current built arrangement */}
      <div
        className="rounded-2xl p-3 flex flex-wrap gap-2 items-center"
        style={{
          minHeight: 64,
          background: rowBg,
          border: `2px solid ${rowBorder}`,
        }}
      >
        {order.length === 0 ? (
          <span
            className="text-xs font-bold uppercase"
            style={{ color: "#6b6b80", letterSpacing: "1px" }}
          >
            Tap tiles below to build
          </span>
        ) : (
          order.map((tileIndex, pos) => {
            const tile = data.tiles[tileIndex];
            const offending =
              submitted && !isCorrect && distractorTiles.has(tile);
            return (
              <button
                key={`${tileIndex}-${pos}`}
                onClick={() => remove(pos)}
                disabled={submitted}
                className="flex items-center justify-center rounded-xl font-bold transition-all"
                style={{
                  minHeight: 44,
                  padding: "8px 14px",
                  background: offending ? "#3a1414" : "#1a1a2e",
                  border: `2px solid ${
                    offending ? "#ff4b4b" : submitted ? rowBorder : color
                  }`,
                  color: offending ? "#ff4b4b" : "#e5e5e5",
                  cursor: submitted ? "default" : "pointer",
                }}
              >
                <MathText text={tile} className="text-sm font-bold" />
              </button>
            );
          })
        )}
      </div>

      {/* Tile tray */}
      <div className="flex flex-wrap gap-2">
        {data.tiles.map((tile, i) => {
          const isPlaced = placedSet.has(i);
          return (
            <button
              key={i}
              onClick={() => place(i)}
              disabled={submitted || isPlaced}
              className="flex items-center justify-center rounded-xl font-bold transition-all"
              style={{
                minHeight: 48,
                padding: "10px 16px",
                background: isPlaced ? "#101022" : "#1a1a2e",
                border: `2px solid ${isPlaced ? "#26263a" : "#37374a"}`,
                color: isPlaced ? "#46465a" : "#e5e5e5",
                opacity: isPlaced ? 0.5 : 1,
                cursor: submitted || isPlaced ? "default" : "pointer",
              }}
            >
              <MathText text={tile} className="text-sm font-bold" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
