"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Step = "request" | "verify";

/**
 * Seconds a user must wait between OTP sends. Matches Supabase's default
 * email send interval (60s) so the button re-enables only once Supabase
 * will actually accept another request — otherwise the resend would hit
 * Supabase's own rate limit (UC1 retry handling).
 */
const RESEND_COOLDOWN_SECONDS = 60;

/** Pulls the "... after N seconds" wait out of Supabase's rate-limit error. */
function secondsFromRateLimit(err: unknown): number | null {
  const message = err instanceof Error ? err.message : "";
  const match = message.match(/after (\d+) second/i);
  return match ? Number(match[1]) : null;
}

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
  const [cooldown, setCooldown] = useState(0);

  // Tick the resend cooldown down to zero, one second at a time.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

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
      setCooldown(RESEND_COOLDOWN_SECONDS);
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

  async function handleResend() {
    if (cooldown > 0 || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;

      await supabase.rpc("log_access_event", {
        p_email: email,
        p_event_type: "otp_requested",
      });

      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success("We sent you a new code.");
    } catch (err) {
      // If Supabase's own rate limit still rejects us, sync our cooldown to
      // the remaining time instead of surfacing a confusing error toast.
      const wait = secondsFromRateLimit(err);
      if (wait) {
        setCooldown(wait);
      } else {
        toast.error(
          err instanceof Error ? err.message : "We couldn't resend the code.",
        );
      }
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
            onClick={handleResend}
            disabled={loading || cooldown > 0}
            className="mt-4 w-full text-sm font-semibold text-acc-blue hover:underline disabled:cursor-not-allowed disabled:font-normal disabled:text-tx-3 disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("request");
              setToken("");
            }}
            className="mt-2 w-full text-sm text-tx-3 hover:text-tx-2"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
