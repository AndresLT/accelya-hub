# Accelya Internal Apps Hub
## Use Cases and User Stories (v1)

---

## 1. Context and scope

This document defines the functional scope of the **first version of the Hub**: the central portal where employees log in and access internal applications (employment certificates, parking, desk/room booking, etc.). The individual applications themselves are **not** detailed here — only the Hub that will contain them, login, the catalog, and access administration.

**Out of scope for v1:** the internal logic of each individual application (certificates, parking, etc.). Those will be documented one by one as they get prioritized.

---

## 2. Actors

| Actor | Description |
|---|---|
| **Employee** | Any user with a corporate `@accelya.com` email authorized to enter the Hub. |
| **HR Admin** | A member of the HR team with permissions to manage which employees have access to the Hub and to which applications. |
| **System (Hub)** | The platform itself: validates OTP, manages sessions, serves the catalog, enforces permissions. |
| *(Future)* **App Admin** | A role specific to each app (e.g. someone from Facilities administering parking). Not implemented in v1, but the data model should allow for it. |

---

## 3. Use cases (overview)

```
                        +------------------------------+
                        |        ACCELYA HUB            |
                        |                                |
   Employee ----------->|  UC1  Sign in (OTP)            |
                        |  UC2  Keep session (7d)         |
                        |  UC3  View app catalog          |
                        |  UC4  Open an application       |
                        |  UC5  View/edit my profile      |
                        |  UC6  Sign out                  |
                        |                                |
   HR Admin ----------->|  UC7  Manage users              |
                        |  UC8  Assign apps to a user      |
                        |  UC9  View access log            |
                        +------------------------------+
```

---

## 4. Detailed use cases

### UC1 — Sign in via corporate OTP
**Actor:** Employee
**Description:** The user enters their corporate email, the system sends a one-time-use OTP by email, the user enters it and accesses the Hub.
**Precondition:** The email must already exist in the authorized users database (created by HR).
**Main flow:**
1. User enters their email on the login screen.
2. System validates that the email belongs to the corporate domain and is enabled.
3. System generates an OTP (6 digits), sends it by email, with an expiration (e.g. 10 min).
4. User enters the code.
5. System validates it and creates the session.
**Alternate flows:**
- Unauthorized email -> message "contact HR to request access".
- Incorrect OTP -> allow retry (max N attempts).
- Expired OTP -> option to resend.

### UC2 — Keep the session active (7 days)
**Actor:** Employee / System
**Description:** Once authenticated, the user should not have to log in again for 7 days, even after closing the browser.
**Technical notes:** Handled via a Supabase refresh token with expiration configured to 7 days.

### UC3 — View catalog of available applications
**Actor:** Employee
**Description:** Upon entering the Hub, the user sees only the applications they have been granted access to (a "launcher"-style grid of cards/icons).
**Alternate flow:** If the user has no assigned apps, an empty state with an informative message is shown.

### UC4 — Open an application from the Hub
**Actor:** Employee
**Description:** Clicking on an app in the catalog redirects the user to the corresponding application, keeping the session active (internal SSO).

### UC5 — View / edit my profile
**Actor:** Employee
**Description:** View basic data (name, email, job title if applicable) — in v1 this can be read-only.

### UC6 — Sign out
**Actor:** Employee
**Description:** The user can manually sign out from anywhere in the Hub.

### UC7 — Manage users (create, enable, disable)
**Actor:** HR Admin
**Description:** HR adds a new employee's email to grant access, or disables someone who should no longer have it (e.g. they left the company).
**Main flow:**
1. Admin looks up or adds a corporate email.
2. Sets their status (active/inactive).
3. System applies the change immediately (if disabled, any active session is revoked).

### UC8 — Assign applications to a user
**Actor:** HR Admin
**Description:** HR decides which applications each user sees in their catalog (e.g. everyone sees "Certificates", but only certain roles see "Parking").
**Note:** Can be resolved via individual assignment or by groups/roles (recommended for the future, but individual is fine for v1 to keep it simple).

### UC9 — View a basic access log
**Actor:** HR Admin
**Description:** HR can view a simple list of who has logged in and when (basic audit trail, useful for security).
**Note:** Optional for v1, but low-cost to implement with Supabase (log table + trigger).

---

## 5. User stories

### Epic 1: Authentication

**US1.1**
> As an **employee**, I want to **sign in with my corporate email and an OTP code**, so that **I don't have to remember a password**.

*Acceptance criteria:*
- [ ] Given I enter a valid, authorized email, when I request the code, then I receive a 6-digit OTP by email in under 1 minute.
- [ ] Given I enter the correct OTP before it expires, when I confirm it, then I gain access to the Hub.
- [ ] Given I enter an unauthorized email, when I try to sign in, then I see a message telling me to contact HR.
- [ ] Given the OTP has expired, when I try to use it, then the system tells me it expired and offers to resend a new one.

**US1.2**
> As an **employee**, I want **my session to stay active for 7 days**, so that **I don't have to sign in every time I use the Hub**.

*Acceptance criteria:*
- [ ] Given I successfully signed in, when I return to the Hub within the following 7 days, then I am not asked to sign in again.
- [ ] Given more than 7 days have passed since my last login, when I open the Hub, then I am asked to authenticate again.
- [ ] Given an HR admin disables my user, when I try to use the Hub, then my session is invalidated and I'm told to contact HR.

**US1.3**
> As an **employee**, I want to **sign out manually**, so that **I can protect my account if I use a shared computer**.

---

### Epic 2: Application catalog (Hub)

**US2.1**
> As an **employee**, I want to **see a panel with the applications I have access to**, so that **I can quickly get to the tools I need**.

*Acceptance criteria:*
- [ ] I only see the apps HR has assigned to me.
- [ ] Each app is shown as a card with an icon, name, and short description.
- [ ] If I have no assigned apps, I see a friendly message telling me to request access from HR.

**US2.2**
> As an **employee**, I want to **click on an application in the catalog and go straight into it without signing in again**, so that **I have a smooth experience**.

**US2.3**
> As an **employee**, I want **the Hub and all applications to share the same visual style (colors, typography, components)**, so that **it feels like one single platform, not a bunch of loose tools**.

*Acceptance criteria:*
- [ ] A shared style guide (design system) exists: color palette, typography, buttons, cards.
- [ ] The Hub consumes that style guide from a centralized source (e.g. a shared component library or design tokens).

---

### Epic 2.1: Profile

**US2.4**
> As an **employee**, I want to **see my basic information (name, email, job title)** in a profile section, so that **I can confirm my information is correct**.

*Acceptance criteria:*
- [ ] The profile screen is **read-only** in v1 — no editable fields exist.
- [ ] If the employee spots incorrect data, the expected flow is to contact HR (outside the system).

---

### Epic 3: Administration (HR)

**US3.1**
> As an **HR admin**, I want to **add a new employee's email and enable their Hub access**, so that **I can onboard them when they join the company**.

*Acceptance criteria:*
- [ ] I can enter a corporate email and it is set to "active" status.
- [ ] The system validates the email has the correct corporate domain.
- [ ] The employee can sign in immediately after being enabled.

**US3.2**
> As an **HR admin**, I want to **disable an employee's access**, so that **I can revoke it when they leave the company**.

*Acceptance criteria:*
- [ ] When a user is disabled, any active session they have is invalidated immediately.
- [ ] A disabled user cannot request new OTPs.

**US3.3**
> As an **HR admin**, I want to **assign which applications each employee can see**, so that **I can control access based on their role or need**.

*Acceptance criteria:*
- [ ] In each user's profile I see a **dropdown-with-checkboxes** control, listing all applications available in the Hub.
- [ ] I can check/uncheck apps individually for that user.
- [ ] A **"Select all"** option exists that checks/unchecks the entire list at once.
- [ ] The change is saved per user (individual assignment, not group-based in v1).
- [ ] The change is reflected in the user's catalog the next time they load the Hub (does not require re-login).

**US3.4** *(confirmed for v1)*
> As an **HR admin**, I want to **see a simple sign-in history**, so that **I have basic traceability of who uses the Hub**.

*Acceptance criteria:*
- [ ] A view exists listing: user, sign-in date/time, result (success/failure).
- [ ] The list is read-only, sortable by date (most recent first).
- [ ] No export or advanced filters are required in v1 (can be added later).

---

## 6. Non-functional requirements (derived from stated requirements)

| Requirement | Detail |
|---|---|
| **Authentication** | Email OTP (passwordless), managed by Supabase Auth. |
| **Session duration** | 7 days (configured via `refresh_token` expiry in Supabase). |
| **Data security** | Row Level Security (RLS) on all Supabase tables; a user can only read/write what belongs to them. |
| **Granular authorization** | A user only sees the apps they've been assigned (permissions table, not hardcoded). |
| **Visual consistency** | Shared design system (colors, typography, components) reusable across the Hub and every future app. |
| **Technical simplicity** | "Lite" stack: lightweight frontend + Supabase as an all-in-one backend (DB + Auth), no extra custom backend in v1. |
| **Data model scalability** | The data model must allow new apps and new role types (not just HR) to be added without redesigning the schema. |

---

## 7. Design System — brand foundations for the Hub

Extracted from Accelya's official *Brand Style Guide* (03-07-2026). This is the basis for the **design tokens** used across the Hub and every future application.

### 7.1 Colors

**Primary palette**
| Token | Color | HEX |
|---|---|---|
| `acc-blue` | Accelya Blue (main brand color) | `#012169` |
| `acc-blue-l20` | Light blue 20% | `#344D87` |
| `acc-blue-l40` | Light blue 40% | `#4D6396` |
| `acc-blue-d20` | Dark blue 20% | `#011A54` |
| `acc-blue-d40` | Dark blue 40% | `#01143F` |
| `acc-teal` | Accelya Teal (secondary color) | `#5CB8B2` |
| `acc-teal-l20` | Light teal 20% | `#7DC6C1` |
| `acc-teal-l40` | Light teal 40% | `#9DD4D1` |
| `acc-teal-d20` | Dark teal 20% | `#4A9AA3` |
| `acc-teal-d40` | Dark teal 40% | `#377B95` |

**Text palette** (`tx-`) and its contrast counterpart (`tx-*-c`, for use on dark backgrounds):
| Token | HEX | Contrast token | HEX |
|---|---|---|---|
| `tx-1` (primary text) | `#0D1114` | `tx-1-c` | `#FFFFFF` |
| `tx-2` (secondary) | `#425563` | `tx-2-c` | `#CCD3E1` |
| `tx-3` (tertiary) | `#687782` | `tx-3-c` | `#99A6C3` |

**Background palette** (`bg-`) and its contrast counterpart:
| Token | HEX | Contrast token | HEX |
|---|---|---|---|
| `bg-1` | `#FFFFFF` | `bg-1-c` | `#012169` |
| `bg-2` | `#F8F9FB` | `bg-2-c` | `#344D87` |
| `bg-3` | `#EAEEF2` | `bg-3-c` | `#4D6396` |

**Complementary palette** (for charts, tags, categorization — use in order `comp-1` -> `comp-20`): `#012169, #5CB8B2, #4A6DAE, #AFBCCF, #F4DA40, #F4BB38, #F68D2E, #BF4947, #64296E, #8B27AC...` (full list in the original PDF).

### 7.2 Typography
- **Open Sans** -> primary typeface, used for all body copy and general use.
- **Raleway** -> reserved for titles and headings (when implementation allows).
- Available weights: Regular, Semibold, Bold.

### 7.3 Logo and chevron
- Full logo (lowercase `accelya`) as the preferred option whenever there's room.
- Reduced symbol (the "a") for very tight spaces (favicon, avatars).
- Minimum width: 20px digital for the reduced symbol; navy blue on light backgrounds, white on dark/colored backgrounds.
- The **chevron** (`>>`) is the distinctive graphic element — can be used as a decorative background or visual reinforcement, must never interfere with content readability.

### 7.4 Writing standards (apply to the entire Hub UI)
- **Sentence case** in labels, buttons, and headings (e.g. "Reset password", not "Reset Password").
- Formal but approachable tone — no unnecessary technical jargon, no casual language.
- Short, affirmative sentences (avoid negative phrasing where possible).
- Specific, contextual CTAs (e.g. "Request certificate" instead of "OK").
- **Zero dark patterns**: no artificial urgency, no confirmshaming (e.g. cancel links with guilt-tripping language), no misleading pre-checked boxes, no artificial friction on actions like signing out or requesting access removal.

### 7.5 Application to the Hub (concrete proposal)
| UI element | Suggested token |
|---|---|
| Header / navigation bar | `bg-1-c` (`#012169`) with white logo |
| App general background | `bg-2` (`#F8F9FB`) |
| App catalog cards | `bg-1` with a subtle `bg-3` border, icon/accent in `acc-teal` |
| Primary button (e.g. "Request OTP", "Sign in") | `acc-blue` background, `tx-1-c` text |
| Secondary button | `acc-teal` background or `acc-blue` border |
| Primary text | `tx-1` on light backgrounds |
| Error/alert states | Reserve a color from the complementary palette (e.g. `comp-8` `#BF4947`) — the brand guide doesn't define an "official" system red, recommend defining it as a functional extension |
| Decorative chevron | Subtly present on login and on the catalog header, never interfering with content |

### 7.6 Semantic colors (system states)

The brand guide doesn't define semantic colors (success/warning/error/info) on its own — it's a corporate brand guide, not a product design system. To avoid introducing tones outside Accelya's visual identity, these were derived from colors **already present** in the brand's own complementary palette, each given a functional role plus a light-background and text variant (following the same blend-percentage logic the guide already uses for `acc-blue`/`acc-teal` L20/L40/D20/D40 variants).

| State | Base (`sem-*`) | Light background (`sem-*-bg`) | Text on light background (`sem-*-text`) | Source |
|---|---|---|---|---|
| **Success** | `#93B589` | `#F4F8F3` | `#586C52` | `comp-18` from the complementary palette — sage green, consistent with the muted/professional tone of the rest of the brand (no saturated traffic-light green) |
| **Warning** | `#F4BB38` | `#FDF8EB` | `#6E5419` | `comp-6` from the complementary palette |
| **Error** | `#BF4947` | `#F9EDED` | `#85332E` | `comp-8` from the complementary palette |
| **Info** | `#5CB8B2` (`acc-teal`) | `#EEF8F7` | `#377B95` (`acc-teal-d40`, already existing) | Reuses Accelya's own secondary teal — no new color introduced |

Each state has three roles: the base color (icons, borders, solid badges), a very light background (banners/alerts), and a darkened text variant (readable text on that light background). These text/background pairs were calculated approximately following the guide's own blend logic — **verify actual contrast ratios with a real tool (e.g. WebAIM) before finalizing accessibility-certified components.**

---

## 8. Confirmed decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Corporate domain | Single valid domain: `@accelya.com`. |
| 2 | User onboarding | Manual, one by one, done by HR (no bulk upload in v1). |
| 3 | Per-app permissions | **Individual** assignment per user, via a dropdown + checkboxes control, with a "Select all" option. No group/role management in v1. |
| 4 | Audit trail | **Included in v1** (US3.4): simple sign-in history. |
| 5 | Visual identity | Official Accelya brand guide received (03-07-2026) and summarized in section 7 — Design System. |
| 6 | User profile (UC5) | Confirmed **read-only**, no editing in v1. |

### No remaining blockers to start technical design
With the brand guide incorporated, the requirements document (use cases + user stories + design system) is **complete for v1**. The natural next step is technical design: the Supabase data model, RLS policies, and frontend structure.
