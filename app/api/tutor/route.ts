import { generateLesson } from "@/lib/tutor/generate";
import { readBoundedBody, TutorError } from "@/lib/tutor/validate";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_BODY_BYTES = 24_000;
// Prototype budget guard, shared by all anonymous visitors in THIS process only.
// Resets on restart and is not shared across replicas/serverless instances.
// Before public scale, replace with a distributed limiter and a provider spend cap.
let inFlight = 0;
let windowStart = 0;
let requests = 0;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    return Response.json(
      { error: "Request is too large." },
      { status: 413, headers },
    );
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    return Response.json(
      { error: "Use application/json." },
      { status: 415, headers },
    );
  }
  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    requests = 0;
  }
  if (inFlight >= 2 || requests >= 10) {
    return Response.json(
      { error: "The tutor is busy. Please try again in a minute." },
      { status: 429, headers: { ...headers, "Retry-After": "60" } },
    );
  }
  inFlight++;
  requests++;
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
    const body = await readBoundedBody(request.body, MAX_BODY_BYTES, signal);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new TutorError(400, "Send a valid JSON request.");
    }
    const lesson = await generateLesson(parsed, request.signal);
    return Response.json(lesson, { headers });
  } catch (error) {
    if (error instanceof TutorError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers },
      );
    // Never return/log provider bodies, credentials, prompts or stack traces.
    return Response.json(
      { error: "The tutor could not complete this request. Please try again." },
      { status: 500, headers },
    );
  } finally {
    inFlight--;
  }
}
