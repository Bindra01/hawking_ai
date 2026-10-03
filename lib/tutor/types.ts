export type Ink = "ink" | "teal" | "amber";
export type Visual =
  | { type: "hold" }
  | { type: "clear" }
  | { type: "highlight"; x: number; y: number; radius: number; color: Ink }
  | {
      type: "write_text" | "write_equation";
      text: string;
      x: number;
      y: number;
      color: Ink;
    }
  | {
      type: "draw_diagram";
      shape: "line" | "arrow" | "circle";
      x: number;
      y: number;
      x2: number;
      y2: number;
      radius: number;
      color: Ink;
    };
export type Beat = { section: string; narration: string; visual: Visual };
export type Lesson = { title: string; beats: Beat[] };
export type GenerationRequest = {
  topic: string;
  question?: string;
  context?: string;
};
export type Position = {
  beat: number;
  offset: number;
  progress: number;
  seconds?: number;
};
export type Thread = { lesson: Lesson; position: Position };
export type TutorStatus =
  | "ready"
  | "playing"
  | "paused"
  | "paused_for_question"
  | "generating_answer"
  | "answering"
  | "done"
  | "error";
export const INK: Record<Ink, string> = {
  ink: "#283e3b",
  teal: "#168575",
  amber: "#b67a27",
};
