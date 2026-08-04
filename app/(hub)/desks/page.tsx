import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeskBooking, type DeskDay } from "./DeskBooking";

function officeDateISO(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(date);
}

function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

/**
 * Desk booking mini-app (UCD1–UCD5). Server Component: gates access by the
 * desk app assignment, then loads the desk map (status + who's where) for
 * today and tomorrow and hands it to the interactive client map.
 */
export default async function DesksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userEmail = user.email?.toLowerCase() ?? "";

  // Access gate (BRD7): must have the desks app assigned. Filter by our own
  // email explicitly — RLS also lets hr_admins read every assignment.
  const { data: desksApp } = await supabase
    .from("apps")
    .select("id")
    .eq("key", "desks")
    .single();

  const { data: access } = await supabase
    .from("user_app_access")
    .select("id")
    .eq("user_email", userEmail)
    .eq("app_id", desksApp?.id ?? "")
    .maybeSingle();

  if (!access) redirect("/");

  const today = officeDateISO(new Date());
  const tomorrow = officeDateISO(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const [todayMap, tomorrowMap] = await Promise.all([
    supabase.rpc("desk_map", { p_date: today }),
    supabase.rpc("desk_map", { p_date: tomorrow }),
  ]);

  const days: DeskDay[] = [
    {
      date: today,
      title: "Today",
      subtitle: dayLabel(today),
      desks: todayMap.data ?? [],
    },
    {
      date: tomorrow,
      title: "Tomorrow",
      subtitle: dayLabel(tomorrow),
      desks: tomorrowMap.data ?? [],
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

      <h1 className="mb-1 text-2xl font-bold text-tx-1">Desk booking</h1>
      <p className="mb-6 text-sm text-tx-3">
        Reserve your desk for today or tomorrow. One desk per day — tap a desk
        on the map to book it or release it for a colleague.
      </p>

      <DeskBooking days={days} />
    </section>
  );
}
