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

/** Valid problem statuses in the moderation workflow. */
export const VALID_STATUSES = [
  "draft",
  "approved",
  "published",
  "rejected",
] as const;

/** Suggested topics per subject for the admin generation form. */
export const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  mechanics: ["Kinematics", "Newton's Laws", "Work-Energy", "Rotational Motion", "Gravitation", "Oscillations", "Fluid Mechanics"],
  electrodynamics: ["Electrostatics", "Current Electricity", "Magnetism", "Electromagnetic Induction", "AC Circuits", "Electromagnetic Waves"],
  thermodynamics: ["Heat Transfer", "Kinetic Theory", "Laws of Thermodynamics", "Calorimetry", "Thermal Expansion"],
  quantum_mechanics: ["Photoelectric Effect", "Bohr Model", "De Broglie Wavelength", "Nuclear Physics", "Radioactivity"],
};
