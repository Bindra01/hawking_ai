"use client";

import { motion } from "framer-motion";
import MathText from "./MathText";

export default function TipCard({ tip }: { tip: string }) {
  return (
    <motion.div
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        background: "#1e1a0e",
        border: "2px solid #ffc800",
      }}
    >
      <span className="text-xl">💡</span>
      <MathText
        text={tip}
        className="text-sm font-bold leading-relaxed"
        style={{ color: "#ffc800" }}
      />
    </motion.div>
  );
}
