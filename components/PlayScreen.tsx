"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Problem, SolutionFlow } from "@/lib/types";
import { calcXP, calcStars } from "@/lib/xp";
import StepQuestion from "./StepQuestion";
import CompletionScreen from "./CompletionScreen";
import MathText from "./MathText";

type Phase = "intro" | "playing" | "complete";

const STEP_ICONS: Record<string, string> = {
  trap: "⚠️",
  identify: "🎯",
  principle: "⚡",
  setup: "🔧",
  sanity: "🧪",
  connect: "🔗",
  why: "💡",
};

interface PlayScreenProps {
  problem: Problem;
}

export default function PlayScreen({ problem }: PlayScreenProps) {
  const flow = problem.solution_flow as unknown as SolutionFlow;
  const steps = flow.steps;

  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);

  function handleStart() {
    setPhase("playing");
  }

  async function handleNext(correct: boolean) {
    const newResults = [...results, correct];
    setResults(newResults);

    if (stepIndex + 1 >= steps.length) {
      // Save attempt
      const stepsCorrect = newResults.filter(Boolean).length;
      const xpEarned = calcXP(stepsCorrect, steps.length);
      const stars = calcStars(stepsCorrect, steps.length);

      try {
        await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem_id: problem.id,
            steps_correct: stepsCorrect,
            steps_total: steps.length,
            xp_earned: xpEarned,
            stars,
          }),
        });
      } catch {
        // non-blocking
      }

      setPhase("complete");
    } else {
      setStepIndex(stepIndex + 1);
    }
  }

  const stepsCorrect = results.filter(Boolean).length;
  const xpEarned = calcXP(stepsCorrect, steps.length);
  const stars = calcStars(stepsCorrect, steps.length);
  const takeaways = steps.map((s) => s.tip).filter(Boolean).slice(0, 4);

  const progress = phase === "intro" ? 0 : ((stepIndex) / steps.length) * 100;

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
                      <span className="text-2xl">{STEP_ICONS[s.type] ?? "•"}</span>
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
              key={`step-${stepIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="px-4 pt-4 pb-36"
            >
              <StepQuestion
                step={steps[stepIndex]}
                stepIndex={stepIndex}
                totalSteps={steps.length}
                isLast={stepIndex === steps.length - 1}
                onNext={handleNext}
              />
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
                finalAnswer={problem.final_answer}
                takeaways={takeaways}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
