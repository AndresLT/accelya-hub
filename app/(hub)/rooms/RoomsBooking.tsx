"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { RefreshButton } from "@/components/ui/RefreshButton";

const DAY_START = 300; // 05:00
const DAY_END = 1080; // 18:00
const STEP = 30;
const MAX_DURATION = 240; // 4h cap for the dropdown

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
function startOptions(minStart: number): number[] {
  const out: number[] = [];
  for (let t = DAY_START; t <= DAY_END - STEP; t += STEP) {
    if (t >= minStart) out.push(t);
  }
  return out;
}
function durationOptions(start: number): number[] {
  const out: number[] = [];
  const max = Math.min(MAX_DURATION, DAY_END - start);
  for (let d = STEP; d <= max; d += STEP) out.push(d);
  return out;
}

/**
 * Meeting room booking (UC "rooms"). Per-room cards show the day agenda
 * (who booked which range) and a Start + Duration form (Teams-style). All
 * rules — window, business hours, and NO overlapping bookings per room —
 * are enforced by book_room()/cancel_room() in the database.
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

  // For today, hide start times that have already passed (rounded to step).
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
  const [start, setStart] = useState<number | "">(starts[0] ?? "");
  const [duration, setDuration] = useState<number>(STEP);

  const durations = typeof start === "number" ? durationOptions(start) : [];
  // Keep the selected duration valid for the chosen start.
  const effectiveDuration = durations.includes(duration)
    ? duration
    : (durations[0] ?? STEP);

  const canBook = typeof start === "number" && durations.length > 0 && !pending;

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
      ) : (
        <div className="mt-auto border-t border-bg-3 pt-4">
          <div className="flex flex-wrap gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-tx-2">
                Start
              </span>
              <select
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
                className="w-full rounded-lg border border-bg-3 bg-bg-1 px-2.5 py-2 text-sm outline-none focus:border-acc-blue"
              >
                {starts.map((s) => (
                  <option key={s} value={s}>
                    {timeLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-tx-2">
                Duration
              </span>
              <select
                value={effectiveDuration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-bg-3 bg-bg-1 px-2.5 py-2 text-sm outline-none focus:border-acc-blue"
              >
                {durations.map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={!canBook}
            onClick={() => {
              if (typeof start === "number") {
                onBook(room.id, start, start + effectiveDuration);
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
