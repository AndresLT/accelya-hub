"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Step = "request" | "verify";

/**
 * OTP login form (UC1). Two steps, following the tested auth flow:
 *   1. is_email_authorized(email)  -> UX pre-check before sending a code.
 *   2. signInWithOtp({ email })    -> the "Before user created" Auth Hook
 *                                     re-validates this server-side.
 *   3. verifyOtp({ email, token }) -> creates the session; a DB trigger
 *                                     links hub_users.id and refreshes
 *                                     last_login_at.
 * Every step is recorded via the log_access_event RPC. User feedback goes
 * through app-wide toasts (sonner); see components/ui/Toaster.tsx.
 */
export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();

    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith("@accelya.com")) {
      toast.error("Use your corporate @accelya.com email address.");
      return;
    }

    setLoading(true);
    try {
      const { data: authorized, error: rpcError } = await supabase.rpc(
        "is_email_authorized",
        { check_email: normalized },
      );
      if (rpcError) throw rpcError;

      if (!authorized) {
        await supabase.rpc("log_access_event", {
          p_email: normalized,
          p_event_type: "login_failed",
        });
        toast.error("This email does not have access to the Hub. Contact HR.");
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalized,
      });
      if (otpError) throw otpError;

      await supabase.rpc("log_access_event", {
        p_email: normalized,
        p_event_type: "otp_requested",
      });

      setEmail(normalized);
      setStep("verify");
      toast.success(`We sent a 6-digit code to ${normalized}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: token.trim(),
        type: "email",
      });

      if (verifyError || !data.user) {
        await supabase.rpc("log_access_event", {
          p_email: email,
          p_event_type: "login_failed",
        });
        throw verifyError ?? new Error("Invalid code.");
      }

      await supabase.rpc("log_access_event", {
        p_email: email,
        p_event_type: "login_success",
        p_user_id: data.user.id,
      });

      toast.success("Signed in successfully.");

      // Soft (client-side) navigation to the Hub. verifyOtp has already
      // resolved, so the auth cookies are written before we navigate;
      // router.refresh() re-runs the Server Components with those cookies.
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Invalid or expired code.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {step === "request" ? (
        <form onSubmit={handleRequestCode}>
          <h1 className="mb-1 text-base font-semibold text-tx-1">Sign in</h1>
          <p className="mb-4 text-sm text-tx-3">
            Enter your corporate email and we&apos;ll send you a one-time code.
          </p>

          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-semibold text-tx-2"
          >
            Corporate email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name.surname@accelya.com"
            className="mb-4 w-full rounded-lg border border-bg-3 bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-acc-blue"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-acc-blue px-4 py-2.5 text-sm font-semibold text-tx-1-c disabled:opacity-50"
          >
            {loading ? "Sending code…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode}>
          <h1 className="mb-1 text-base font-semibold text-tx-1">
            Enter your code
          </h1>
          <p className="mb-4 text-sm text-tx-3">
            Enter the 6-digit code we sent to {email}.
          </p>

          <label
            htmlFor="token"
            className="mb-1.5 block text-sm font-semibold text-tx-2"
          >
            Access code
          </label>
          <input
            id="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="mb-4 w-full rounded-lg border border-bg-3 bg-bg-1 px-3 py-2.5 text-center text-lg tracking-[0.5em] outline-none focus:border-acc-blue"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-acc-teal px-4 py-2.5 text-sm font-semibold text-tx-1-c disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify and sign in"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("request");
              setToken("");
            }}
            className="mt-3 w-full text-sm text-tx-3 hover:text-tx-2"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
