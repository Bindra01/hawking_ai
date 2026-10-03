import type { GenerationRequest, Lesson, Visual } from "./types";

export class TutorError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TutorError";
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  ) {
    throw new Error(`Expected nonempty text up to ${max} characters`);
  }
  return value.trim();
}
function number(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`Coordinate must be ${min}..${max}`);
  return value;
}

export function validateRequest(value: unknown): GenerationRequest {
  try {
    const input = object(value);
    return {
      topic: text(input.topic, 200),
      ...(input.question !== undefined
        ? { question: text(input.question, 1000) }
        : {}),
      ...(input.context !== undefined
        ? { context: text(input.context, 4000) }
        : {}),
    };
  } catch {
    throw new TutorError(
      400,
      "Enter a topic (1–200 characters), an optional question (1–1000), and optional context (1–4000).",
    );
  }
}

function visual(value: unknown): Visual {
  const v = object(value);
  if (v.type === "hold" || v.type === "clear") return { type: v.type };
  const x = number(v.x, 35, 720);
  const y = number(v.y, 45, 410);
  if (v.color !== "ink" && v.color !== "teal" && v.color !== "amber")
    throw new Error("Unknown ink color");
  const color = v.color;
  if (v.type === "highlight") {
    const radius = number(v.radius, 5, 120);
    if (
      x - radius < 35 ||
      x + radius > 720 ||
      y - radius < 45 ||
      y + radius > 410
    )
      throw new Error("Highlight outside safe bounds");
    return { type: "highlight", x, y, radius, color };
  }
  if (v.type === "write_text" || v.type === "write_equation") {
    const label = text(v.text, 45);
    if (
      /[=≈≠≤≥<>]/.test(label) &&
      !/^[=≈≠≤≥<>]$/.test(label) &&
      !(v.type === "write_equation" && /^[=≈≠≤≥<>]\s*[^=≈≠≤≥<>]+$/.test(label))
    ) {
      throw new Error(
        "Build equations term by term: put each relation symbol in its own write_equation beat, never a complete equation in text",
      );
    }
    if (/[\r\n]/.test(label)) throw new Error("Use one visual line per beat");
    // Conservative font-width budget; keep the complete line inside the board.
    if (x + label.length * (v.type === "write_equation" ? 18 : 14) > 765)
      throw new Error("Text extends beyond the board; shorten it or move left");
    return { type: v.type, text: label, x, y, color };
  }
  if (
    v.type !== "draw_diagram" ||
    !["line", "arrow", "circle"].includes(String(v.shape))
  )
    throw new Error("Unknown visual primitive");
  const x2 = number(v.x2, 35, 720);
  const y2 = number(v.y2, 45, 410);
  const radius = number(v.radius, 0, 120);
  if (
    v.shape === "circle" &&
    (radius < 5 ||
      x - radius < 35 ||
      x + radius > 720 ||
      y - radius < 45 ||
      y + radius > 410)
  )
    throw new Error("Circle outside safe bounds");
  if (v.shape !== "circle" && x === x2 && y === y2)
    throw new Error("Line must have length");
  return {
    type: "draw_diagram",
    shape: v.shape as "line" | "arrow" | "circle",
    x,
    y,
    x2,
    y2,
    radius,
    color,
  };
}

/** Split model-written equations into small visual beats without another paid call.
 * Keep narration word order and board positions; never synthesize physics content. */
export function expandEquationBeats(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.beats)) return value;
  return {
    ...input,
    beats: input.beats.flatMap((raw: unknown) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [raw];
      const beat = raw as Record<string, unknown>;
      const v = beat.visual as Record<string, unknown> | undefined;
      if (
        !v ||
        !["write_text", "write_equation"].includes(String(v.type)) ||
        typeof v.text !== "string" ||
        typeof v.x !== "number" ||
        typeof beat.narration !== "string" ||
        !/[=≈≠≤≥<>]/.test(v.text) ||
        /^[=≈≠≤≥<>]$/.test(v.text.trim()) ||
        (v.type === "write_equation" &&
          /^[=≈≠≤≥<>]\s*[^=≈≠≤≥<>]+$/.test(v.text.trim()))
      )
        return [raw];
      const terms = v.text
        .split(/([=≈≠≤≥<>]|[×÷+])/)
        .map((x) => x.trim())
        .filter(Boolean);
      const words = beat.narration.trim().split(/\s+/);
      if (terms.length < 2 || words.length < terms.length) return [raw];
      const width = terms.reduce((sum, term) => sum + term.length * 18 + 8, 0);
      if (v.x + width > 765) return [raw];
      let x = v.x;
      return terms.map((term, i) => {
        const start = Math.floor((i * words.length) / terms.length);
        const end = Math.floor(((i + 1) * words.length) / terms.length);
        const result = {
          ...beat,
          narration: words.slice(start, end).join(" "),
          visual: { ...v, type: "write_equation", text: term, x },
        };
        x += term.length * 18 + 8;
        return result;
      });
    }),
  };
}

export function prepareLesson(value: unknown, answer = false): Lesson {
  const input = object(value);
  if (
    !Array.isArray(input.beats) ||
    input.beats.length < (answer ? 3 : 12) ||
    input.beats.length > (answer ? 12 : 36)
  )
    throw new Error("Invalid beat count: main 12–36, answer 3–12");
  return validateLesson(expandEquationBeats(value), answer, true, true);
}

export function validateLesson(
  value: unknown,
  answer = false,
  expanded = false,
  tolerateDuration = false,
): Lesson {
  const input = object(value);
  const title = text(input.title, 100);
  if (
    !Array.isArray(input.beats) ||
    input.beats.length < (answer ? 3 : 12) ||
    input.beats.length > (expanded ? (answer ? 80 : 340) : answer ? 12 : 36)
  )
    throw new Error("Invalid beat count: main 12–36, answer 3–12");
  const seen = new Set<string>();
  let previous = "";
  const beats = input.beats.map((raw) => {
    const b = object(raw);
    const section = text(b.section, 50);
    if (section !== previous && seen.has(section))
      throw new Error("Section names must form contiguous pages");
    seen.add(section);
    previous = section;
    const narration = text(b.narration, 450);
    if (narration.split(/\s+/).length > 45)
      throw new Error("Each beat must be a small spoken unit");
    return { section, narration, visual: visual(b.visual) };
  });
  const words = beats.reduce(
    (sum, b) => sum + b.narration.split(/\s+/).length,
    0,
  );
  // Duration is a teaching target, not a schema failure. Keep hard resource caps,
  // but never discard a structurally valid three-minute lesson for being long.
  const minimum = tolerateDuration ? (answer ? 20 : 120) : answer ? 40 : 240;
  const maximum = tolerateDuration ? (answer ? 180 : 600) : answer ? 80 : 340;
  if (words < minimum || words > maximum)
    throw new Error(
      `Narration has ${words} words; expected ${minimum}–${maximum}`,
    );
  return { title, beats };
}

/** Read a stream with a byte cap before JSON.parse, including chunked requests. */
export async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  signal?: AbortSignal,
): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted)
        throw new TutorError(504, "The tutor took too long. Please try again.");
      const chunk = await reader.read();
      if (signal?.aborted)
        throw new TutorError(504, "The tutor took too long. Please try again.");
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
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
