# Accelya Hub — Meeting room booking (mini-app)
## Use Cases and User Stories (v1)

> All committed content is in English. Route: `/rooms`, inside the Hub.

## 1. Scope
Book one of **3 meeting rooms** for a **time range** on a given day.

| Room | Capacity (seats, informational) |
|---|---|
| Room 1 | 10 |
| Room 2 | 2 |
| Room 3 | 6 |

- **Window:** today and tomorrow (America/Bogota), like desks/parking.
- **Business hours:** 05:00–18:00.
- **Slots:** start time in 30-min steps + a **duration** (30 min, 1h, 1h 30min, …), Teams-style. End must stay within 18:00.
- **No per-user limit:** a user may hold several bookings the same day, same room (different times) or different rooms at the same time.
- **The one hard rule:** a room cannot have two bookings whose times **overlap** (any employees). Enforced atomically by a Postgres **exclusion constraint** (`btree_gist`), the range-based equivalent of the `unique` used by desks/parking.
- **Identities visible:** everyone with room access sees who booked each slot.
- **Cancel:** users cancel their own bookings at any time.
- Capacity is informational only (does not limit bookings).

## 2. Data model
- `rooms` — `id, name, capacity, sort_order, is_active`. Seeded (3 rooms).
- `room_bookings` — `id, user_email, room_id, booking_date, start_min, end_min` (minutes from midnight; avoids timezone math for the 30-min grid). Constraints: `start_min < end_min`, business hours (300..1080), 30-min aligned, and **`EXCLUDE ... (room_id =, booking_date =, int4range(start_min,end_min) &&)`** for no-overlap.

## 3. RPCs (security definer)
- `book_room(room, date, start_min, end_min)` — validates access, window, business hours, alignment; inserts; a concurrent overlap raises a clear "time overlaps" error.
- `room_day(date)` — all bookings that day (room, time range, booker name, is_mine) — powers the per-room agenda without exposing `hub_users`.
- `cancel_room(booking_id)` — deletes the caller's own booking.

## 4. UI
- `/rooms`: Today/Tomorrow tabs + Refresh. Three room cards; each shows capacity, the **day agenda** (booked ranges with who), and a **Start + Duration** form to book. Cancel from your own agenda item.
- `/admin/rooms`: occupancy for a chosen day (bookings per room + who).

## 5. Out of scope (v1)
Recurring meetings, attendee lists/invites, room amenities, approvals, custom hours per room.
