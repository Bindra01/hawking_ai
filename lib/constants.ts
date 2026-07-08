/** Valid physics subjects in the app. */
export const VALID_SUBJECTS = [
  "mechanics",
  "electrodynamics",
  "thermodynamics",
  "quantum_mechanics",
] as const;

/** Valid difficulty levels. */
export const VALID_DIFFICULTIES = [
  "class_11",
  "class_12",
  "college",
] as const;

/** Full subject names (used on cards, admin, detail views). */
export const SUBJECT_LABELS: Record<string, string> = {
  mechanics: "Mechanics",
  electrodynamics: "Electrodynamics",
  thermodynamics: "Thermodynamics",
  quantum_mechanics: "Quantum Mechanics",
};

/** Short subject names (used in compact filter chips / stat rows). */
export const SUBJECT_SHORT_LABELS: Record<string, string> = {
  mechanics: "Mechanics",
  electrodynamics: "Electrodynamics",
  thermodynamics: "Thermo",
  quantum_mechanics: "Quantum",
};

/** Difficulty labels, surfaced in the UI as "Class". */
export const DIFFICULTY_LABELS: Record<string, string> = {
  class_11: "Class 11",
  class_12: "Class 12",
  college: "College",
};

/** Class filter options for the problem list (empty key = all). */
export const CLASS_FILTER_OPTIONS = [
  { key: "", label: "All Classes" },
  ...VALID_DIFFICULTIES.map((d) => ({ key: d, label: DIFFICULTY_LABELS[d] })),
];

/** Subject filter options for the problem list (empty key = all, short labels). */
export const SUBJECT_FILTER_OPTIONS = [
  { key: "", label: "All" },
  ...VALID_SUBJECTS.map((s) => ({ key: s, label: SUBJECT_SHORT_LABELS[s] })),
];

/** Valid problem statuses in the moderation workflow. */
export const VALID_STATUSES = [
  "draft",
  "approved",
  "published",
  "rejected",
] as const;

/** Suggested topics per subject for the admin generation form. */
export const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  mechanics: [
    "Kinematics", "Newton's Laws", "Work-Energy", "Rotational Motion",
    "Gravitation", "Oscillations", "Fluid Mechanics",
    "Vectors", "Units and Dimensions", "Momentum", "Torque", "Power",
    "Uniform Circular Motion", "Energy Conservation", "Collisions",
    "Centre of Mass", "Lagrangian", "Hamiltonian", "Rigid Body",
  ],
  electrodynamics: [
    "Electrostatics", "Current Electricity", "Magnetism",
    "Electromagnetic Induction", "AC Circuits", "Electromagnetic Waves",
    "Coulomb's Law", "Electric Dipole", "Gauss's Law", "Electric Flux",
    "Electric Potential", "Ohm's Law", "Current Density", "Electric Energy",
    "Electric Power", "Magnetic Field", "Lorentz Force", "Biot-Savart Law",
    "Ampere's Circuital Law", "Magnetic Dipole Moment", "Faraday's Law",
    "Lenz's Law", "Maxwell's Equations", "Displacement Current", "Electric Field",
  ],
  thermodynamics: [
    "Heat Transfer", "Kinetic Theory", "Laws of Thermodynamics",
    "Calorimetry", "Thermal Expansion",
    "Temperature and Heat", "Specific Heat", "Newton's Law of Cooling",
    "Ideal Gas Equation", "Molecular Model of Gas", "Pressure",
    "Law of Equipartition of Energy", "State Variables (P, V, T)",
    "Work Done by/on Gas", "First Law of Thermodynamics", "Entropy",
  ],
  quantum_mechanics: [
    "Photoelectric Effect", "Bohr Model of Hydrogen", "De Broglie Wavelength",
    "Nuclear Physics", "Radioactivity",
    "Matter Waves", "Dual Nature of Matter and Radiation",
    "Rutherford Atomic Model", "Schrödinger Equation", "Wave Function",
    "Normalisation", "Heisenberg Uncertainty Principle",
    "Infinite Potential Well", "Harmonic Oscillator",
    "Probability", "Probability Density",
  ],
};
