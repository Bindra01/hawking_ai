"use client";

import Link from "next/link";
import { Problem } from "@/lib/types";

const STEP_ICONS: Record<string, string> = {
  trap: "⚠️",
  identify: "🎯",
  principle: "⚡",
  setup: "🔧",
  sanity: "🧪",
  connect: "🔗",
  why: "💡",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  class_11: "Class 11",
  class_12: "Class 12",
  college: "College",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  class_11: "#7c3aed",
  class_12: "#1cb0f6",
  college: "#ce82ff",
};

interface ProblemCardProps {
  problem: Problem;
  bestAttempt?: { stars: number; xp_earned: number } | null;
}

export default function ProblemCard({ problem, bestAttempt }: ProblemCardProps) {
  const steps = (problem.solution_flow as { steps: Array<{ type: string }> })?.steps ?? [];

  return (
    <Link href={`/play/${problem.id}`}>
      <div
        className="mx-4 rounded-2xl p-4 flex flex-col gap-3 transition-all active:scale-95"
        style={{
          background: "#1a1a2e",
          border: "2px solid #2a2a40",
          boxShadow: "0 4px 0 #0d0d1a",
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="font-black text-base leading-tight" style={{ color: "#e5e5e5" }}>
              {problem.title}
            </h3>
            <p className="text-xs font-semibold" style={{ color: "#afafbf" }}>
              {problem.topic} · {steps.length} steps
            </p>
          </div>
          <span
            className="shrink-0 text-xs font-black uppercase px-2.5 py-1 rounded-full"
            style={{
              color: DIFFICULTY_COLORS[problem.difficulty] ?? "#afafbf",
              background: `${DIFFICULTY_COLORS[problem.difficulty] ?? "#afafbf"}22`,
              letterSpacing: "0.8px",
              fontSize: "10px",
            }}
          >
            {DIFFICULTY_LABELS[problem.difficulty] ?? problem.difficulty}
          </span>
        </div>

        {/* Step icons */}
        <div className="flex gap-1.5">
          {steps.map((s, i) => (
            <span key={i} className="text-base">{STEP_ICONS[s.type] ?? "•"}</span>
          ))}
        </div>

        {/* CTA */}
        {bestAttempt ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">{"⭐".repeat(bestAttempt.stars)}</span>
            <span className="text-xs font-bold" style={{ color: "#ffc800" }}>
              +{bestAttempt.xp_earned} XP
            </span>
          </div>
        ) : (
          <div
            className="self-start px-5 py-2 rounded-xl font-black text-xs uppercase"
            style={{
              background: "#7c3aed",
              color: "#fff",
              boxShadow: "0 3px 0 #5b21b6",
              letterSpacing: "1.5px",
              fontSize: "11px",
            }}
          >
            START
          </div>
        )}
      </div>
    </Link>
  );
}
