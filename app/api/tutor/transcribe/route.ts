import "server-only";
import { readBoundedBody, TutorError } from "@/lib/tutor/validate";

export const runtime = "nodejs";
export const maxDuration = 35;
const MAX_BYTES = 4 * 1024 * 1024;
const headers = { "Cache-Control": "no-store" };
const formats: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
let active = 0;
let started = 0;
let count = 0;

async function readAudio(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader();
  if (!reader) throw new TutorError(400, "Record a question first.");
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal.aborted)
        throw new TutorError(
          408,
          "The audio upload timed out. Please record again.",
        );
      const result = await reader.read();
      if (signal.aborted)
        throw new TutorError(
          408,
          "The audio upload timed out. Please record again.",
        );
      if (result.done) break;
      size += result.value.length;
      if (size > MAX_BYTES) {
        abort();
        throw new TutorError(413, "Keep voice questions under one minute.");
      }
      chunks.push(result.value);
    }
    if (size < 100)
      throw new TutorError(
        400,
        "The recording is too short. Please record your question again.",
      );
    const audio = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }
    return audio;
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const type = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!formats[type])
    return Response.json(
      {
        error: "This recording format is not supported. Try Chrome or Safari.",
      },
      { status: 415, headers },
    );
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return Response.json(
      { error: "Keep voice questions under one minute." },
      { status: 413, headers },
    );
  const key = process.env.ELEVENLABS_API_KEY || process.env.Eleven_labs;
  if (!key)
    return Response.json(
      {
        error:
          "Voice questions are not configured on the server. You can still type your question.",
      },
      { status: 503, headers },
    );
  const now = Date.now();
  if (now - started > 60000) {
    started = now;
    count = 0;
  }
  if (active >= 2 || count >= 10)
    return Response.json(
      {
        error:
          "Voice questions are busy. Please wait a minute or type your question.",
      },
      { status: 429, headers: { ...headers, "Retry-After": "60" } },
    );
  active++;
  count++;
  try {
    const audio = await readAudio(request);
    const form = new FormData();
    form.set("file", new Blob([audio], { type }), `question.${formats[type]}`);
    form.set("model_id", "scribe_v2");
    form.set("language_code", "en");
    form.set("tag_audio_events", "false");
    form.set("diarize", "false");
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(24000),
    ]);
    const response = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: { "xi-api-key": key },
        body: form,
        signal,
        cache: "no-store",
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new TutorError(
        response.status === 429 ? 429 : 502,
        response.status === 429
          ? "Voice transcription is busy. Please wait or type your question."
          : "Voice transcription is unavailable. Please type your question or try again.",
      );
    }
    const result: unknown = JSON.parse(
      await readBoundedBody(response.body, 256000, signal),
    );
    const text =
      result && typeof result === "object" && "text" in result
        ? result.text
        : undefined;
    if (typeof text !== "string" || !text.trim())
      throw new TutorError(
        422,
        "No speech was detected. Please record again or type your question.",
      );
    if (text.trim().length > 600)
      throw new TutorError(
        422,
        "That question is too long. Please record a shorter question or type it.",
      );
    return Response.json({ text: text.trim() }, { headers });
  } catch (error) {
    const failure =
      error instanceof TutorError
        ? error
        : new TutorError(
            502,
            "Voice transcription did not finish. Please try again or type your question.",
          );
    return Response.json(
      { error: failure.message },
      { status: failure.status, headers },
    );
  } finally {
    active--;
  }
}
