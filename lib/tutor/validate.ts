import type { GenerationRequest, Lesson, Visual } from "./types";

export class TutorError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "TutorError";
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new Error(`Expected nonempty text up to ${max} characters`);
  }
  return value.trim();
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`Coordinate must be ${min}..${max}`);
  return value;
}

export function validateRequest(value: unknown): GenerationRequest {
  try {
    const input = object(value);
    return {
      topic: text(input.topic, 200),
      ...(input.question !== undefined ? { question: text(input.question, 1000) } : {}),
      ...(input.context !== undefined ? { context: text(input.context, 4000) } : {}),
    };
  } catch {
    throw new TutorError(400, "Enter a topic (1–200 characters), an optional question (1–1000), and optional context (1–4000).");
  }
}

function visual(value: unknown): Visual {
  const v = object(value);
  const x = number(v.x, 35, 720);
  const y = number(v.y, 45, 410);
  if (v.color !== "ink" && v.color !== "teal" && v.color !== "amber") throw new Error("Unknown ink color");
  const color = v.color;
  if (v.type === "write_text" || v.type === "write_equation") {
    const label = text(v.text, 45);
    if (/[\r\n]/.test(label)) throw new Error("Use one visual line per beat");
    // Conservative font-width budget; keep the complete line inside the board.
    if (x + label.length * (v.type === "write_equation" ? 18 : 14) > 765) throw new Error("Text extends beyond the board; shorten it or move left");
    return { type: v.type, text: label, x, y, color };
  }
  if (v.type !== "draw_diagram" || !["line", "arrow", "circle"].includes(String(v.shape))) throw new Error("Unknown visual primitive");
  const x2 = number(v.x2, 35, 720);
  const y2 = number(v.y2, 45, 410);
  const radius = number(v.radius, 0, 120);
  if (v.shape === "circle" && (radius < 5 || x - radius < 35 || x + radius > 720 || y - radius < 45 || y + radius > 410)) throw new Error("Circle outside safe bounds");
  if (v.shape !== "circle" && x === x2 && y === y2) throw new Error("Line must have length");
  return { type: "draw_diagram", shape: v.shape as "line" | "arrow" | "circle", x, y, x2, y2, radius, color };
}

export function validateLesson(value: unknown, answer = false): Lesson {
  const input = object(value);
  const title = text(input.title, 100);
  if (!Array.isArray(input.beats) || input.beats.length < (answer ? 3 : 12) || input.beats.length > (answer ? 12 : 36)) throw new Error("Invalid beat count: main 12–36, answer 3–12");
  const seen = new Set<string>();
  let previous = "";
  const beats = input.beats.map((raw) => {
    const b = object(raw);
    const section = text(b.section, 50);
    if (section !== previous && seen.has(section)) throw new Error("Section names must form contiguous pages");
    seen.add(section);
    previous = section;
    const narration = text(b.narration, 450);
    if (narration.split(/\s+/).length > 45) throw new Error("Each beat must be a small spoken unit");
    return { section, narration, visual: visual(b.visual) };
  });
  const words = beats.reduce((sum, b) => sum + b.narration.split(/\s+/).length, 0);
  if (words < (answer ? 40 : 240) || words > (answer ? 80 : 280)) throw new Error(`Narration has ${words} words; expected ${answer ? "40–80" : "240–280"}`);
  return { title, beats };
}

/** Read a stream with a byte cap before JSON.parse, including chunked requests. */
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, limit: number, signal?: AbortSignal): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new TutorError(504, "The tutor took too long. Please try again.");
      const chunk = await reader.read();
      if (signal?.aborted) throw new TutorError(504, "The tutor took too long. Please try again.");
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new TutorError(413, "Request or response is too large.");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
