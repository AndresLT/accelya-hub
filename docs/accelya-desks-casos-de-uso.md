# Accelya Hub — Desk booking (mini-app)
## Use Cases and User Stories (v1)

> Language note: all committed content is in English (Hub master doc,
> section 0). This plans the **desk booking** mini-app, a route inside the
> Hub (`/desks`), reusing its auth, session, design system and app-access
> model. Meeting-room booking (time-slot based) is a separate future app.

---

## 1. Context and scope

A **free desk (hot-desk) booking** app for the office. Employees reserve a
**specific desk** for a day so they know where they'll sit and can choose to
be near their team. There is no cost.

The office is a **single floor** organized into **zones**. Desks are named
`<zone>-<nn>`:

| Zone | Desks | Codes |
|---|---|---|
| A | 8 | A-01 … A-08 |
| B | 8 | B-01 … B-08 |
| C | 8 | C-01 … C-08 |
| D | 6 | D-01 … D-06 |
| **Total** | **30** | |

**In scope (v1):** view desks by zone with status, book / modify / cancel a
specific desk within the window, see who is sitting where, for employees who
have the desk app assigned; plus an admin occupancy view.

**Out of scope (v1):** meeting-room / time-slot booking, an interactive
floor-plan map (see section 7 — planned as a phase 2), fixed/assigned desks,
recurring bookings, check-in.

---

## 2. Actors

| Actor | Description |
|---|---|
| **Employee** | A Hub user with the **desk app assigned** (via `user_app_access`). Only they can reach `/desks`. |
| **System (Desks)** | Enforces the booking window, one-per-day and desk uniqueness. |
| *(Future)* **Facilities Admin** | Manages desks/zones and views occupancy. v1: occupancy view for hr_admin; desk data seeded by developers. |

---

## 3. Business rules

- **BRD1 — One desk per user per day.** A user holds at most one desk per date.
- **BRD2 — Booking window: today and tomorrow** (America/Bogota). A date `D`
  is bookable/editable during `[D-1, D]`. Same rule as parking: on any day
  `T`, the actionable dates are today and tomorrow.
- **BRD3 — A desk is booked by at most one user per day.** Enforced by a
  `unique(desk_id, booking_date)` constraint (naturally race-safe — see §6).
- **BRD4 — Free.** No cost.
- **BRD5 — Cancelling frees the desk immediately** for others.
- **BRD6 — Identities are visible.** Employees see **who** booked each taken
  desk (the point is sitting near your team). Only the display name is shown.
- **BRD7 — Access is gated** by the desk app assignment, enforced server-side.
- Desks are organized by **zone** (A–D) on a single floor.

---

## 4. Detailed use cases

### UCD1 — View desks and who's where
For an actionable day, the user sees every desk grouped by zone, each marked
**Available**, **Taken (by name)**, or **Your desk**.

### UCD2 — Book a desk
The user picks an actionable day and an available desk and books it.
**Main flow:** validate window (BRD2), one-per-day (BRD1) and desk
availability (BRD3), then create the booking.
**Alternate flows:**
- Desk just taken by someone else → refused with a clear message.
- User already has a desk that day → this becomes a **modify** (UCD3).
- Day outside the window → action unavailable.

### UCD3 — Modify (change desk)
Within the window, the user moves to a different available desk; the previous
one is released.

### UCD4 — Cancel
Within the window, the user cancels their desk; it frees immediately (BRD5).
Frictionless, no confirmshaming.

### UCD5 — See my desk
The user sees their current desk for the actionable days at a glance.

### UCD6 — Occupancy (admin)
An hr_admin picks any date and sees utilization per zone and the full list of
who booked which desk (read-only). Mirrors the parking occupancy view.

---

## 5. User stories and acceptance criteria

**USD1.1**
> As an **employee**, I want to **see the desks for today/tomorrow grouped by
> zone, with who's sitting where**, so that **I can pick a good spot near my
> team**.

*Acceptance criteria:*
- [ ] Desks are grouped by zone (A–D) and show Available / Taken (with the
      person's name) / Your desk.
- [ ] I only see today and tomorrow.
- [ ] My own desk is clearly highlighted.

**USD1.2**
> As an **employee**, I want to **book a specific desk**, so that **I know
> exactly where I'll sit**.

*Acceptance criteria:*
- [ ] I can book only for today or tomorrow.
- [ ] Booking an already-taken desk is rejected cleanly.
- [ ] I can't hold two desks the same day; the UI turns a new pick into a move.
- [ ] Two simultaneous bookings of the same desk can never both succeed.

**USD1.3**
> As an **employee**, I want to **change or cancel my desk the day before or
> the same day**, so that **I can adapt and free it for a colleague**.

*Acceptance criteria:*
- [ ] Within the window I can move to another available desk or cancel.
- [ ] Cancelling immediately frees the desk.
- [ ] Outside the window, modify/cancel are unavailable.

**USD1.4** — As an **employee**, I want the desk app to **look and behave like
the rest of the Hub** (design tokens, toasts, loading/error, access-gated).

**USD1.5** — As an **hr_admin**, I want an **occupancy view** (utilization per
zone + who booked which desk on a chosen day), so that **Facilities has
visibility**. Read-only.

---

## 6. Proposed data model and technical considerations

**Tables (new):**

- `desks` — `id` (uuid), `code` (`A-01`…), `zone` (`A`|`B`|`C`|`D`),
  `sort_order` (int), `is_active` (bool), `pos_x`/`pos_y` (numeric, **nullable
  — reserved for the future map**, §7), timestamps. Seeded by developers (30
  rows).
- `desk_bookings` — `id`, `user_email` → `hub_users(email)`, `desk_id` →
  `desks(id)`, `booking_date` (date), timestamps.
  - **`unique(user_email, booking_date)`** → one desk per user per day (BRD1).
  - **`unique(desk_id, booking_date)`** → a desk once per day (BRD3).

**Concurrency (simpler than parking).** Because each desk is a distinct
resource, `unique(desk_id, booking_date)` makes booking naturally race-safe:
two concurrent inserts for the same desk/date → one wins, the other gets a
unique violation ("just taken"). No capacity-counting/locking RPC is needed
(unlike parking's pooled capacity).

**RPCs:**
- `book_desk(p_desk_id, p_date)` (`security definer`): validates access
  (BRD7), window (BRD2) and one-per-day, then inserts — or updates the user's
  existing booking to the new desk (modify). A unique violation on the desk
  surfaces as a friendly "already taken".
- `desk_map(p_date)` (`security definer`): returns every desk with `zone`,
  `code`, `sort_order`, its status, the **booker's display name** if taken,
  and an `is_mine` flag computed from `auth.uid()`. This is how identities are
  shown (BRD6) without exposing the whole `hub_users` table to employees, and
  `is_mine` avoids the "hr_admin sees all" footgun.
- Cancel: a `cancel_desk(p_date)` RPC (or an RLS delete filtered explicitly by
  the caller's email + window). **Note:** never rely on RLS alone for the
  user's own-data — an hr_admin's RLS is broad (this pattern already caused
  three bugs in the catalog/parking).

**RLS:** desks readable by authenticated; `desk_bookings` writes only via the
RPCs / own rows; hr_admin manages all. Timezone `America/Bogota`; any day is
bookable (weekends/holidays included).

---

## 7. UI / UX — the "map" question

Route `/desks` in the Hub shell (header, toasts, loading/error). The core
question is **how the user picks a desk**. Three approaches, from simplest to
richest:

### Option A — Zone grid (recommended for v1)
Desks rendered as tiles, **grouped in labeled zone blocks (A–D)**, colored by
status; you click a tile to book. It *looks* spatial (zones as blocks, desks
as tiles) and needs **no external assets**. Fully responsive and accessible.
This is essentially "select on a schematic layout" and ships now.

### Option B — Static floor plan + list
Show a floor-plan **image** for orientation next to the interactive zone grid.
The image is just a picture (not clickable); selection still happens on the
grid. Needs a floor-plan image but little engineering.

### Option C — Interactive floor plan (phase 2)
A real floor plan with **clickable desk markers at their true positions**.
Best UX, but the heavier one — see the technical challenge below.

**Technical challenge of the interactive map (Option C):**
- **Asset:** a floor plan, ideally **SVG** (scales cleanly) or a PNG.
- **Coordinates:** each desk needs an `(x, y)` position on the plan — a
  one-time authoring task (and re-authored when the office changes). Stored in
  `desks.pos_x/pos_y` (already reserved above).
- **Rendering:** an SVG with the plan as background and a marker per desk
  (colored by status, click to book, tooltip with the name). SVG `viewBox`
  handles responsive scaling so markers stay aligned at any size.
- **Accessibility:** a pure map is hard for keyboard/screen readers, so a
  **list view must remain** as an equal alternative.

**Recommendation:** ship **Option A (zone grid)** for v1 — it delivers the
full booking experience, looks map-like, and needs nothing from Facilities.
Because we reserve `pos_x/pos_y` on `desks` now, upgrading to **Option C** later
is **additive** (add the plan + coordinates + an SVG view), not a rewrite. If/
when Facilities provides a real floor plan, we do phase 2.

---

## 8. Open decisions to confirm

1. **Map approach for v1** — go with Option A (zone grid), keeping the real
   floor-plan map as a documented phase 2? *(recommended)*
2. **Desk seed** — 30 desks (A/B/C ×8, D ×6) as above; any per-desk labels
   beyond the code (e.g. "window", "standing")? *(v1: just the code)*
3. Anything zone-specific (e.g. a zone reserved for a team)? *(v1: all open)*

---

## 9. Out of scope for v1 (candidates for later)

- Interactive floor-plan map (Option C) — phase 2.
- Meeting-room / time-slot booking (separate app).
- Fixed/assigned desks, recurring bookings, desk check-in.
- Self-service desk/zone management UI for Facilities.
