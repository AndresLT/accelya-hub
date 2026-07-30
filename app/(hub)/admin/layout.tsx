import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./AdminNav";

/**
 * Admin section shell (Server Component). Sits inside the (hub) group, so
 * the authenticated header and session guard already apply; here we add
 * the role guard: only active hr_admins may enter. Non-admins are sent
 * back to the catalog.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // is_hr_admin() is a security-definer function that checks the current
  // user's role server-side (see accelya-hub-schema.sql).
  const { data: isHrAdmin } = await supabase.rpc("is_hr_admin");

  if (!isHrAdmin) {
    redirect("/");
  }

  return (
    <section>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-tx-3 hover:text-acc-blue"
      >
        <span aria-hidden>&larr;</span> Back to Hub
      </Link>

      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-tx-1">Administration</h1>
        <p className="text-sm text-tx-3">
          Manage Hub users, their app access, and review the access log.
        </p>
      </div>

      <AdminNav />

      <div className="mt-6">{children}</div>
    </section>
  );
}
