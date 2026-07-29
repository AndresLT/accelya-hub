import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client for use on the SERVER (Server Components, Route
 * Handlers, and Server Actions). It reads the session from the request
 * cookies so that data fetching runs with the logged-in user's identity
 * and Row Level Security applies automatically.
 *
 * Note: `cookies()` is async in Next.js 15, so this factory is async too.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where cookies
            // are read-only. This is safe to ignore because the
            // middleware is responsible for refreshing session cookies.
          }
        },
      },
    },
  );
}
