"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { RefreshButton } from "@/components/ui/RefreshButton";

const DAY_START = 300; // 05:00
const DAY_END = 1080; // 18:00
const STEP = 30;

type Room = { id: string; name: string; capacity: number };

type BookingRow = {
  booking_id: string;
  room_id: string;
  start_min: number;
  end_min: number;
  booked_by_name: string | null;
  is_mine: boolean;
};

export type RoomDay = {
  date: string; // YYYY-MM-DD (America/Bogota)
  title: string; // "Today" | "Tomorrow"
  subtitle: string;
  bookings: BookingRow[];
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function timeLabel(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
function durationLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
/** Bookable start times (business hours), optionally hiding past ones. */
function startOptions(minStart: number): number[] {
  const out: number[] = [];
  for (let t = DAY_START; t <= DAY_END - STEP; t += STEP) {
    if (t >= minStart) out.push(t);
  }
  return out;
}
function stepRange(from: number, toInclusive: number): number[] {
  const out: number[] = [];
  for (let t = from; t <= toInclusive; t += STEP) out.push(t);
  return out;
}

/**
 * Meeting room booking. Per-room cards show the day agenda and a From/To
 * time form. The dropdowns only offer AVAILABLE times: From hides slots
 * that fall inside an existing booking, and To can't extend past the next
 * booking — so a selection can never overlap. The database still enforces
 * the rules (window, business hours, no overlap) as the final guard.
 */
export function RoomsBooking({
  rooms,
  days,
  nowMin,
}: {
  rooms: Room[];
  days: RoomDay[];
  nowMin: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [activeIdx, setActiveIdx] = useState(0);
  const [pending, setPending] = useState(false);

  const day = days[activeIdx];
  const isToday = activeIdx === 0;

  const minStart = isToday
    ? Math.max(DAY_START, Math.ceil(nowMin / STEP) * STEP)
    : DAY_START;
  const starts = startOptions(minStart);

  async function book(roomId: string, startMin: number, endMin: number) {
    setPending(true);
    const { error } = await supabase.rpc("book_room", {
      p_room_id: roomId,
      p_date: day.date,
      p_start_min: startMin,
      p_end_min: endMin,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Room booked.");
    router.refresh();
  }

  async function cancel(bookingId: string) {
    setPending(true);
    const { error } = await supabase.rpc("cancel_room", {
      p_booking_id: bookingId,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Booking cancelled.");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-bg-3 bg-bg-1 p-1">
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                i === activeIdx
                  ? "bg-acc-blue text-tx-1-c"
                  : "text-tx-2 hover:text-tx-1"
              }`}
            >
              {d.title}
              <span className="ml-1 hidden font-normal opacity-80 sm:inline">
                · {d.subtitle}
              </span>
            </button>
          ))}
        </div>
        <RefreshButton disabled={pending} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {rooms.map((room) => (
          <RoomCard
            key={`${room.id}-${day.date}`}
            room={room}
            bookings={day.bookings
              .filter((b) => b.room_id === room.id)
              .sort((a, b) => a.start_min - b.start_min)}
            starts={starts}
            pending={pending}
            onBook={book}
            onCancel={cancel}
          />
        ))}
      </div>
    </div>
  );
}

function RoomCard({
  room,
  bookings,
  starts,
  pending,
  onBook,
  onCancel,
}: {
  room: Room;
  bookings: BookingRow[];
  starts: number[];
  pending: boolean;
  onBook: (roomId: string, startMin: number, endMin: number) => void;
  onCancel: (bookingId: string) => void;
}) {
  // A time is free if it isn't inside any existing booking [start, end).
  const isFree = (t: number) =>
    !bookings.some((b) => t >= b.start_min && t < b.end_min);
  // Latest a meeting starting at `t` can run: the next booking's start.
  const nextBoundary = (t: number) => {
    const afters = bookings
      .filter((b) => b.start_min > t)
      .map((b) => b.start_min);
    return afters.length ? Math.min(...afters) : DAY_END;
  };

  // A start is available if it's free and has at least one 30-min slot
  // before the next booking. Unavailable ones are shown disabled.
  const isStartAvailable = (t: number) =>
    isFree(t) && nextBoundary(t) - t >= STEP;
  const availableStarts = starts.filter(isStartAvailable);

  const [start, setStart] = useState<number | "">(availableStarts[0] ?? "");
  const [end, setEnd] = useState<number | "">(
    typeof availableStarts[0] === "number" ? availableStarts[0] + STEP : "",
  );

  // Self-correct the selection if bookings changed (e.g. after a refresh).
  const effectiveStart =
    typeof start === "number" && availableStarts.includes(start)
      ? start
      : (availableStarts[0] ?? null);

  // Show all end times up to business close; the ones past the next booking
  // are rendered disabled.
  const maxEnd = effectiveStart !== null ? nextBoundary(effectiveStart) : DAY_END;
  const allEnds =
    effectiveStart !== null ? stepRange(effectiveStart + STEP, DAY_END) : [];
  const validEnds = allEnds.filter((e) => e <= maxEnd);
  const effectiveEnd =
    typeof end === "number" && validEnds.includes(end)
      ? end
      : (validEnds[0] ?? null);

  const total =
    effectiveStart !== null && effectiveEnd !== null
      ? effectiveEnd - effectiveStart
      : 0;

  const canBook =
    effectiveStart !== null && effectiveEnd !== null && !pending;

  function changeStart(value: number) {
    setStart(value);
    setEnd(value + STEP);
  }

  return (
    <div className="flex flex-col rounded-xl border border-bg-3 bg-bg-1 p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-heading text-base font-semibold text-tx-1">
          {room.name}
        </h2>
        <span className="text-xs text-tx-3">{room.capacity} seats</span>
      </div>

      {/* Day agenda */}
      <div className="mb-4 space-y-1.5">
        {bookings.length === 0 ? (
          <p className="text-sm text-tx-3">No bookings yet.</p>
        ) : (
          bookings.map((b) => (
            <div
              key={b.booking_id}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                b.is_mine ? "bg-info-bg" : "bg-bg-2"
              }`}
            >
              <span className="text-tx-1">
                <span className="font-semibold">
                  {timeLabel(b.start_min)}–{timeLabel(b.end_min)}
                </span>{" "}
                <span className="text-tx-3">
                  · {b.is_mine ? "You" : (b.booked_by_name ?? "—")}
                </span>
              </span>
              {b.is_mine && (
                <button
                  type="button"
                  onClick={() => onCancel(b.booking_id)}
                  disabled={pending}
                  className="shrink-0 text-xs font-semibold text-error-tx hover:underline disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Booking form */}
      {starts.length === 0 ? (
        <p className="mt-auto text-sm text-tx-3">
          No more time slots available today.
        </p>
      ) : availableStarts.length === 0 ? (
        <p className="mt-auto text-sm text-tx-3">
          Fully booked for this day.
        </p>
      ) : (
        <div className="mt-auto border-t border-bg-3 pt-4">
          <div className="flex flex-wrap gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-tx-2">
                From
              </span>
              <select
                value={effectiveStart ?? ""}
                onChange={(e) => changeStart(Number(e.target.value))}
                className="w-full rounded-lg border border-bg-3 bg-bg-1 px-2.5 py-2 text-sm outline-none focus:border-acc-blue"
              >
                {starts.map((s) => {
                  const avail = isStartAvailable(s);
                  return (
                    <option key={s} value={s} disabled={!avail}>
                      {timeLabel(s)}
                      {avail ? "" : " · booked"}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-tx-2">
                To
              </span>
              <select
                value={effectiveEnd ?? ""}
                onChange={(e) => setEnd(Number(e.target.value))}
                className="w-full rounded-lg border border-bg-3 bg-bg-1 px-2.5 py-2 text-sm outline-none focus:border-acc-blue"
              >
                {validEnds.map((eOpt) => (
                  <option key={eOpt} value={eOpt}>
                    {timeLabel(eOpt)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-2 text-xs text-tx-3">
            Total:{" "}
            <span className="font-semibold text-tx-2">
              {durationLabel(total)}
            </span>
          </p>

          <button
            type="button"
            disabled={!canBook}
            onClick={() => {
              if (effectiveStart !== null && effectiveEnd !== null) {
                onBook(room.id, effectiveStart, effectiveEnd);
              }
            }}
            className="mt-3 w-full rounded-lg bg-acc-blue px-4 py-2 text-sm font-semibold text-tx-1-c disabled:opacity-50"
          >
            Book
          </button>
        </div>
      )}
    </div>
  );
}
