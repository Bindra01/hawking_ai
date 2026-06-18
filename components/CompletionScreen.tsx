"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Confetti from "./Confetti";
import { useRouter } from "next/navigation";
import MathText from "./MathText";
import ProblemChat from "./ProblemChat";
import { Problem } from "@/lib/types";
import { StepSummary } from "@/lib/chat-context";

export interface JourneyStep {
  icon: string;
  label: string;
  tip: string;
  correct: boolean;
}

interface CompletionScreenProps {
  stars: number;
  correct: number;
  total: number;
  xpEarned: number;
  goal: string;
  finalAnswer: string;
  journey: JourneyStep[];
  problem: Problem;
  stepSummaries: StepSummary[];
}

export default function CompletionScreen({
  stars,
  correct,
  total,
  xpEarned,
  goal,
  finalAnswer,
  journey,
  problem,
  stepSummaries,
}: CompletionScreenProps) {
  const missed = journey.filter((s) => !s.correct);
  const [showConfetti, setShowConfetti] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8">
      <Confetti active={showConfetti} />

      {/* Stars */}
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <motion.span
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: i <= stars ? 1 : 0.6, opacity: 1 }}
            transition={{ delay: 0.15 * i, duration: 0.4, type: "spring", stiffness: 200 }}
            className="text-5xl"
            style={{ filter: i <= stars ? "none" : "grayscale(1) opacity(0.3)" }}
          >
            ⭐
          </motion.span>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-center"
      >
        <p className="text-3xl font-black" style={{ color: "#7c3aed" }}>
          {correct === total ? "Perfect!" : correct >= total * 0.8 ? "Excellent!" : "Good effort!"}
        </p>
        <p className="text-base font-semibold mt-1" style={{ color: "#afafbf" }}>
          {correct}/{total} correct
        </p>
      </motion.div>

      {/* XP */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, type: "spring" }}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl"
        style={{ background: "#1e1a0e", border: "2px solid #ffc800" }}
      >
        <span className="text-2xl">⚡</span>
        <span className="text-2xl font-black" style={{ color: "#ffc800" }}>
          +{xpEarned} XP
        </span>
      </motion.div>

      {/* Final Answer */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="w-full rounded-2xl p-4"
        style={{ background: "#1a1a2e", border: "2px solid #2a2a40" }}
      >
        <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: "#afafbf", letterSpacing: "1.5px" }}>
          Final Answer
        </p>
        <MathText
          text={finalAnswer}
          className="text-base font-bold"
          style={{ color: "#e5e5e5" }}
        />
      </motion.div>

      {/* Solution Story — replays the whole journey as one connected method,
          so the student sees how the steps chained from the goal to the answer
          rather than as isolated questions. */}
      {journey.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="w-full rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: "#1a1a2e", border: "2px solid #2a2a40" }}
        >
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "#afafbf", letterSpacing: "1.5px" }}>
            How you cracked it
          </p>

          <div className="flex items-start gap-2">
            <span className="text-sm mt-0.5">🎯</span>
            <MathText
              text={goal}
              className="text-sm font-semibold leading-snug"
              style={{ color: "#afafbf" }}
            />
          </div>

          <div className="flex flex-col">
            {journey.map((s, i) => (
              <div key={i} className="flex gap-3">
                {/* Timeline rail */}
                <div className="flex flex-col items-center">
                  <div
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{
                      width: 26,
                      height: 26,
                      fontSize: "12px",
                      background: s.correct ? "#1e2a14" : "#2a1414",
                      border: `2px solid ${s.correct ? "#58cc02" : "#ff4b4b"}`,
                    }}
                  >
                    {s.correct ? "✓" : "✗"}
                  </div>
                  {i < journey.length - 1 && (
                    <div className="w-0.5 flex-1 my-1" style={{ background: "#2a2a40", minHeight: 18 }} />
                  )}
                </div>
                {/* Step content */}
                <div className="flex flex-col pb-3">
                  <span
                    className="text-xs font-black uppercase"
                    style={{ color: s.correct ? "#58cc02" : "#ff4b4b", letterSpacing: "0.8px", fontSize: "10px" }}
                  >
                    {s.icon} {s.label}
                  </span>
                  {s.tip && (
                    <MathText
                      text={s.tip}
                      className="text-sm font-medium leading-snug mt-0.5"
                      style={{ color: "#e5e5e5" }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Where you stumbled / what to improve — only when steps were missed.
          Surfaces the exact misses + their fixes so the recap doubles as
          targeted metacognition. */}
      {missed.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="w-full rounded-2xl p-4 flex flex-col gap-2"
          style={{ background: "#2a1414", border: "2px solid #ff4b4b" }}
        >
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#ff7b7b", letterSpacing: "1.5px" }}>
            Where to improve
          </p>
          {missed.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm mt-0.5">🔁</span>
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase" style={{ color: "#ff7b7b", letterSpacing: "0.5px", fontSize: "10px" }}>
                  {s.label}
                </span>
                {s.tip && (
                  <MathText
                    text={s.tip}
                    className="text-sm font-semibold leading-relaxed mt-0.5"
                    style={{ color: "#e5e5e5" }}
                  />
                )}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Chat about this problem */}
      <button
        onClick={() => setChatOpen(true)}
        className="btn-press w-full py-4 rounded-2xl font-black text-sm uppercase"
        style={{
          background: "transparent",
          color: "#7c3aed",
          border: "2px solid #7c3aed",
          letterSpacing: "1.5px",
          fontSize: "13px",
          cursor: "pointer",
        }}
      >
        💬 Chat about this problem
      </button>

      {/* Continue */}
      <button
        onClick={() => router.push("/home")}
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

      {chatOpen && (
        <ProblemChat
          problemId={problem.id}
          context={{
            title: problem.title,
            scenario: problem.scenario,
            goal: problem.goal,
            finalAnswer: problem.final_answer,
            steps: stepSummaries,
          }}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
