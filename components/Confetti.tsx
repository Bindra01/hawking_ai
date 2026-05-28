"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#7c3aed", "#1cb0f6", "#ce82ff", "#ffc800", "#ff9600", "#ff4b4b"];

interface Piece {
  id: number;
  x: number;
  color: string;
  size: number;
  rotation: number;
  delay: number;
}

export default function Confetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!active) return;
    const newPieces = Array.from({ length: 45 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      delay: Math.random() * 0.4,
    }));
    setPieces(newPieces);
  }, [active]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      <AnimatePresence>
        {active &&
          pieces.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: p.rotation }}
              animate={{ y: "110vh", opacity: [1, 1, 0], rotate: p.rotation + 360 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5 + Math.random(), delay: p.delay, ease: "easeIn" }}
              style={{
                position: "absolute",
                top: 0,
                width: p.size,
                height: p.size,
                background: p.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}
