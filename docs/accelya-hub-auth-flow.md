# Accelya Hub — Authentication flow (OTP + 7-day session)

## 1. Flow summary

```
User enters email
        |
        v
Frontend calls is_email_authorized(email)  [Postgres function]
        |
   +----+----+
 false      true
   |          |
   v          v
"Contact    Frontend calls supabase.auth.signInWithOtp({ email })
 HR"            |
                v
        Supabase Auth runs the "Before user created" hook
        (only if the user has never existed in auth.users)
                |
           +----+----+
        rejected   approved
           |           |
           v           v
      403 error    auth.users is created/reused, OTP is sent
                        |
                        v
              User enters the 6-digit code
                        |
                        v
        Frontend calls supabase.auth.verifyOtp({ email, token })
                        |
                        v
         on_auth_user_created / on_auth_user_login triggers
         link hub_users.id = auth.users.id, update last_login_at
                        |
                        v
              Session created -> redirect to the Hub catalog
```

## 2. Supabase Dashboard configuration

### 2.1 Enable passwordless (OTP) login
`Authentication > Providers > Email`
- Keep **Email** enabled.
- Enable **Email OTP** (or "Magic Link" with a code-type template, depending on the dashboard version — both use the same one-time-token mechanism).
- Disable the password requirement — the Hub should never ask for a password.

### 2.2 "Before user created" Auth Hook
`Authentication > Hooks > Before user created`
1. First run the `accelya-hub-auth-hook.sql` script (attached) in the Supabase SQL Editor — creates the `hook_restrict_signup_to_authorized_users` function.
2. In the dashboard, select type **Postgres function** and choose that function.
3. Save. From this point on, Supabase Auth **rejects server-side** any attempt to create a new user whose email is not in `hub_users` with `is_active = true` — even if someone bypasses the frontend and calls the API directly.

### 2.3 Session configuration (7 days) — "lite" client-side control

**Important note:** Supabase's native session controls (`Inactivity timeout`, `Time-box user sessions`) are **Pro plan only** ($25/month) — not available on the free tier from the dashboard. While the project stays on the free tier, the 7-day window is implemented client-side with the `accelya-hub-session-guard.js` module (attached).

**How it works:**
- `hub_users.last_login_at` is already updated automatically on every real login (via the `handle_auth_user_sync` trigger), not on silent token refreshes.
- On every app load, `enforceSevenDaySession(supabase)` is called, comparing `last_login_at` against the current time and signing the user out if more than 7 days have passed.
- Optionally, `startSessionGuardInterval()` repeats this check every hour while the app stays open.

**Accepted trade-off:** this control is evaluated on app load (and on the periodic interval), it is not instant server-side invalidation. A tab left open without reloading for more than 7 days straight would not be signed out until the next load or interval tick. If a fully server-side-proof control is needed in the future, the path is upgrading to Supabase Pro and enabling native `Inactivity timeout` — at that point this module can be removed without changing anything else in the design.

**In the Next.js stack, this logic should live in `middleware.ts`** (running on every request), not as a module imported per page.

### 2.4 OTP email template
`Authentication > Email Templates > Magic Link / Confirm signup`
- **Both** templates must be customized identically — Supabase uses "Confirm signup" for a brand-new email's first login, and "Magic Link" for every login after that.
- Customize the HTML with the defined brand tokens: `#012169` background, white Accelya logo, Open Sans typography, and the OTP code highlighted in `#5CB8B2` or in large text on a white background.
- Make sure the subject line is clear, e.g.: *"Your Accelya Hub access code"*.

## 3. Frontend flow (pseudocode with supabase-js)

```ts
// --- Step 1: request OTP ---
async function requestOtp(email: string) {
  const domainOk = email.endsWith('@accelya.com');
  if (!domainOk) {
    return { error: 'Use your corporate @accelya.com email' };
  }

  const { data: authorized } = await supabase.rpc('is_email_authorized', {
    check_email: email,
  });

  if (!authorized) {
    await supabase.rpc('log_access_event', {
      p_email: email,
      p_event_type: 'login_failed',
    });
    return { error: 'This email does not have access to the Hub. Contact HR.' };
  }

  const { error } = await supabase.auth.signInWithOtp({ email });

  await supabase.rpc('log_access_event', {
    p_email: email,
    p_event_type: 'otp_requested',
  });

  return { error };
}

// --- Step 2: verify the code ---
async function verifyOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (!error && data.user) {
    await supabase.rpc('log_access_event', {
      p_email: email,
      p_event_type: 'login_success',
      p_user_id: data.user.id,
    });
  } else {
    await supabase.rpc('log_access_event', {
      p_email: email,
      p_event_type: 'login_failed',
    });
  }

  return { data, error };
}

// --- Sign out (UC6) ---
async function logout(email: string) {
  await supabase.rpc('log_access_event', {
    p_email: email,
    p_event_type: 'logout',
  });
  await supabase.auth.signOut(); // signs out the current session by default
}
```

**Note on calling `log_access_event` from the client:** technically anyone could call this RPC with fake data (it's `security definer` and exposed to `anon`). Acceptable risk for v1 (it's only an audit log, doesn't affect permissions), but if audit reliability ever needs to be tamper-proof, move these calls to an **Edge Function** that captures the real IP/user-agent server-side instead of trusting the client to report them.

## 4. Retry and OTP expiration handling
- The OTP expires after 24 hours by default in Supabase — it is **recommended to shorten this** (e.g. 10 minutes) in `Authentication > Settings > Auth > OTP expiry` to reduce the window an intercepted code could be misused in.
- Supabase applies built-in rate limiting against brute force on OTP send/verify — no extra logic is required for v1.

## 5. Configuration checklist (run in order)
1. [ ] Run `accelya-hub-schema.sql` in the SQL Editor.
2. [ ] Run `accelya-hub-auth-hook.sql` in the SQL Editor.
3. [ ] Configure the "Before user created" hook in the Dashboard (section 2.2).
4. [ ] Integrate `accelya-hub-session-guard.js` into the bootstrap of every Hub app (section 2.3) — replaces the native `Inactivity timeout`, which requires the Pro plan.
5. [ ] Shorten `OTP expiry` to 600 seconds (10 min) in Auth Settings.
6. [ ] Customize the OTP email template (both "Magic Link" and "Confirm signup") with Accelya branding.
7. [ ] Manually insert the first `hr_admin` user (see the commented seed at the end of `accelya-hub-schema.sql`).
