import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  const redirectUrl = `${origin}/home`;

  if (code) {
    const response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // Record the student in our database at login so we always have a reliable
    // record of their email and most recent login. Upsert keeps the row in sync
    // (name/avatar may change) and stamps last_login on every sign-in. A failure
    // here must not block the user from getting into the app, so we swallow it.
    const user = data?.user;
    if (!error && user?.email) {
      try {
        const name = user.user_metadata?.full_name ?? null;
        const avatar_url = user.user_metadata?.avatar_url ?? null;
        const now = new Date();
        await prisma.users.upsert({
          where: { email: user.email },
          create: { email: user.email, name, avatar_url, last_login: now },
          update: { name, avatar_url, last_login: now },
        });
      } catch (e) {
        console.error("Failed to record user login:", e);
      }
    }

    return response;
  }

  return NextResponse.redirect(redirectUrl);
}
