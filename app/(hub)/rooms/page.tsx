import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoomsBooking, type RoomDay } from "./RoomsBooking";

const BOGOTA_TZ = "America/Bogota";

function officeDateISO(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BOGOTA_TZ }).format(date);
}

function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

/** Current minute-of-day in the office timezone (for hiding past slots). */
function officeNowMin(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/**
 * Meeting room booking mini-app. Server Component: gates access by the
 * rooms app assignment, then loads the rooms and the day's bookings for
 * today and tomorrow, and hands them to the client booking UI.
 */
export default async function RoomsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userEmail = user.email?.toLowerCase() ?? "";

  // Access gate: must have the rooms app assigned (filter by own email).
  const { data: roomsApp } = await supabase
    .from("apps")
    .select("id")
    .eq("key", "rooms")
    .single();

  const { data: access } = await supabase
    .from("user_app_access")
    .select("id")
    .eq("user_email", userEmail)
    .eq("app_id", roomsApp?.id ?? "")
    .maybeSingle();

  if (!access) redirect("/");

  const today = officeDateISO(new Date());
  const tomorrow = officeDateISO(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const [roomsRes, todayRes, tomorrowRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, name, capacity")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.rpc("room_day", { p_date: today }),
    supabase.rpc("room_day", { p_date: tomorrow }),
  ]);

  const rooms = roomsRes.data ?? [];

  const days: RoomDay[] = [
    {
      date: today,
      title: "Today",
      subtitle: dayLabel(today),
      bookings: todayRes.data ?? [],
    },
    {
      date: tomorrow,
      title: "Tomorrow",
      subtitle: dayLabel(tomorrow),
      bookings: tomorrowRes.data ?? [],
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

      <h1 className="mb-1 text-2xl font-bold text-tx-1">Room booking</h1>
      <p className="mb-6 text-sm text-tx-3">
        Book a meeting room for today or tomorrow (05:00–18:00). Pick a start
        time and a duration.
      </p>

      <RoomsBooking rooms={rooms} days={days} nowMin={officeNowMin()} />
    </section>
  );
}
