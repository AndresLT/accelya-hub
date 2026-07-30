# Accelya Hub — Parking booking (mini-app)
## Use Cases and User Stories (v1)

> Language note: like the rest of the project, all committed content is in
> English (see the Hub master doc, section 0). This document plans the
> **parking** mini-app that lives as a route inside the Hub
> (`/parking`), reusing its auth, session, design system and app-access model.

---

## 1. Context and scope

A **free office parking booking** mini-app. Employees reserve a spot for a
given day so they arrive knowing their space is secured; unused capacity can
still be grabbed the same day when someone cancels. There is **no cost** and
**no payment** — it is purely a reservation system.

Parking capacity is split by vehicle type, and **cars and motorcycles share
the same physical area**. Proposed capacities (to confirm — section 8):

| Vehicle type | Capacity (spots/day) |
|---|---|
| Car / Motorcycle (shared) | 7 |
| Bicycle | 10 |
| Electric scooter | 10 |

**In scope (v1):** view availability, book, modify and cancel a booking
within the allowed window, for employees who have the parking app assigned.

**Out of scope (v1):** payments, assigned/numbered fixed spots, waitlists,
recurring bookings, reporting dashboards, and self-service capacity
management (see sections 8–9).

---

## 2. Actors

| Actor | Description |
|---|---|
| **Employee** | A Hub user who has the **parking app assigned** (via the existing `user_app_access`). Only they can reach `/parking`. |
| **System (Parking)** | Enforces the booking window, the one-per-day rule and per-type capacity. |
| *(Future)* **Parking Admin** | Someone from Facilities who manages capacities and views occupancy. Not in v1, but the data model should allow it. |

---

## 3. Business rules (the heart of v1)

- **BR1 — One booking per day, per user.** For any given calendar date a
  user can hold at most one booking (one vehicle type / one spot).
- **BR2 — Booking window: the day before and the day itself.** A date `D`
  becomes bookable on `D-1` and stays editable through `D`. Outside the
  window `[D-1, D]` (office-local time) no create/modify/cancel is allowed.
  - Consequence: on any given day `T`, the actionable dates are **today
    (`T`)** and **tomorrow (`T+1`)**. A user may hold a booking for today
    *and* one for tomorrow at the same time (they are different days).
  - Rationale (from the product owner): a day ahead people know their spot
    is secured and unavailable to others; same-day stays open so freed
    capacity (cancellations) can be re-booked.
- **BR3 — Capacity per vehicle type, per day.** Car/Motorcycle = 7,
  Bicycle = 10, Electric scooter = 10 (configurable; section 8). A booking
  succeeds only if the chosen type still has free capacity for that date.
- **BR4 — Cars and motorcycles share one pool** of 7.
- **BR5 — Cancelling frees the slot immediately** so another employee can
  take it the same day.
- **BR6 — Free.** No cost, no payment step.
- **BR7 — Access is gated.** Only employees with the parking app assigned
  can view or book. Enforced server-side, not only by hiding the catalog card.

---

## 4. Detailed use cases

### UCP1 — View availability
**Actor:** Employee
**Description:** For each actionable day (today / tomorrow), the user sees,
per vehicle type, how many spots are free vs taken, and whether they already
hold a booking that day.
**Alternate flow:** A type with zero free capacity is shown as **Full**.

### UCP2 — Book a spot
**Actor:** Employee
**Description:** The user picks an actionable day and a vehicle type and
books a spot.
**Main flow:**
1. User selects day (today or tomorrow) and vehicle type.
2. System checks the window (BR2), the one-per-day rule (BR1) and capacity
   (BR3) **atomically**, then creates the booking.
3. User sees confirmation that their spot is secured.
**Alternate flows:**
- The type is Full → booking is refused with a clear message.
- The user already has a booking that day → offered to **modify** instead
  (UCP3) rather than create a second one.
- The day is outside the window → action unavailable.

### UCP3 — Modify a booking
**Actor:** Employee
**Description:** Within the window, the user changes the vehicle type of an
existing booking (e.g. booked a car spot, now coming by bike).
**Main flow:** the change is applied only if the new type has free capacity;
the previously held slot is released.

### UCP4 — Cancel a booking
**Actor:** Employee
**Description:** Within the window, the user cancels their booking; the slot
is freed immediately for others (BR5). Zero-friction, no confirmshaming
(consistent with the Hub's writing standards).

### UCP5 — View my bookings
**Actor:** Employee
**Description:** The user sees their current booking(s) for the actionable
days at a glance (day, vehicle type, status).

### UCP6 *(future)* — Manage capacities
**Actor:** Parking Admin
**Description:** Adjust the per-type capacity numbers without a code change.
Not in v1 (capacities are seeded by developers), but the model should not
hard-code them so this can be added later.

---

## 5. User stories and acceptance criteria

### Epic P1 — Booking

**USP1.1**
> As an **employee**, I want to **see how many parking spots are free by
> vehicle type for today and tomorrow**, so that **I know if I can park**.

*Acceptance criteria:*
- [ ] I see today and tomorrow, each split into Car/Motorcycle, Bicycle and
      Electric scooter with free/total counts.
- [ ] A type with no free capacity shows as **Full**.
- [ ] If I already have a booking that day, it is clearly highlighted.

**USP1.2**
> As an **employee**, I want to **book one spot for a day**, so that **my
> parking space is guaranteed**.

*Acceptance criteria:*
- [ ] I can book only for today or tomorrow (the open window).
- [ ] The booking is rejected if the chosen type is already Full.
- [ ] I cannot hold two bookings for the same day; the UI offers to modify
      the existing one instead.
- [ ] Two simultaneous requests for the last free spot can never both
      succeed (no overbooking).

**USP1.3**
> As an **employee**, I want to **change or cancel my booking the day before
> or the same day**, so that **I can adapt if my plans change and free the
> spot for someone else**.

*Acceptance criteria:*
- [ ] Within the window I can switch vehicle type (subject to capacity) or
      cancel.
- [ ] Cancelling immediately increases the free count for that type/day.
- [ ] Outside the window, modify/cancel are unavailable.

**USP1.4**
> As an **employee**, I want the parking app to **look and behave like the
> rest of the Hub**, so that **it feels like one platform**.

*Acceptance criteria:*
- [ ] Uses the Hub design tokens, toasts and loading/error patterns.
- [ ] Only reachable by employees with the parking app assigned; others are
      sent back to the Hub.

### Epic P2 *(future)* — Administration
**USP2.1** *(future)* — As a **Parking Admin**, I want to adjust capacities
and see occupancy, so that I can manage the parking operationally.

---

## 6. Proposed data model and technical considerations

> This is a proposal for the technical-design step; final DDL is written when
> we build. All tables get RLS, consistent with the Hub.

**Tables (new, `public` schema):**

- `parking_vehicle_types` — configuration of the pools.
  `key` (`car_moto` | `bicycle` | `scooter`), `label`, `capacity` (int),
  `is_active`. Seeded by developers (v1); editable later (UCP6).
- `parking_bookings` — one row per reservation.
  `id`, `user_email` → `hub_users(email)`, `booking_date` (date),
  `vehicle_type` → `parking_vehicle_types(key)`, `created_at`, `updated_at`.
  - **`unique (user_email, booking_date)`** enforces BR1 (one per day).

**Capacity enforcement + concurrency (the hard part):**
Per-type capacity is a *count* per `(booking_date, vehicle_type)`, which a
simple `UNIQUE` constraint can't express. A naive "count then insert" can
overbook under concurrent requests (USP1.2). Recommended approach: a
**`security definer` RPC** (e.g. `book_parking(p_date, p_type)`) that, inside
a single transaction, (a) validates the window (BR2), (b) checks the
one-per-day rule, (c) locks and counts existing bookings for that
date/type and rejects if `>= capacity`, then inserts. This makes the three
rules atomic and race-safe. Modify/cancel go through sibling RPCs or
RLS-guarded updates/deletes restricted to the caller's own rows.

**RLS (summary):**
- `parking_vehicle_types`: any authenticated user reads active types.
- `parking_bookings`: a user reads what's needed for availability and their
  own bookings; writes only their own rows, only within the window. HR/parking
  admin manages all.
- Access is additionally gated at the route by the parking app assignment.

**Timezone:** BR2 ("day before / same day") must be evaluated in the
**office's local timezone** (e.g. `America/Bogota`), not UTC, or the window
will shift for early-morning/late-night edge cases. Confirm the timezone.

---

## 7. UI / UX notes

- Route `/parking` inside the Hub shell (shares header, session, toasts,
  `loading.tsx`, `error.tsx`).
- Layout: a small day switcher (**Today / Tomorrow**), and for each vehicle
  type a card showing **free / total**, plus a primary action:
  **Book** when free, **Cancel** on your own booking, **Full** when at
  capacity.
- Sentence case, specific CTAs (e.g. "Book a bicycle spot"), zero dark
  patterns (frictionless cancel) — per the Hub writing standards.
- Toasts confirm book / modify / cancel; empty and full states are explicit.

---

## 8. Open decisions to confirm

1. **Capacities** — go with 7 (car/moto), 10 (bike), 10 (scooter)? These
   were given as provisional.
2. **Capacity vs numbered spots** — v1 treats each type as a *pool of N
   slots* (you get "a bike spot", not "bike spot #3"). Confirm you do **not**
   need specific numbered/assigned spots yet.
3. **Office timezone** for the booking window — `America/Bogota`?
4. **Window** — strictly today + tomorrow (no booking further ahead)?
   Confirm this matches the intent.
5. **Non-working days** — should weekends/holidays be bookable, or only
   office days? (v1 could allow any day and refine later.)
6. **Car vs motorcycle** — keep them as one shared pool of 7, or track car
   vs motorcycle separately within that pool (for future reporting)?
7. **Capacity management** — seeded by developers for v1 (admin UI later)?

---

## 9. Out of scope for v1 (candidates for later)

- Payments / paid parking.
- Fixed/assigned numbered spots per employee.
- Waitlist when a type is Full (notify when a slot frees up).
- Recurring bookings (e.g. "every weekday").
- Occupancy reports / analytics for Facilities.
- Self-service capacity management UI (UCP6).
