import type { Beat, Ink, Lesson, Visual } from "./types";

const phrase = (
  text: string,
  x: number,
  y: number,
  color: Ink = "ink",
): Visual => ({ type: "write_text", text, x, y, color });
const term = (text: string, x: number, y: number): Visual => ({
  type: "write_equation",
  text,
  x,
  y,
  color: "teal",
});
const arrow = (x: number, y: number, x2: number, y2: number): Visual => ({
  type: "draw_diagram",
  shape: "arrow",
  x,
  y,
  x2,
  y2,
  radius: 0,
  color: "amber",
});
const beat = (section: string, narration: string, visual: Visual): Beat => ({
  section,
  narration,
  visual,
});

/** A prompt demonstration, never a fallback or a substitute for generated lessons. */
export const TEACHING_EXAMPLE: Lesson = {
  title: "When does a push do work?",
  beats: [
    beat(
      "A push that changes something",
      "Imagine sliding a suitcase across the floor. You push, and it moves away from you.",
      phrase("A sliding suitcase", 60, 90),
    ),
    beat(
      "A push that changes something",
      "Now push against a wall. Nothing moves. Should those count as the same thing?",
      { type: "hold" },
    ),
    beat(
      "A push that changes something",
      "Let's see what the push changes.",
      arrow(100, 200, 280, 200),
    ),
    beat(
      "A push that changes something",
      "Work measures energy transferred by a force as an object moves. Effort alone doesn't tell us that.",
      phrase("Energy transferred by a force", 60, 300),
    ),
    beat(
      "A push that changes something",
      "Our arrow shows the push. Imagine the suitcase moving along it.",
      { type: "highlight", x: 190, y: 200, radius: 100, color: "amber" },
    ),
    beat(
      "Describing the push",
      "Let's give that idea a compact mathematical form.",
      { type: "clear" },
    ),
    beat(
      "Describing the push",
      "W stands for the work done by this force.",
      term("W", 60, 160),
    ),
    beat(
      "Describing the push",
      "For a constant force, start with its size, F.",
      term("= F", 105, 160),
    ),
    beat(
      "Describing the push",
      "Multiply by d, the size of the object's displacement.",
      term("× d", 185, 160),
    ),
    beat(
      "Describing the push",
      "Then cosine theta selects the force component along that displacement.",
      term("× cos θ", 265, 160),
    ),
    beat(
      "Describing the push",
      "Theta is the angle between force and displacement. A sideways force contributes nothing along the motion.",
      { type: "hold" },
    ),
    beat(
      "Describing the push",
      "What if we push straight along the motion? Theta is zero, so that factor becomes one.",
      { type: "highlight", x: 328, y: 155, radius: 68, color: "teal" },
    ),
    beat(
      "Try one push",
      "Try a constant ten-newton push straight along a three-metre displacement.",
      phrase("F: 10 N", 60, 85),
    ),
    beat(
      "Try one push",
      "The suitcase moves three metres along the push.",
      phrase("d: 3 m", 60, 145),
    ),
    beat(
      "Try one push",
      "Before calculating, would twice the distance transfer more energy? Yes, with the same force.",
      { type: "hold" },
    ),
    beat(
      "Try one push",
      "For our original push, the work is...",
      term("W", 60, 245),
    ),
    beat(
      "Try one push",
      "Ten newtons, multiplied by...",
      term("= 10 N", 105, 245),
    ),
    beat(
      "Try one push",
      "Three metres. The angle factor is one here.",
      term("× 3 m", 235, 245),
    ),
    beat(
      "Try one push",
      "That gives thirty joules of energy transferred by our push.",
      term("= 30 J", 365, 245),
    ),
    beat(
      "Try one push",
      "That's work by this push, not necessarily net work. Friction could also transfer energy.",
      { type: "hold" },
    ),
    beat(
      "Effort is not the same thing",
      "Now return to the wall. Feeling tired doesn't mean you transferred energy to it by moving it.",
      { type: "hold" },
    ),
    beat(
      "Effort is not the same thing",
      "With no displacement, the work on the stationary wall is zero.",
      phrase("No displacement: no work on the wall", 60, 120),
    ),
    beat(
      "Effort is not the same thing",
      "Your body still uses energy. We're measuring work on the wall, not effort inside your muscles.",
      { type: "hold" },
    ),
    beat(
      "Effort is not the same thing",
      "So ask: what force acts, and how does the object move along it? That's the connection to remember.",
      { type: "hold" },
    ),
  ],
};
