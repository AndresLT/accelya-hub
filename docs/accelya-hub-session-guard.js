/**
 * ACCELYA HUB — 7-day session guard ("lite" version, no Pro plan)
 * =======================================================================
 * Replaces Supabase's native "Inactivity timeout" feature (Pro plan
 * only) with a client-side check.
 *
 * SEMANTICS:
 *   - hub_users.last_login_at is updated ONLY on real logins
 *     (OTP confirmation), not on silent token refreshes.
 *   - If more than 7 days have passed since that login, the session
 *     is signed out and re-authentication is required.
 *
 * KNOWN LIMITATION (accepted trade-off for the MVP):
 *   - This is evaluated when the app loads (and optionally on an
 *     interval while it stays open). A tab left open without
 *     reloading for more than 7 days straight would not be signed out
 *     until the next load/navigation. This is not a fully
 *     server-side-proof control — that requires Supabase's Pro plan
 *     (native Inactivity Timeout).
 *
 * USAGE (in any Hub app, including the Hub itself):
 *
 *   import { enforceSevenDaySession } from './accelya-hub-session-guard.js';
 *
 *   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 *   await enforceSevenDaySession(supabase);
 *   // From here on, if the function didn't force a signOut, the
 *   // session (if any) is still within the 7-day window.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checks the current session against hub_users.last_login_at and signs
 * out if it exceeded the 7-day window. Should be called when any
 * protected page of any Hub app loads.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ expired: boolean, session: object|null }>}
 */
export async function enforceSevenDaySession(supabase) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return { expired: false, session: null }; // no session, nothing to do
  }

  const { data: hubUser, error: hubUserError } = await supabase
    .from('hub_users')
    .select('last_login_at, is_active')
    .eq('id', session.user.id)
    .single();

  // Fail-open on transient network/RLS errors: we don't force a
  // sign-out for a one-off read failure. The real security backstop
  // remains RLS (auth.uid() + is_active), not this guard — this guard
  // only improves the expiration experience.
  if (hubUserError || !hubUser) {
    console.warn('[session-guard] Could not verify last_login_at, skipping this check.', hubUserError);
    return { expired: false, session };
  }

  if (!hubUser.is_active) {
    await supabase.auth.signOut();
    return { expired: true, session: null };
  }

  const lastLogin = new Date(hubUser.last_login_at).getTime();
  const elapsed = Date.now() - lastLogin;

  if (elapsed > SEVEN_DAYS_MS) {
    await supabase.auth.signOut();
    return { expired: true, session: null };
  }

  return { expired: false, session };
}

/**
 * Starts a periodic check while the app stays open (partially
 * mitigates the "tab open for more than 7 days" edge case). Call once
 * per app session (e.g. when the root layout mounts).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {() => void} onExpired - callback to redirect to login
 * @param {number} intervalMs - defaults to every 1 hour
 */
export function startSessionGuardInterval(supabase, onExpired, intervalMs = 60 * 60 * 1000) {
  return setInterval(async () => {
    const { expired } = await enforceSevenDaySession(supabase);
    if (expired) onExpired();
  }, intervalMs);
}
