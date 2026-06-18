"use client";

import { useRef, useState, useEffect } from "react";

export interface ChipOption {
  key: string;
  label: string;
}

interface ChipFilterProps {
  label?: string;
  options: ChipOption[];
  active: string;
  onChange: (key: string) => void;
}

export default function ChipFilter({ label, options, active, onChange }: ChipFilterProps) {
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
  }, [options]);

  function ArrowButton({ direction }: { direction: "left" | "right" }) {
    const isLeft = direction === "left";
    return (
      <button
        onClick={() => scrollBy(direction)}
        className="absolute z-10 flex items-center justify-center"
        style={{
          [isLeft ? "left" : "right"]: 0,
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
          [isLeft ? "marginLeft" : "marginRight"]: 2,
        }}
        aria-label={isLeft ? "Scroll left" : "Scroll right"}
      >
        {isLeft ? "‹" : "›"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span
          className="px-4 font-black uppercase"
          style={{ color: "#6b6b80", letterSpacing: "1.5px", fontSize: "10px" }}
        >
          {label}
        </span>
      )}
      <div className="relative flex items-center">
        {canScrollLeft && <ArrowButton direction="left" />}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-2 overflow-x-auto pb-1 px-4"
          style={{ scrollbarWidth: "none", width: "100%" }}
        >
          {options.map(({ key, label: optLabel }) => {
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
                {optLabel}
              </button>
            );
          })}
        </div>

        {canScrollRight && <ArrowButton direction="right" />}
      </div>
    </div>
  );
}
