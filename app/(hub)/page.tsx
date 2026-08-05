import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

// The catalog only needs these columns of an app.
type App = Pick<
  Tables<"apps">,
  | "id"
  | "key"
  | "name"
  | "description"
  | "icon"
  | "launch_url"
  | "is_active"
  | "is_coming_soon"
>;

const APP_COLUMNS =
  "id, key, name, description, icon, launch_url, is_active, is_coming_soon";

/**
 * App catalog (UC3/UC4). Server Component.
 *
 * Two kinds of cards:
 *  - Apps the user is assigned (and that are live) → clickable launchers.
 *  - "Coming soon" apps → shown to everyone as locked teasers of what's
 *    on the way (not launchable).
 *
 * We filter assignments by the user's email EXPLICITLY (RLS also lets
 * hr_admins read every row, which would otherwise leak all assignments).
 */
export default async function CatalogPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [assignedRes, soonRes] = await Promise.all([
    supabase
      .from("user_app_access")
      .select(`app:apps(${APP_COLUMNS})`)
      .eq("user_email", user?.email?.toLowerCase() ?? ""),
    supabase
      .from("apps")
      .select(APP_COLUMNS)
      .eq("is_active", true)
      .eq("is_coming_soon", true)
      .order("name", { ascending: true }),
  ]);

  const error = assignedRes.error;

  // Live apps the user can actually open (assigned, active, not coming soon).
  const availableApps: App[] = (assignedRes.data ?? [])
    .map((row) => row.app as App | null)
    .filter(
      (app): app is App => Boolean(app?.is_active) && !app?.is_coming_soon,
    );

  // Coming-soon teasers, shown to everyone.
  const comingSoonApps: App[] = (soonRes.data ?? []) as App[];

  return (
    <section>
      <h1 className="mb-1 text-2xl font-bold text-tx-1">Your apps</h1>
      <p className="mb-6 text-sm text-tx-3">
        Applications you have access to. Select one to open it.
      </p>

      {error && (
        <p className="mb-6 rounded-lg bg-error-bg px-4 py-3 text-sm text-error-tx">
          We couldn&apos;t load your apps right now. Please try again later.
        </p>
      )}

      {!error && availableApps.length === 0 && (
        <p className="mb-6 rounded-lg border border-bg-3 bg-bg-1 px-4 py-6 text-center text-sm text-tx-3">
          You don&apos;t have any apps assigned yet. Contact HR to request
          access.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {availableApps.map((app) => (
          <Link
            key={app.id}
            href={app.launch_url}
            className="group rounded-xl border border-bg-3 bg-bg-1 p-5 transition-colors hover:border-acc-teal"
          >
            <h2 className="mb-1 font-heading text-base font-semibold text-tx-1 group-hover:text-acc-blue">
              {app.name}
            </h2>
            {app.description && (
              <p className="text-sm text-tx-3">{app.description}</p>
            )}
          </Link>
        ))}

        {comingSoonApps.map((app) => (
          <div
            key={app.id}
            aria-disabled
            className="relative cursor-default rounded-xl border border-dashed border-bg-3 bg-bg-2 p-5"
          >
            <span className="absolute right-4 top-4 rounded-full bg-info-bg px-2 py-0.5 text-xs font-semibold text-info-tx">
              Soon
            </span>
            <h2 className="mb-1 pr-12 font-heading text-base font-semibold text-tx-2">
              {app.name}
            </h2>
            {app.description && (
              <p className="text-sm text-tx-3">{app.description}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
