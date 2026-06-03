import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { VALID_STATUSES } from "@/lib/constants";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user.email ?? undefined)) {
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { status } = body;

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const problem = await prisma.problems.findUnique({ where: { id } });
    if (!problem) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    const updated = await prisma.problems.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Status update error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
