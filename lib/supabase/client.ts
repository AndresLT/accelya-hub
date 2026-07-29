import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client for use in the BROWSER (Client Components — files that
 * start with "use client"). It reads/writes the session from cookies that
 * the SSR helpers keep in sync with the server.
 *
 * Use this for interactive flows that must run on the user's device:
 * the OTP login form, sign-out buttons, etc.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
