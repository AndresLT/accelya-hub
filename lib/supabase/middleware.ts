import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/** Seven days in milliseconds — the maximum session lifetime (see UC2). */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Route prefixes that are reachable WITHOUT an active session. */
const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Central auth + session guard, run on every matched request (see the
 * matcher in `middleware.ts`). It does three things:
 *
 *   1. Refreshes the Supabase auth cookies so the session stays alive.
 *   2. Redirects unauthenticated users away from protected routes.
 *   3. Enforces the 7-day session window by comparing the server-side
 *      `hub_users.last_login_at` against now (the "lite" replacement for
 *      Supabase's Pro-only Inactivity Timeout — migrated here from the
 *      reference `accelya-hub-session-guard.js`).
 *
 * The DB read is the real backstop only insofar as RLS is: if the row
 * cannot be read (transient error), we FAIL OPEN and let the request
 * through — RLS on every table is what actually protects the data.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token against the Supabase Auth
  // server. Never trust getSession() for authorization in server code.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // --- Unauthenticated users -------------------------------------------
  if (!user) {
    if (isPublicPath(pathname)) {
      return supabaseResponse; // let them reach /login
    }
    return redirectTo(request, supabaseResponse, "/login");
  }

  // --- Authenticated users: enforce the 7-day window -------------------
  const { data: hubUser, error } = await supabase
    .from("hub_users")
    .select("last_login_at, is_active")
    .eq("id", user.id)
    .single();

  // Fail-open on transient read errors (see doc note above).
  if (!error && hubUser) {
    const expired =
      !hubUser.is_active ||
      !hubUser.last_login_at ||
      Date.now() - new Date(hubUser.last_login_at).getTime() > SEVEN_DAYS_MS;

    if (expired) {
      await supabase.auth.signOut();
      return redirectTo(request, supabaseResponse, "/login");
    }
  }

  // A logged-in, valid user has no reason to sit on /login.
  if (isPublicPath(pathname)) {
    return redirectTo(request, supabaseResponse, "/");
  }

  return supabaseResponse;
}

/**
 * Builds a redirect response while preserving any auth cookies Supabase
 * queued on `supabaseResponse` (e.g. the cleared cookies from signOut).
 */
function redirectTo(
  request: NextRequest,
  supabaseResponse: NextResponse,
  path: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}
