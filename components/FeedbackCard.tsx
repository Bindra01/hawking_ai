"use client";

import { motion } from "framer-motion";
import MathText from "./MathText";

interface FeedbackCardProps {
  correct: boolean;
  feedback: string;
}

export default function FeedbackCard({ correct, feedback }: FeedbackCardProps) {
  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        background: correct ? "#1a0829" : "#2e1a1a",
        border: `2px solid ${correct ? "#7c3aed" : "#ff4b4b"}`,
      }}
    >
      <span className="text-xl mt-0.5">{correct ? "✅" : "❌"}</span>
      <MathText
        text={feedback}
        className="text-sm font-semibold leading-relaxed"
        style={{ color: "#e5e5e5" }}
      />
    </motion.div>
  );
}
