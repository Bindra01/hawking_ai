import { readBoundedBody, TutorError } from "@/lib/tutor/validate";

export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "no-store" };
// Anonymous prototype guard: process-local, not a distributed spending limit.
let inFlight = 0;
let windowStart = 0;
let requests = 0;
let characters = 0;

export async function POST(request: Request) {
  let acquired = false;
  try {
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > 24_000))
      throw new TutorError(413, "Narration request is too large.");
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    )
      throw new TutorError(415, "Use application/json.");
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(25_000),
    ]);
    const raw = await readBoundedBody(
      request.body,
      24_000,
      AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
    );
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new TutorError(400, "Send valid narration text.");
    }
    if (
      !input ||
      typeof input.text !== "string" ||
      !input.text.trim() ||
      input.text.length > 12_000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.text)
    )
      throw new TutorError(400, "Narration must contain 1–12000 characters.");
    const key = process.env.ELEVENLABS_API_KEY || process.env.Eleven_labs;
    if (!key)
      throw new TutorError(
        503,
        "Narration is not configured. You can still read the lesson.",
      );
    if (Date.now() - windowStart >= 60_000) {
      windowStart = Date.now();
      requests = 0;
      characters = 0;
    }
    if (
      inFlight >= 3 ||
      requests >= 90 ||
      characters + input.text.length > 12_000
    )
      throw new TutorError(
        429,
        "Narration is busy. Please try again in a minute.",
      );
    inFlight++;
    requests++;
    characters += input.text.length;
    acquired = true;
    const voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input.text,
          model_id: process.env.ELEVENLABS_TTS_MODEL || "eleven_flash_v2_5",
        }),
        signal,
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new TutorError(
        response.status === 429 ? 429 : 502,
        "Narration is unavailable. Please try again shortly.",
      );
    }
    const data = JSON.parse(
      await readBoundedBody(response.body, 16_000_000, signal),
    );
    const alignment = data.alignment;
    if (
      typeof data.audio_base64 !== "string" ||
      !data.audio_base64.length ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(data.audio_base64) ||
      !alignment ||
      !Array.isArray(alignment.characters) ||
      !alignment.characters.length ||
      alignment.characters.length > 20_000 ||
      !alignment.characters.every(
        (value: unknown) => typeof value === "string",
      ) ||
      ![
        alignment.character_start_times_seconds,
        alignment.character_end_times_seconds,
      ].every(
        (times) =>
          Array.isArray(times) &&
          times.length === alignment.characters.length &&
          times.every(
            (value: unknown, index: number) =>
              typeof value === "number" &&
              Number.isFinite(value) &&
              value >= 0 &&
              value <= 600 &&
              (!index || value >= times[index - 1]),
          ),
      )
    )
      throw new TutorError(
        502,
        "Narration returned invalid audio. Please try again.",
      );
    if (
      alignment.character_start_times_seconds.some(
        (start: number, index: number) =>
          start > alignment.character_end_times_seconds[index],
      )
    )
      throw new TutorError(
        502,
        "Narration returned invalid timing. Please try again.",
      );
    return Response.json(
      { audio_base64: data.audio_base64, alignment },
      { headers },
    );
  } catch (error) {
    const status = error instanceof TutorError ? error.status : 502;
    return Response.json(
      {
        error:
          error instanceof TutorError
            ? error.message
            : "Narration could not finish. Please try again.",
      },
      {
        status,
        headers: {
          ...headers,
          ...(status === 429 ? { "Retry-After": "60" } : {}),
        },
      },
    );
  } finally {
    if (acquired) inFlight--;
  }
}
