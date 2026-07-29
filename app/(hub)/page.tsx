import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

// The catalog only needs these columns of an app.
type App = Pick<
  Tables<"apps">,
  "id" | "key" | "name" | "description" | "icon" | "launch_url" | "is_active"
>;

/**
 * App catalog (UC3/UC4). Server Component: it fetches the current user's
 * assigned apps directly on the server. RLS does the filtering for us —
 * `user_app_access` returns only this user's rows and `apps` only active
 * ones — so no explicit `where user = ...` is needed here.
 *
 * Because every app is a route inside this same project, opening one is a
 * plain <Link>; the session travels automatically (UC4, no re-auth).
 */
export default async function CatalogPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_app_access")
    .select(
      "app:apps(id, key, name, description, icon, launch_url, is_active)",
    );

  const apps: App[] = (data ?? [])
    .map((row) => row.app as App | null)
    .filter((app): app is App => Boolean(app?.is_active));

  return (
    <section>
      <h1 className="mb-1 text-2xl font-bold text-tx-1">Your apps</h1>
      <p className="mb-6 text-sm text-tx-3">
        Applications you have access to. Select one to open it.
      </p>

      {error && (
        <p className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error-tx">
          We couldn&apos;t load your apps right now. Please try again later.
        </p>
      )}

      {!error && apps.length === 0 && (
        <p className="rounded-lg bg-bg-1 border border-bg-3 px-4 py-6 text-center text-sm text-tx-3">
          You don&apos;t have any apps assigned yet. Contact HR to request
          access.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
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
      </div>
    </section>
  );
}
