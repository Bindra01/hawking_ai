"use client";

import { useRef, useState, useEffect } from "react";

const SUBJECTS = [
  { key: "", label: "All" },
  { key: "mechanics", label: "Mechanics" },
  { key: "electrodynamics", label: "Electrodynamics" },
  { key: "thermodynamics", label: "Thermo" },
  { key: "quantum_mechanics", label: "Quantum" },
];

interface SubjectFilterProps {
  active: string;
  onChange: (subject: string) => void;
}

export default function SubjectFilter({ active, onChange }: SubjectFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  function scrollBy(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "right" ? 120 : -120, behavior: "smooth" });
  }

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  return (
    <div className="relative flex items-center">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy("left")}
          className="absolute left-0 z-10 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#7c3aed",
            color: "#fff",
            border: "2px solid #5b21b6",
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.4)",
            cursor: "pointer",
            fontSize: 18,
            fontWeight: 900,
            marginLeft: 2,
          }}
          aria-label="Scroll left"
        >
          ‹
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-2 overflow-x-auto pb-1 px-4"
        style={{ scrollbarWidth: "none", width: "100%" }}
      >
        {SUBJECTS.map(({ key, label }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="shrink-0 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest transition-all"
              style={{
                letterSpacing: "1.2px",
                fontSize: "11px",
                background: isActive ? "#7c3aed" : "#1a1a2e",
                color: isActive ? "#fff" : "#afafbf",
                border: isActive ? "2px solid #7c3aed" : "2px solid #2a2a40",
                boxShadow: isActive ? "0 3px 0 #5b21b6" : "0 3px 0 #0d0d1a",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy("right")}
          className="absolute right-0 z-10 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#7c3aed",
            color: "#fff",
            border: "2px solid #5b21b6",
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.4)",
            cursor: "pointer",
            fontSize: 18,
            fontWeight: 900,
            marginRight: 2,
          }}
          aria-label="Scroll right"
        >
          ›
        </button>
      )}
    </div>
  );
}
