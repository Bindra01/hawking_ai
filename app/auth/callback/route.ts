import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";
import {
  authNextFromCookie,
  publicRequestOrigin,
  safeNextPath,
} from "@/lib/auth-redirect";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const origin = publicRequestOrigin(
    req.url,
    process.env.AUTH_REDIRECT_ORIGIN
  );
  const code = searchParams.get("code");
  const requestedNext =
    searchParams.get("next") ??
    authNextFromCookie(req.cookies.get("hawking-auth-next")?.value);
  const next = safeNextPath(requestedNext, origin);

  const redirectUrl = new URL(next, origin).toString();

  if (code) {
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("hawking-auth-next", "", {
      path: "/auth/callback",
      maxAge: 0,
    });

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

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set("hawking-auth-next", "", {
    path: "/auth/callback",
    maxAge: 0,
  });
  return response;
}
