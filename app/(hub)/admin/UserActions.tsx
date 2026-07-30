"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Role = "employee" | "hr_admin";

type Props = {
  email: string;
  role: Role;
  isActive: boolean;
  /** True when this row is the signed-in admin (self-actions are blocked). */
  isSelf: boolean;
  /** Which control this instance renders. */
  control: "role" | "status";
};

/**
 * Per-user role select and active/inactive toggle (UC7). Mutations go
 * through the browser client (RLS: "hr_admin can manage hub_users") and
 * refresh the server-rendered table. Admins cannot change their own role
 * or disable themselves, to avoid locking themselves out.
 *
 * Disabling a user takes effect on their next request: the middleware
 * checks is_active on every request and signs out inactive users.
 */
export function UserActions({ email, role, isActive, isSelf, control }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function updateRole(next: Role) {
    if (next === role) return;
    setLoading(true);
    const { error } = await supabase
      .from("hub_users")
      .update({ role: next })
      .eq("email", email);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `${email} is now ${next === "hr_admin" ? "an HR admin" : "an employee"}.`,
    );
    router.refresh();
  }

  async function toggleActive() {
    setLoading(true);
    const next = !isActive;
    const { error } = await supabase
      .from("hub_users")
      .update({ is_active: next })
      .eq("email", email);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      next ? `${email} was enabled.` : `${email} was disabled.`,
    );
    router.refresh();
  }

  if (control === "role") {
    return (
      <select
        value={role}
        disabled={loading || isSelf}
        title={isSelf ? "You can't change your own role." : undefined}
        onChange={(e) => updateRole(e.target.value as Role)}
        className="rounded-lg border border-bg-3 bg-bg-1 px-2.5 py-1.5 text-sm outline-none focus:border-acc-blue disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="employee">Employee</option>
        <option value="hr_admin">HR admin</option>
      </select>
    );
  }

  return (
    <button
      type="button"
      disabled={loading || isSelf}
      title={isSelf ? "You can't disable your own account." : undefined}
      onClick={toggleActive}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
        isActive
          ? "bg-success-bg text-success-tx"
          : "bg-error-bg text-error-tx"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </button>
  );
}
