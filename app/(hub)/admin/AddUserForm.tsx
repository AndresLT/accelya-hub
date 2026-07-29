"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Role = "employee" | "hr_admin";

/**
 * Add a new Hub user (UC7 / US3.1). Inserting the row is enough to grant
 * access: the person can request an OTP immediately (is_active defaults to
 * true). RLS ("hr_admin can manage hub_users") authorizes the insert.
 */
export function AddUserForm() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [loading, setLoading] = useState(false);

  function reset() {
    setEmail("");
    setFullName("");
    setPosition("");
    setRole("employee");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@accelya.com")) {
      toast.error("Use a corporate @accelya.com email address.");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("hub_users").insert({
        email: normalizedEmail,
        full_name: fullName.trim(),
        position: position.trim() || null,
        role,
        created_by: user?.id ?? null,
      });

      if (error) {
        // 23505 = unique_violation (email already exists).
        toast.error(
          error.code === "23505"
            ? "A user with this email already exists."
            : error.message,
        );
        return;
      }

      toast.success(`${normalizedEmail} can now access the Hub.`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-acc-blue px-4 py-2.5 text-sm font-semibold text-tx-1-c"
      >
        Add user
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-bg-3 bg-bg-1 p-5"
    >
      <h2 className="mb-4 font-heading text-base font-semibold text-tx-1">
        Add user
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="new-email"
            className="mb-1.5 block text-sm font-semibold text-tx-2"
          >
            Corporate email
          </label>
          <input
            id="new-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name.surname@accelya.com"
            className="w-full rounded-lg border border-bg-3 bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-acc-blue"
          />
        </div>

        <div>
          <label
            htmlFor="new-name"
            className="mb-1.5 block text-sm font-semibold text-tx-2"
          >
            Full name
          </label>
          <input
            id="new-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full rounded-lg border border-bg-3 bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-acc-blue"
          />
        </div>

        <div>
          <label
            htmlFor="new-position"
            className="mb-1.5 block text-sm font-semibold text-tx-2"
          >
            Position <span className="font-normal text-tx-3">(optional)</span>
          </label>
          <input
            id="new-position"
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="People Operations Specialist"
            className="w-full rounded-lg border border-bg-3 bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-acc-blue"
          />
        </div>

        <div>
          <label
            htmlFor="new-role"
            className="mb-1.5 block text-sm font-semibold text-tx-2"
          >
            Role
          </label>
          <select
            id="new-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-bg-3 bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-acc-blue"
          >
            <option value="employee">Employee</option>
            <option value="hr_admin">HR admin</option>
          </select>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-acc-blue px-4 py-2.5 text-sm font-semibold text-tx-1-c disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add user"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-lg border border-bg-3 px-4 py-2.5 text-sm font-semibold text-tx-2 hover:bg-bg-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
