import { createClient } from "@/lib/supabase/server";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { AdminDatePicker } from "@/components/ui/AdminDatePicker";

type BookingRow = {
  id: string;
  desk: { code: string; zone: string } | null;
  hub_users: { full_name: string } | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function officeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

/**
 * Desk occupancy (admin view). Read-only: for a chosen day, utilization per
 * zone and the list of who booked which desk. The admin layout gates this to
 * hr_admins; RLS lets them read all bookings, desks and user names.
 */
export default async function AdminDesksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const supabase = await createClient();

  const today = officeToday();
  const selectedDate = date && ISO_DATE.test(date) ? date : today;

  const [desksRes, bookingsRes] = await Promise.all([
    supabase.from("desks").select("zone").eq("is_active", true),
    supabase
      .from("desk_bookings")
      .select("id, desk:desks(code, zone), hub_users(full_name)")
      .eq("booking_date", selectedDate),
  ]);

  const totalByZone = new Map<string, number>();
  for (const d of desksRes.data ?? []) {
    totalByZone.set(d.zone, (totalByZone.get(d.zone) ?? 0) + 1);
  }

  const bookings = (bookingsRes.data ?? []) as unknown as BookingRow[];
  const bookedByZone = new Map<string, number>();
  for (const b of bookings) {
    const z = b.desk?.zone;
    if (z) bookedByZone.set(z, (bookedByZone.get(z) ?? 0) + 1);
  }

  const zones = [...totalByZone.keys()].sort();
  const sortedBookings = [...bookings].sort((a, b) =>
    (a.desk?.code ?? "").localeCompare(b.desk?.code ?? ""),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-tx-1">
            Occupancy
          </h2>
          <p className="text-sm text-tx-3">
            Who booked a desk on the selected day.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminDatePicker
            basePath="/admin/desks"
            value={selectedDate}
            today={today}
          />
          <RefreshButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {zones.map((z) => {
          const total = totalByZone.get(z) ?? 0;
          const used = bookedByZone.get(z) ?? 0;
          const pct = total > 0 ? Math.round((used / total) * 100) : 0;
          return (
            <div key={z} className="rounded-xl border border-bg-3 bg-bg-1 p-4">
              <h3 className="font-heading text-sm font-semibold text-tx-1">
                Zone {z}
              </h3>
              <p className="mt-1 text-2xl font-bold text-tx-1">
                {used}
                <span className="text-base font-normal text-tx-3">
                  {" "}
                  / {total}
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
          No desk bookings for this day.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bg-3 bg-bg-1">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-bg-3 text-xs uppercase tracking-wide text-tx-3">
                <th className="px-4 py-3 font-semibold">Desk</th>
                <th className="px-4 py-3 font-semibold">Zone</th>
                <th className="px-4 py-3 font-semibold">Employee</th>
              </tr>
            </thead>
            <tbody>
              {sortedBookings.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-bg-3 last:border-0 hover:bg-bg-2"
                >
                  <td className="px-4 py-3 font-semibold text-tx-1">
                    {b.desk?.code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-tx-2">{b.desk?.zone ?? "—"}</td>
                  <td className="px-4 py-3 text-tx-2">
                    {b.hub_users?.full_name ?? "—"}
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
