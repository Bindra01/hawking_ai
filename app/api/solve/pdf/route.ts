import { createClient } from "@/lib/supabase-server";
import { renderSolutionPdf } from "@/lib/solution-pdf";
import type { SolveFormat, SolveSolution } from "@/lib/solve-types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { solution?: SolveSolution; format?: SolveFormat };
  if (!body.solution || !["short", "long"].includes(body.format || "")) {
    return Response.json({ error: "Invalid PDF request." }, { status: 400 });
  }

  const pdf = await renderSolutionPdf(body.solution, body.format as SolveFormat);
  const filename = body.solution.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}-${body.format}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
