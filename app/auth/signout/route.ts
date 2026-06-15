import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side sign-out.
 *
 * This is the canonical @supabase/ssr logout pattern and is intentionally a
 * server route rather than a client `supabase.auth.signOut()` call. The client
 * call is unreliable for logout: even with `scope: "local"` it still performs a
 * network request to revoke the session, so it can hang (leaving the user
 * stranded) or return a retryable error WITHOUT clearing the local session
 * (leaving stale auth cookies, which then bounce the user back into the app via
 * middleware). Doing it on the server lets us:
 *   1. Clear the auth cookies on the redirect response unconditionally, so the
 *      browser is guaranteed to be signed out regardless of the remote call.
 *   2. Treat the remote revoke as best-effort with a bounded timeout.
 *
 * Supports GET (simple link navigation) and POST.
 */
async function handleSignOut(request: NextRequest): Promise<NextResponse> {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";

  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Best-effort remote revoke, bounded by a timeout so a slow/hung network call
  // can never block sign-out. The cookie clearing below runs no matter what.
  try {
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // Ignore — cookies are cleared unconditionally below.
  }

  // Guarantee the Supabase auth cookies are cleared even if signOut() did not
  // run to completion (e.g. it timed out before removing the local session).
  // Supabase SSR cookies are prefixed with "sb-".
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleSignOut(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleSignOut(request);
}
