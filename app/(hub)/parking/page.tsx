import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParkingBooking, type DayData } from "./ParkingBooking";

const BOGOTA_TZ = "America/Bogota";

/** Calendar date (YYYY-MM-DD) in the office timezone. */
function bogotaDateISO(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BOGOTA_TZ }).format(date);
}

/** Human label like "Wed, Jul 29" for a YYYY-MM-DD string. */
function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

/**
 * Parking mini-app (UCP1–UCP5). Server Component: gates access by the
 * parking app assignment, then loads availability for today and tomorrow
 * plus the user's own bookings, and hands them to the client UI.
 *
 * Bogota has no DST, so "tomorrow" is reliably now + 24h.
 */
export default async function ParkingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userEmail = user.email?.toLowerCase() ?? "";

  // Access gate (BR7): must have the parking app assigned. We filter by our
  // own email explicitly — RLS also lets hr_admins read every assignment.
  const { data: parkingApp } = await supabase
    .from("apps")
    .select("id")
    .eq("key", "parking")
    .single();

  const { data: access } = await supabase
    .from("user_app_access")
    .select("id")
    .eq("user_email", userEmail)
    .eq("app_id", parkingApp?.id ?? "")
    .maybeSingle();

  if (!access) redirect("/");

  const today = bogotaDateISO(new Date());
  const tomorrow = bogotaDateISO(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const [todayAvail, tomorrowAvail, myBookings] = await Promise.all([
    supabase.rpc("parking_availability", { p_date: today }),
    supabase.rpc("parking_availability", { p_date: tomorrow }),
    supabase
      .from("parking_bookings")
      .select("booking_date, vehicle_type")
      .in("booking_date", [today, tomorrow]),
  ]);

  const bookingByDate = new Map<string, string>();
  for (const b of myBookings.data ?? []) {
    bookingByDate.set(b.booking_date, b.vehicle_type);
  }

  const days: DayData[] = [
    {
      date: today,
      title: "Today",
      subtitle: dayLabel(today),
      availability: todayAvail.data ?? [],
      myVehicleType: bookingByDate.get(today) ?? null,
    },
    {
      date: tomorrow,
      title: "Tomorrow",
      subtitle: dayLabel(tomorrow),
      availability: tomorrowAvail.data ?? [],
      myVehicleType: bookingByDate.get(tomorrow) ?? null,
    },
  ];

  return (
    <section>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-tx-3 hover:text-acc-blue"
      >
        <span aria-hidden>&larr;</span> Back to Hub
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-tx-1">Parking</h1>
      <p className="mb-6 text-sm text-tx-3">
        Book your office parking spot for today or tomorrow. One spot per day —
        cancel any time to free it up for a colleague.
      </p>
      <ParkingBooking days={days} />
    </section>
  );
}
