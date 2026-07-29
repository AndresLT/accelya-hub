"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Manual sign-out (UC6). Zero dark patterns: a plain, low-friction
 * button — no confirmation dialog. Records a `logout` audit event, then
 * clears the session and returns to /login.
 */
export function SignOutButton({ email }: { email: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    if (email) {
      await supabase.rpc("log_access_event", {
        p_email: email,
        p_event_type: "logout",
      });
    }
    await supabase.auth.signOut();
    toast.success("You have been signed out.");
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="rounded-lg border border-bg-3-c px-3 py-1.5 text-sm font-semibold text-tx-1-c hover:bg-acc-blue-l20 disabled:opacity-50"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
