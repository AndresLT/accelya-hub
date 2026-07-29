# Accelya Hub — Project Context (to resume in VS Code / Claude Code)

> This document consolidates all decisions, design, and current status of the project, defined in a prior planning session. Use it as initial context when starting the build phase in Claude Code.

---

## 0. Language convention (IMPORTANT — applies to all development work)

**All content produced for this project — code, comments, variable/function names, UI copy, commit messages, and technical documentation living in the repo — must be written in English.**

Conversation with the product owner (in chat, with Claude/Claude Code) happens in Spanish, but nothing user-facing or committed to the codebase should be in Spanish. This includes: page copy, button labels, error messages, email templates sent to employees, SQL comments, and markdown docs kept in the repo.

---

## 1. What the project is

An **internal applications hub** for Accelya: a portal where employees log in once and access a catalog of lightweight internal mini-apps (employment certificates, parking spot booking, desk/meeting room booking, etc.). Includes an admin panel for HR to manage access.

**Most recent, important architecture decision:** the project was originally planned as a Hub linking out to applications on separate domains/projects. This was changed: all future mini-apps will live as **routes within the same Next.js project** (a routes-monorepo), not as independent applications. Reasons: session is automatically shared across all routes (no cross-domain SSO needed), a single deployment, and a design system that stays consistent by construction. The apps are lightweight, so this approach fits.

---

## 2. Chosen technical stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router)** | Automatic per-route code-splitting, `middleware.ts` centralizes auth for all routes/mini-apps, first-class official integration with Supabase (`@supabase/ssr`), larger ecosystem as the team grows |
| Backend / DB / Auth | **Supabase** (already provisioned and configured, see section 4) | Postgres + Auth + RLS all-in-one, explicit project requirement |
| Email delivery (OTP) | **Gmail SMTP** (temporary, see section 5) — migrate to **Resend + Accelya's own domain** once DNS access is available | — |
| Suggested hosting | Vercel (free for this project size) | Same creators as Next.js, "out of the box" fit |

Angular was evaluated as an alternative and ruled out: steeper learning curve, no official Supabase integration, and the session guard would need to be applied manually route by route instead of being centralized once.

---

## 3. Proposed route structure (Next.js App Router)

```
/app
  /login                       ← UC1: OTP login
  /(hub)
    /page.tsx                  ← UC3/UC4: app catalog
    /profile                   ← UC5: profile (read-only)
  /employment-certificates     ← future app #1 (example already seeded in DB)
  /parking                     ← future app #2
  /desks-and-rooms             ← future app #3
  /admin                       ← UC7/UC8/UC9: HR admin panel
  /middleware.ts                ← auth guard + 7-day session guard, for ALL routes
```

`apps.launch_url` in the database now stores **relative paths** (e.g. `/employment-certificates`), not external URLs. The example app record has been fully renamed to English (`key: employment-certificates`, `name: Employment certificates`, `launch_url: /employment-certificates`) to stay consistent with the project's language convention (section 0).

---

## 4. Supabase — already provisioned project

| Field | Value |
|---|---|
| Project name | Accelya HUB |
| Project ref / ID | `yinzausstaqfgamazqnw` |
| URL | `https://yinzausstaqfgamazqnw.supabase.co` |
| Region | us-east-2 |
| Postgres | v17.6.1 |
| Anon / publishable key | `sb_publishable_bnALm87kUmvO-2g034jtzA_5BtoY9EG` (public, safe to expose in frontend) |

**The full schema is already applied in production.** Reference files attached to this context:
- `accelya-hub-schema.sql` — full schema (tables, RLS, triggers, functions)
- `accelya-hub-auth-hook.sql` — "Before user created" Auth Hook

### Data model (summary)

- **`hub_users`** — single source-of-truth users table. PK = `email` (with a `check` constraint on the `@accelya.com` domain). The `id` column is `NULL` until the first successful login, then it's linked 1:1 to `auth.users.id` via a trigger. Columns: `email, id, full_name, position, role ('employee'|'hr_admin'), is_active, last_login_at, created_by, created_at, updated_at`.
- **`apps`** — catalog of mini-apps. Columns: `id, key, name, description, icon, launch_url (relative path), is_active, created_at, updated_at`.
- **`user_app_access`** — individual user↔app assignment (N:N). Columns: `id, user_email, app_id, granted_by, granted_at`.
- **`access_logs`** — login audit trail. Columns: `id, email, event_type ('otp_requested'|'login_success'|'login_failed'|'logout'), user_id, metadata, created_at`.

### Available functions/RPCs (callable from the client)
- `is_email_authorized(check_email text) returns boolean` — validate before requesting an OTP.
- `log_access_event(p_email, p_event_type, p_user_id, p_metadata) returns void` — record audit events.
- `is_hr_admin() returns boolean` — used internally by RLS, also callable from the client to check the current user's role.

### RLS — summary of active rules
- `hub_users`: user sees their own row (`id = auth.uid()`); HR sees/manages all rows.
- `apps`: any authenticated user sees active apps; HR manages the catalog.
- `user_app_access`: user sees only their own assignments; HR sees/manages all.
- `access_logs`: read-only for HR; writes only via `log_access_event()`.

### Admin user already created (for testing)
- `andres.lozano@accelya.com` — role `hr_admin`, active. Already has the example app `employment-certificates` assigned.

### Auth Hook (already configured in the dashboard)
`Authentication > Hooks > Before user created` → points to the `hook_restrict_signup_to_authorized_users` function — rejects, server-side, any login attempt from an email not authorized in `hub_users`, even if someone bypasses the frontend.

---

## 5. Authentication flow (already implemented and tested end-to-end)

Fully documented in `accelya-hub-auth-flow.md`. Summary:

1. Frontend calls `is_email_authorized(email)` before requesting the OTP (UX layer).
2. `supabase.auth.signInWithOtp({ email })` — the Auth Hook validates again server-side.
3. User enters the 6-digit code → `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
4. The database trigger links `hub_users.id` to `auth.users.id` and updates `last_login_at`.

**Email delivery status:** configured with **Gmail SMTP** as a temporary solution (~500 emails/day, ~20/hour limit — enough for MVP/testing, not for a company-wide rollout). Migrate to Resend + a verified Accelya domain (`accelya.com` or a subdomain like `notifications.accelya.com`) once DNS access is available — a Resend account is already connected with an API key created (saved by the user), ready to resume that migration.

**Email templates already customized with Accelya branding:**
- `Authentication > Email Templates > Magic Link` — edited.
- `Authentication > Email Templates > Confirm signup` — edited (Supabase uses this template, not "Magic Link", on the *first* login of any new email — both must be kept identical).
- Reference HTML: `accelya-hub-otp-email-template.html`.

---

## 6. 7-day session control — important decision

Supabase's native session controls (`Inactivity timeout`, `Time-box user sessions`) are **Pro plan only** ($25/month) — the project is on the free tier. A "lite" client-side alternative was implemented instead:

- Reference module: `accelya-hub-session-guard.js` (vanilla JS, framework-agnostic).
- **In the new Next.js stack, this logic must be migrated into `middleware.ts`** (running on every request, not as a module imported per page) — this is the pending adjustment mentioned in section 2.
- Logic: compare `hub_users.last_login_at` (updated only on real logins, not on silent token refreshes) against `now()`; if more than 7 days have passed, sign the user out and redirect to `/login`.
- Consciously accepted trade-off: this is not instant server-side invalidation, it's evaluated on each page load/request. Acceptable for an internal Hub under normal usage.
- Future upgrade path: move to Supabase Pro and enable native `Inactivity timeout`; this module can then be removed without changing the rest of the design.

---

## 7. Design System — brand tokens (Accelya Brand Style Guide, 03-07-2026)

### Colors
| Token | HEX | Usage |
|---|---|---|
| `acc-blue` | `#012169` | Primary brand color — headers, primary buttons |
| `acc-blue-l20/l40`, `acc-blue-d20/d40` | see guide | light/dark variants |
| `acc-teal` | `#5CB8B2` | Secondary color — accents, secondary buttons |
| `tx-1` / `tx-1-c` | `#0D1114` / `#FFFFFF` | Primary text (normal / on dark background) |
| `tx-2` / `tx-2-c` | `#425563` / `#CCD3E1` | Secondary text |
| `tx-3` / `tx-3-c` | `#687782` / `#99A6C3` | Tertiary text |
| `bg-1` / `bg-1-c` | `#FFFFFF` / `#012169` | Base background |
| `bg-2` / `bg-2-c` | `#F8F9FB` / `#344D87` | Secondary background |
| `bg-3` / `bg-3-c` | `#EAEEF2` / `#4D6396` | Tertiary background / borders |
| `comp-1..20` | see guide | Complementary palette for charts/tags, use in order |

### Typography
- **Open Sans** — primary typeface (body copy and general use).
- **Raleway** — reserved for titles/headings.

### Brand elements
- Logo: the word `accelya` in lowercase; reduced symbol (the "a") for very tight spaces.
- The **chevron** (`>>`) is the distinctive graphic element — decorative/structural, must never interfere with readability.

### Writing standards (apply to all UI copy)
- Sentence case for labels, buttons, headings.
- Formal but approachable tone, no unnecessary jargon.
- Specific, contextual CTAs (e.g. "Request certificate", not "OK").
- **Zero dark patterns**: no artificial urgency, no confirmshaming, no friction on actions like signing out.

### Semantic colors (system states)
| State | Base | Light background | Text on light bg | Source |
|---|---|---|---|---|
| Success | `#93B589` | `#F4F8F3` | `#586C52` | `comp-18` |
| Warning | `#F4BB38` | `#FDF8EB` | `#6E5419` | `comp-6` |
| Error | `#BF4947` | `#F9EDED` | `#85332E` | `comp-8` |
| Info | `#5CB8B2` (`acc-teal`) | `#EEF8F7` | `#377B95` | reuses `acc-teal` |

Derived from colors already present in Accelya's own complementary palette (no new hues introduced) — see `accelya-hub-casos-de-uso.md` section 7.6 for the full rationale. Verify actual contrast ratios with a real tool before finalizing accessibility-certified components.

### Resolved
The brand guide didn't define semantic system colors on its own — this has already been resolved (see table above), so it's no longer a pending item.

---

## 8. Use cases and user stories

Full document: `accelya-hub-casos-de-uso.md`. v1 scope summary:

- **UC1** Corporate OTP login (`@accelya.com` domain only)
- **UC2** 7-day session (see section 6)
- **UC3** View catalog of assigned apps
- **UC4** Open an app without re-authenticating (with the new route-based architecture, this is automatic)
- **UC5** View profile — **read-only**, no editing in v1
- **UC6** Manually sign out
- **UC7** HR manages users (manual, one-by-one onboarding, no bulk upload in v1)
- **UC8** HR assigns apps per user — **individual** assignment, dropdown + checkboxes control with a "Select all" option (no group/role management in v1)
- **UC9** HR views a simple access audit log (included in v1)

---

## 9. Reference files attached to this context

| File | Content |
|---|---|
| `accelya-hub-casos-de-uso.md` | Use cases, user stories, acceptance criteria, detailed design system |
| `accelya-hub-schema.sql` | Full SQL schema (already applied in Supabase) |
| `accelya-hub-auth-hook.sql` | Signup restriction Auth Hook (already applied) |
| `accelya-hub-auth-flow.md` | Detailed authentication flow + configuration checklist |
| `accelya-hub-otp-email-template.html` | OTP email template with Accelya branding |
| `accelya-hub-session-guard.js` | Reference module for the 7-day session guard (to be migrated into `middleware.ts`) |

All reference files listed above have been translated to English to stay consistent with the language convention in section 0.

---

## 10. Immediate next step

Generate the Next.js project scaffold (App Router + TypeScript) and integrate:
1. `@supabase/ssr` with the credentials from section 4.
2. `middleware.ts` with: (a) active session verification, (b) the 7-day guard (logic from `accelya-hub-session-guard.js` adapted to middleware).
3. `/login` route with the OTP flow from section 5.
4. `/(hub)` route with the catalog, querying `apps` + `user_app_access` via RLS.
5. Design tokens from section 7 as the base for Tailwind/CSS variables.

**Secrets that are NOT in this document** (for security — must never be committed to git): the Gmail App Password used in Supabase's SMTP config, and the Resend API key. Both are already configured where needed (Supabase SMTP settings, and saved by the user, respectively) and should go into environment variables (`.env.local`, excluded from git) if the frontend code ever needs them directly — which it shouldn't, since they live on the Supabase side, not the frontend.
