import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

/**
 * Shared shell for the Hub and every mini-app route (Server Component).
 * The middleware already guarantees an authenticated, in-window session;
 * here we load the user's Hub profile to render the header. If the row is
 * missing (e.g. never linked), we send them back to login defensively.
 */
export default async function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: hubUser } = await supabase
    .from("hub_users")
    .select("email, full_name, role")
    .eq("id", user.id)
    .single();

  const isHrAdmin = hubUser?.role === "hr_admin";

  return (
    <div className="min-h-screen">
      <header className="border-b border-bg-3 bg-acc-blue">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-heading font-bold text-tx-1-c">
            accelya <span className="text-acc-teal">&gt;&gt;</span> Hub
          </Link>
          <div className="flex items-center gap-4">
            {isHrAdmin && (
              <Link
                href="/admin"
                className="text-sm font-semibold text-tx-2-c hover:text-tx-1-c"
              >
                Admin
              </Link>
            )}
            <div className="text-right">
              <p className="text-sm font-semibold text-tx-1-c">
                {hubUser?.full_name ?? user.email}
              </p>
              {isHrAdmin && (
                <p className="text-xs text-acc-teal">HR admin</p>
              )}
            </div>
            <SignOutButton email={hubUser?.email ?? user.email ?? ""} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
