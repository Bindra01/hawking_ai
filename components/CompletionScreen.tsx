"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Confetti from "./Confetti";
import { useRouter } from "next/navigation";
import MathText from "./MathText";

interface CompletionScreenProps {
  stars: number;
  correct: number;
  total: number;
  xpEarned: number;
  finalAnswer: string;
  takeaways: string[];
}

export default function CompletionScreen({
  stars,
  correct,
  total,
  xpEarned,
  finalAnswer,
  takeaways,
}: CompletionScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true);
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

      {/* Takeaways */}
      {takeaways.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="w-full rounded-2xl p-4 flex flex-col gap-2"
          style={{ background: "#1e1a0e", border: "2px solid #ffc800" }}
        >
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#ffc800", letterSpacing: "1.5px" }}>
            Key Takeaways
          </p>
          {takeaways.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm mt-0.5">💡</span>
              <MathText
                text={t}
                className="text-sm font-semibold leading-relaxed"
                style={{ color: "#e5e5e5" }}
              />
            </div>
          ))}
        </motion.div>
      )}

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
    </div>
  );
}
