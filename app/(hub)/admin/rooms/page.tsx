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

type DayBooking = {
  booking_id: string;
  room_id: string;
  start_min: number;
  end_min: number;
  booked_by_name: string | null;
  is_mine: boolean;
};

/**
 * Room occupancy (admin view). Read-only: for a chosen day, each room is
 * shown as its own section with its bookings (time + who). Uses room_day();
 * the admin layout gates this to hr_admins.
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
    supabase
      .from("rooms")
      .select("id, name, capacity, sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.rpc("room_day", { p_date: selectedDate }),
  ]);

  const rooms = roomsRes.data ?? [];
  const bookings = (dayRes.data ?? []) as DayBooking[];

  // Group bookings by room, each sorted by start time.
  const byRoom = new Map<string, DayBooking[]>();
  for (const b of bookings) {
    const list = byRoom.get(b.room_id) ?? [];
    list.push(b);
    byRoom.set(b.room_id, list);
  }
  for (const list of byRoom.values()) {
    list.sort((a, b) => a.start_min - b.start_min);
  }

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

      <div className="space-y-4">
        {rooms.map((room) => {
          const roomBookings = byRoom.get(room.id) ?? [];
          return (
            <div
              key={room.id}
              className="overflow-hidden rounded-xl border border-bg-3 bg-bg-1"
            >
              <div className="flex items-center justify-between border-b border-bg-3 px-4 py-3">
                <h3 className="font-heading text-sm font-semibold text-tx-1">
                  {room.name}
                </h3>
                <span className="text-xs text-tx-3">
                  {room.capacity} seats · {roomBookings.length}{" "}
                  {roomBookings.length === 1 ? "booking" : "bookings"}
                </span>
              </div>

              {roomBookings.length === 0 ? (
                <p className="px-4 py-4 text-sm text-tx-3">
                  No bookings for this day.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-bg-3 text-xs uppercase tracking-wide text-tx-3">
                      <th className="px-4 py-2.5 font-semibold">Time</th>
                      <th className="px-4 py-2.5 font-semibold">Employee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomBookings.map((b) => (
                      <tr
                        key={b.booking_id}
                        className="border-b border-bg-3 last:border-0 hover:bg-bg-2"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-tx-2">
                          {timeLabel(b.start_min)}–{timeLabel(b.end_min)}
                        </td>
                        <td className="px-4 py-2.5 text-tx-2">
                          {b.booked_by_name ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
