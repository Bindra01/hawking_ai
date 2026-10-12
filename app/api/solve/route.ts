import { NextResponse } from "next/server";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { createClient } from "@/lib/supabase-server";
import { generateSolution, isSolveUpstreamOutputError, SolveUpstreamTimeoutError } from "@/lib/generate-solution";
import { acquireSolveSlot, SolveLimitTimeoutError } from "@/lib/solve-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_LENGTH = 12_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const responseDeadlineAt = requestStartedAt + 26_000;
  try {
    const supabase = await withinDeadline(createClient(), responseDeadlineAt);
    const { data: { user } } = await withinDeadline(supabase.auth.getUser(), responseDeadlineAt);
    if (!user) {
      return NextResponse.json(
        { error: "Your session expired. Sign in again to solve this problem.", code: "SESSION_EXPIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const quotaBudgetMs = responseDeadlineAt - Date.now();
    if (quotaBudgetMs <= 0) throw new SolveUpstreamTimeoutError();
    const slot = await withinDeadline(
      acquireSolveSlot(user.id, new Date(), { timeoutMs: quotaBudgetMs }),
      responseDeadlineAt
    );
    if (!slot.allowed) {
      return NextResponse.json(
        { error: slot.message },
        { status: slot.status, headers: { "Retry-After": String(slot.retryAfterSeconds) } }
      );
    }

    try {
      const formData = await withinDeadline(request.formData(), responseDeadlineAt);
      const problemText = String(formData.get("problem") || "").trim();
      const upload = formData.get("file");
      const content: ResponseInputContent[] = [];

      if (problemText.length > MAX_TEXT_LENGTH) {
        return NextResponse.json({ error: "The typed problem must be 12,000 characters or fewer." }, { status: 413 });
      }
      if (problemText) {
        content.push({ type: "input_text", text: `Solve this physics problem:\n\n${problemText}` });
      }

      if (upload instanceof File && upload.size > 0) {
        if (upload.size > MAX_FILE_BYTES) {
          return NextResponse.json({ error: "The file must be 4 MB or smaller." }, { status: 413 });
        }

        const bytes = Buffer.from(await upload.arrayBuffer());
        const base64 = bytes.toString("base64");

        if (IMAGE_TYPES.has(upload.type)) {
          content.push({
            type: "input_image",
            detail: "low",
            image_url: `data:${upload.type};base64,${base64}`,
          });
        } else if (upload.type === "application/pdf" || upload.name.toLowerCase().endsWith(".pdf")) {
          content.push({
            type: "input_file",
            filename: upload.name || "problem.pdf",
            file_data: `data:application/pdf;base64,${base64}`,
            detail: "high",
          });
        } else {
          return NextResponse.json({ error: "Upload a JPG, PNG, WebP, GIF, or PDF file." }, { status: 415 });
        }
      }

      if (content.length === 0) {
        return NextResponse.json({ error: "Type a problem or attach a file." }, { status: 400 });
      }

      const includesImage = content.some((item) => item.type === "input_image");
      const remainingModelMs = responseDeadlineAt - Date.now() - 1_500;
      if (remainingModelMs <= 0) throw new SolveUpstreamTimeoutError();
      const result = await generateSolution(content, {
        timeoutMs: remainingModelMs,
        model: includesImage
          ? (process.env.OPENAI_SOLVE_IMAGE_MODEL || "gpt-4.1-mini")
          : (process.env.OPENAI_SOLVE_MODEL || "gpt-4.1"),
      });
      return NextResponse.json(result);
    } finally {
      await releaseWithinBudget(slot.release());
    }
  } catch (error) {
    console.error("Solve generation failed", { elapsedMs: Date.now() - requestStartedAt, error });
    if (error instanceof SolveUpstreamTimeoutError || error instanceof SolveLimitTimeoutError) {
      return NextResponse.json(
        { error: "Hawking took too long to read this problem. Try a clearer crop or typed text.", code: "SOLVE_UPSTREAM_TIMEOUT" },
        { status: 504, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (isSolveUpstreamOutputError(error)) {
      return NextResponse.json(
        { error: "Hawking could not read a complete solution from the model. Please try again.", code: "SOLVE_UPSTREAM_OUTPUT" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Hawking could not generate this solution. Please try again.", code: "SOLVE_INTERNAL_ERROR" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function withinDeadline<T>(promise: Promise<T>, deadlineAt: number): Promise<T> {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) throw new SolveUpstreamTimeoutError();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new SolveUpstreamTimeoutError()), remainingMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function releaseWithinBudget(release: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = await Promise.race([
      release.then(() => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), 1_000);
      }),
    ]);
    if (timedOut) console.warn("Solve lease release exceeded response budget.");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
