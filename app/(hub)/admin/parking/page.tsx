import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { ParkingDatePicker } from "./ParkingDatePicker";

type VehicleType = Pick<
  Tables<"parking_vehicle_types">,
  "key" | "label" | "capacity" | "sort_order"
>;

type BookingRow = {
  id: string;
  vehicle_type: string;
  user_email: string;
  hub_users: { full_name: string } | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date (YYYY-MM-DD) in the office timezone. */
function officeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

/**
 * Parking occupancy (admin view, UCP6-lite). Read-only: for a chosen day it
 * shows utilization per vehicle type and the list of who booked. The admin
 * layout already gates this to hr_admins, and RLS lets them read all
 * bookings and user names.
 */
export default async function AdminParkingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const supabase = await createClient();

  const today = officeToday();
  const selectedDate = date && ISO_DATE.test(date) ? date : today;

  const [typesRes, bookingsRes] = await Promise.all([
    supabase
      .from("parking_vehicle_types")
      .select("key, label, capacity, sort_order")
      .order("sort_order"),
    supabase
      .from("parking_bookings")
      .select("id, vehicle_type, user_email, hub_users(full_name)")
      .eq("booking_date", selectedDate),
  ]);

  const types = (typesRes.data ?? []) as VehicleType[];
  const bookings = (bookingsRes.data ?? []) as unknown as BookingRow[];

  const countByType = new Map<string, number>();
  for (const b of bookings) {
    countByType.set(b.vehicle_type, (countByType.get(b.vehicle_type) ?? 0) + 1);
  }

  const labelByType = new Map(types.map((t) => [t.key, t.label]));
  const orderByType = new Map(types.map((t) => [t.key, t.sort_order]));

  const sortedBookings = [...bookings].sort((a, b) => {
    const orderDiff =
      (orderByType.get(a.vehicle_type) ?? 99) -
      (orderByType.get(b.vehicle_type) ?? 99);
    if (orderDiff !== 0) return orderDiff;
    const nameA = a.hub_users?.full_name ?? a.user_email;
    const nameB = b.hub_users?.full_name ?? b.user_email;
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-tx-1">
            Occupancy
          </h2>
          <p className="text-sm text-tx-3">
            Who has a parking spot on the selected day.
          </p>
        </div>
        <ParkingDatePicker value={selectedDate} today={today} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {types.map((t) => {
          const used = countByType.get(t.key) ?? 0;
          const pct = t.capacity > 0 ? Math.round((used / t.capacity) * 100) : 0;
          return (
            <div
              key={t.key}
              className="rounded-xl border border-bg-3 bg-bg-1 p-5"
            >
              <h3 className="font-heading text-sm font-semibold text-tx-1">
                {t.label}
              </h3>
              <p className="mt-1 text-2xl font-bold text-tx-1">
                {used}
                <span className="text-base font-normal text-tx-3">
                  {" "}
                  / {t.capacity}
                </span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-3">
                <div
                  className="h-full rounded-full bg-acc-teal"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {sortedBookings.length === 0 ? (
        <p className="rounded-lg border border-bg-3 bg-bg-1 px-4 py-6 text-center text-sm text-tx-3">
          No bookings for this day.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bg-3 bg-bg-1">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-bg-3 text-xs uppercase tracking-wide text-tx-3">
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Vehicle</th>
              </tr>
            </thead>
            <tbody>
              {sortedBookings.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-bg-3 last:border-0 hover:bg-bg-2"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-tx-1">
                      {b.hub_users?.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-tx-3">{b.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-tx-2">
                    {labelByType.get(b.vehicle_type) ?? b.vehicle_type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
