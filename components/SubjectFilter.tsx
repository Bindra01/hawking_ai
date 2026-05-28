"use client";

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
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 px-4" style={{ scrollbarWidth: "none" }}>
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
  );
}
