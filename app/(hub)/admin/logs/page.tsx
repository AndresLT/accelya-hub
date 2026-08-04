import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { Pagination } from "@/components/ui/Pagination";

type AccessLog = Tables<"access_logs">;

const PAGE_SIZE = 10;

/** Visual style per audit event type, using the semantic brand tokens. */
const EVENT_STYLES: Record<string, { label: string; className: string }> = {
  login_success: {
    label: "Login success",
    className: "bg-success-bg text-success-tx",
  },
  login_failed: {
    label: "Login failed",
    className: "bg-error-bg text-error-tx",
  },
  otp_requested: {
    label: "OTP requested",
    className: "bg-info-bg text-info-tx",
  },
  logout: { label: "Logout", className: "bg-bg-3 text-tx-2" },
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Access log (UC9 / US3.4). Read-only list of authentication events, most
 * recent first. RLS ("hr_admin can view access logs") scopes the read to
 * admins; the admin layout already gates the route.
 */
export default async function AccessLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("access_logs")
    .select("id, email, event_type, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const logs = (data ?? []) as Pick<
    AccessLog,
    "id" | "email" | "event_type" | "created_at"
  >[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  if (error) {
    return (
      <p className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error-tx">
        We couldn&apos;t load the access log right now. Please try again later.
      </p>
    );
  }

  if ((count ?? 0) === 0) {
    return (
      <p className="rounded-lg border border-bg-3 bg-bg-1 px-4 py-6 text-center text-sm text-tx-3">
        No access events recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-bg-3 bg-bg-1">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-bg-3 text-xs uppercase tracking-wide text-tx-3">
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">User</th>
            <th className="px-4 py-3 font-semibold">Event</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const style = EVENT_STYLES[log.event_type] ?? {
              label: log.event_type,
              className: "bg-bg-3 text-tx-2",
            };
            return (
              <tr
                key={log.id}
                className="border-b border-bg-3 last:border-0 hover:bg-bg-2"
              >
                <td className="whitespace-nowrap px-4 py-3 text-tx-2">
                  {dateFormatter.format(new Date(log.created_at))}
                </td>
                <td className="px-4 py-3 text-tx-1">{log.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}
                  >
                    {style.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <Pagination
        basePath="/admin/logs"
        page={page}
        totalPages={totalPages}
        totalItems={count ?? undefined}
      />
    </div>
  );
}
