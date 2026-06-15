import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth routes own their flow and must never be gated by Supabase here:
  //   - /auth/signout must clear cookies even if Supabase auth is slow/hung;
  //     gating it behind getUser() would reintroduce the exact hang the server
  //     signout route exists to avoid.
  //   - /auth/callback performs its own code-for-session exchange.
  // Bypass BEFORE calling getUser() so these always run promptly.
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token — this is critical for server-side auth to work
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route protection: send unauthenticated users to /login for any protected
  // route. Without this, a logged-out user (e.g. just after signing out) lands
  // on /home or /profile, which swallow 401s and render empty states with no
  // way to log back in. (/auth/* is already bypassed above.)
  // API routes self-gate and return proper 401 JSON; never redirect them to a
  // page (that would turn a fetch's 401 into a 302 to HTML).
  const isApi = pathname.startsWith("/api/");
  const isPublicPath = pathname === "/login";

  if (!user && !isApi && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return redirectPreservingCookies(loginUrl, supabaseResponse);
  }

  // If an authenticated user hits /login, send them into the app.
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/home";
    homeUrl.search = "";
    return redirectPreservingCookies(homeUrl, supabaseResponse);
  }

  return supabaseResponse;
}

/**
 * Build a redirect response that preserves any auth cookies Supabase wrote to
 * `supabaseResponse` during `getUser()` (which may rotate/refresh the session).
 * Returning a bare `NextResponse.redirect()` would drop those `Set-Cookie`
 * headers and can intermittently log the user out — a documented @supabase/ssr
 * gotcha.
 */
function redirectPreservingCookies(
  url: URL,
  supabaseResponse: NextResponse
): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of supabaseResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
