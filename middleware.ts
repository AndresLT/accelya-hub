import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Runs before every request (except the static assets excluded by the
 * matcher below). All auth and session logic lives in `updateSession`
 * so it is applied uniformly to the Hub and to every mini-app route.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except the ones starting with:
     * - _next/static (build assets)
     * - _next/image (image optimization)
     * - favicon.ico
     * - common image/asset file extensions
     * This keeps the auth check off static files for performance.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
