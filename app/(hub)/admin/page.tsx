import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { Pagination } from "@/components/ui/Pagination";
import { AddUserForm } from "./AddUserForm";
import { EditUserForm } from "./EditUserForm";
import { UserActions } from "./UserActions";
import { AppAccessControl } from "./AppAccessControl";

type HubUser = Tables<"hub_users">;
type App = Pick<Tables<"apps">, "id" | "name">;

const PAGE_SIZE = 10;

/**
 * User management (UC7) + per-user app assignment (UC8). Server Component:
 * it loads one page of users, the active app catalog, and the app-access
 * rows for just those users (RLS scopes reads to hr_admins). Interactive
 * cells are Client Components that mutate via the browser client and call
 * router.refresh() to re-run this fetch.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [usersRes, appsRes] = await Promise.all([
    supabase
      .from("hub_users")
      .select("email, full_name, position, role, is_active, last_login_at", {
        count: "exact",
      })
      .order("full_name", { ascending: true })
      .range(from, to),
    supabase.from("apps").select("id, name").order("name", { ascending: true }),
  ]);

  const users = (usersRes.data ?? []) as Pick<
    HubUser,
    "email" | "full_name" | "position" | "role" | "is_active" | "last_login_at"
  >[];
  const apps = (appsRes.data ?? []) as App[];
  const totalPages = Math.max(1, Math.ceil((usersRes.count ?? 0) / PAGE_SIZE));

  // App-access rows for just the users on this page.
  const accessByEmail = new Map<string, string[]>();
  const pageEmails = users.map((u) => u.email);
  if (pageEmails.length > 0) {
    const { data: accessRows } = await supabase
      .from("user_app_access")
      .select("user_email, app_id")
      .in("user_email", pageEmails);
    for (const row of accessRows ?? []) {
      const list = accessByEmail.get(row.user_email) ?? [];
      list.push(row.app_id);
      accessByEmail.set(row.user_email, list);
    }
  }

  return (
    <div className="space-y-6">
      <AddUserForm />

      <div className="overflow-x-auto rounded-xl border border-bg-3 bg-bg-1">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-bg-3 text-xs uppercase tracking-wide text-tx-3">
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Position</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Apps</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.email === user?.email;
              return (
                <tr
                  key={u.email}
                  className="border-b border-bg-3 last:border-0 align-middle hover:bg-bg-2"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-tx-1">
                      {u.full_name}
                    </div>
                    <div className="text-xs text-tx-3">{u.email}</div>
                    <EditUserForm
                      email={u.email}
                      fullName={u.full_name}
                      position={u.position ?? ""}
                    />
                  </td>
                  <td className="px-4 py-3 text-tx-2">{u.position ?? "—"}</td>
                  <td className="px-4 py-3">
                    <UserActions
                      email={u.email}
                      role={u.role as "employee" | "hr_admin"}
                      isActive={u.is_active}
                      isSelf={isSelf}
                      control="role"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <UserActions
                      email={u.email}
                      role={u.role as "employee" | "hr_admin"}
                      isActive={u.is_active}
                      isSelf={isSelf}
                      control="status"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <AppAccessControl
                      userEmail={u.email}
                      apps={apps}
                      assignedAppIds={accessByEmail.get(u.email) ?? []}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/admin"
        page={page}
        totalPages={totalPages}
        totalItems={usersRes.count ?? undefined}
      />
    </div>
  );
}
