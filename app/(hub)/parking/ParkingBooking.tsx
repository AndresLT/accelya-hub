"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Availability = {
  vehicle_type: string;
  label: string;
  capacity: number;
  booked: number;
  available: number;
};

export type DayData = {
  date: string; // YYYY-MM-DD (America/Bogota)
  title: string; // "Today" | "Tomorrow"
  subtitle: string; // e.g. "Wed, Jul 29"
  availability: Availability[];
  myVehicleType: string | null; // the type the user booked that day, if any
};

/**
 * Parking booking UI (UCP1–UCP5). A day switcher (Today / Tomorrow) and,
 * per vehicle type, its free/total count with the right action:
 *   - "Book" (or "Switch to this" if you already booked another type),
 *   - "Cancel my spot" on your current booking,
 *   - "Full" when the pool is at capacity.
 *
 * All rules (window, one-per-day, capacity, access) are enforced in the
 * database by book_parking(); here we just surface its result.
 */
export function ParkingBooking({ days }: { days: DayData[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [activeIdx, setActiveIdx] = useState(0);
  const [pending, setPending] = useState(false);

  const day = days[activeIdx];

  async function book(type: string) {
    setPending(true);
    const { error } = await supabase.rpc("book_parking", {
      p_date: day.date,
      p_type: type,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Your parking spot is booked.");
    router.refresh();
  }

  async function cancel() {
    setPending(true);
    // RLS restricts the delete to the caller's own row within the window.
    const { error } = await supabase
      .from("parking_bookings")
      .delete()
      .eq("booking_date", day.date);
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Your booking was cancelled.");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 inline-flex rounded-lg border border-bg-3 bg-bg-1 p-1">
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

      {day.myVehicleType && (
        <p className="mb-4 rounded-lg bg-success-bg px-4 py-3 text-sm text-success-tx">
          Your spot for {day.title.toLowerCase()} is secured.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {day.availability.map((a) => {
          const mine = day.myVehicleType === a.vehicle_type;
          const full = a.available <= 0;

          return (
            <div
              key={a.vehicle_type}
              className={`rounded-xl border p-5 ${
                mine ? "border-acc-teal bg-info-bg" : "border-bg-3 bg-bg-1"
              }`}
            >
              <h2 className="font-heading text-base font-semibold text-tx-1">
                {a.label}
              </h2>
              <p className="mt-1 text-sm text-tx-3">
                {a.available} of {a.capacity} available
              </p>

              <div className="mt-4">
                {mine ? (
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={pending}
                    className="w-full rounded-lg bg-error-bg px-4 py-2 text-sm font-semibold text-error-tx hover:brightness-95 disabled:opacity-50"
                  >
                    Cancel my spot
                  </button>
                ) : full ? (
                  <span className="block w-full rounded-lg bg-bg-3 px-4 py-2 text-center text-sm font-semibold text-tx-3">
                    Full
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => book(a.vehicle_type)}
                    disabled={pending}
                    className="w-full rounded-lg bg-acc-blue px-4 py-2 text-sm font-semibold text-tx-1-c disabled:opacity-50"
                  >
                    {day.myVehicleType ? "Switch to this" : "Book"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
