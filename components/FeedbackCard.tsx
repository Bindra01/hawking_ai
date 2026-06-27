"use client";

import { motion } from "framer-motion";
import MathText from "./MathText";

interface FeedbackCardProps {
  correct: boolean;
  feedback: string;
  // When set, render the calm slate-teal "predict" chrome with no ✅/❌ glyph,
  // regardless of `correct`. Used only on the terminal predict step so the
  // student is never told they were right or wrong.
  neutral?: boolean;
}

export default function FeedbackCard({ correct, feedback, neutral }: FeedbackCardProps) {
  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        background: neutral ? "#0e2326" : correct ? "#1a0829" : "#2e1a1a",
        border: `2px solid ${neutral ? "#6fb3b8" : correct ? "#7c3aed" : "#ff4b4b"}`,
      }}
    >
      <span className="text-xl mt-0.5">{neutral ? "▸" : correct ? "✅" : "❌"}</span>
      <MathText
        text={feedback}
        className="text-sm font-semibold leading-relaxed"
        style={{ color: "#e5e5e5" }}
      />
    </motion.div>
  );
}
