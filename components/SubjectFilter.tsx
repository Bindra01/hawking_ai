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
  const [canScrollRight, setCanScrollRight] = useState(false);

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-2 overflow-x-auto pb-1 px-4"
        style={{ scrollbarWidth: "none" }}
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

      {/* Scroll indicator: fade + arrow */}
      {canScrollRight && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none"
          style={{
            background: "linear-gradient(to right, transparent, #131327 70%)",
            width: 48,
            paddingRight: 8,
            justifyContent: "flex-end",
          }}
        >
          <span
            className="text-sm animate-pulse"
            style={{ color: "#7c3aed", fontWeight: 900 }}
          >
            ›
          </span>
        </div>
      )}
    </div>
  );
}
