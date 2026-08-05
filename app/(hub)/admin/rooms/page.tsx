import { createClient } from "@/lib/supabase/server";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { AdminDatePicker } from "@/components/ui/AdminDatePicker";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function officeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function timeLabel(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/**
 * Room occupancy (admin view). Read-only: for a chosen day, every room
 * booking with its time range and who booked it. Uses room_day() (which
 * returns all bookings + names); the admin layout gates this to hr_admins.
 */
export default async function AdminRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const supabase = await createClient();

  const today = officeToday();
  const selectedDate = date && ISO_DATE.test(date) ? date : today;

  const [roomsRes, dayRes] = await Promise.all([
    supabase.from("rooms").select("id, name, sort_order").order("sort_order"),
    supabase.rpc("room_day", { p_date: selectedDate }),
  ]);

  const rooms = roomsRes.data ?? [];
  const roomInfo = new Map(rooms.map((r) => [r.id, r]));
  const bookings = dayRes.data ?? [];

  const sorted = [...bookings].sort((a, b) => {
    const orderDiff =
      (roomInfo.get(a.room_id)?.sort_order ?? 99) -
      (roomInfo.get(b.room_id)?.sort_order ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return a.start_min - b.start_min;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-tx-1">
            Occupancy
          </h2>
          <p className="text-sm text-tx-3">
            Room bookings on the selected day.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminDatePicker
            basePath="/admin/rooms"
            value={selectedDate}
            today={today}
          />
          <RefreshButton />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-bg-3 bg-bg-1 px-4 py-6 text-center text-sm text-tx-3">
          No room bookings for this day.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bg-3 bg-bg-1">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-bg-3 text-xs uppercase tracking-wide text-tx-3">
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Employee</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr
                  key={b.booking_id}
                  className="border-b border-bg-3 last:border-0 hover:bg-bg-2"
                >
                  <td className="px-4 py-3 font-semibold text-tx-1">
                    {roomInfo.get(b.room_id)?.name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-tx-2">
                    {timeLabel(b.start_min)}–{timeLabel(b.end_min)}
                  </td>
                  <td className="px-4 py-3 text-tx-2">
                    {b.booked_by_name ?? "—"}
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
