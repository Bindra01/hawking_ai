import { NextResponse } from "next/server";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { createClient } from "@/lib/supabase-server";
import { generateSolution } from "@/lib/generate-solution";
import { acquireSolveSlot } from "@/lib/solve-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_LENGTH = 12_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const slot = await acquireSolveSlot(user.id);
    if (!slot.allowed) {
      return NextResponse.json(
        { error: slot.message },
        { status: slot.status, headers: { "Retry-After": String(slot.retryAfterSeconds) } }
      );
    }

    try {
      const formData = await request.formData();
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
            detail: "high",
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

      const result = await generateSolution(content);
      return NextResponse.json(result);
    } finally {
      await slot.release();
    }
  } catch (error) {
    console.error("Solve generation failed", error);
    return NextResponse.json(
      { error: "Hawking could not generate this solution. Please try again." },
      { status: 500 }
    );
  }
}
