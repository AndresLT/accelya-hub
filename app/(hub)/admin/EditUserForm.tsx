"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Edit a user's name and position (UC7). The email is intentionally not
 * editable: it's the primary key referenced by bookings/app access and,
 * once the person has signed in, it's linked to auth.users — changing it
 * safely is out of scope, so HR must enter it correctly at creation.
 *
 * The update goes through the browser client (RLS: "hr_admin can manage
 * hub_users"). Rendered in a portal so the modal isn't clipped by the table.
 */
export function EditUserForm({
  email,
  fullName,
  position,
}: {
  email: string;
  fullName: string;
  position: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fullName);
  const [pos, setPos] = useState(position);
  const [loading, setLoading] = useState(false);

  function openModal() {
    setName(fullName);
    setPos(position);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Full name is required.");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("hub_users")
      .update({ full_name: name.trim(), position: pos.trim() || null })
      .eq("email", email);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("User updated.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="mt-1 text-xs font-semibold text-acc-blue hover:underline"
      >
        Edit
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div
              className="fixed inset-0"
              style={{ backgroundColor: "rgba(13, 17, 20, 0.45)" }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <form
              onSubmit={handleSubmit}
              className="relative z-50 w-full max-w-md rounded-xl border border-bg-3 bg-bg-1 p-5 shadow-lg"
            >
              <h2 className="font-heading text-base font-semibold text-tx-1">
                Edit user
              </h2>
              <p className="mb-4 text-xs text-tx-3">{email}</p>

              <label
                htmlFor="edit-name"
                className="mb-1.5 block text-sm font-semibold text-tx-2"
              >
                Full name
              </label>
              <input
                id="edit-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mb-4 w-full rounded-lg border border-bg-3 bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-acc-blue"
              />

              <label
                htmlFor="edit-position"
                className="mb-1.5 block text-sm font-semibold text-tx-2"
              >
                Position <span className="font-normal text-tx-3">(optional)</span>
              </label>
              <input
                id="edit-position"
                type="text"
                value={pos}
                onChange={(e) => setPos(e.target.value)}
                placeholder="People Operations Specialist"
                className="mb-1 w-full rounded-lg border border-bg-3 bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-acc-blue"
              />

              <div className="mt-5 flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-acc-blue px-4 py-2.5 text-sm font-semibold text-tx-1-c disabled:opacity-50"
                >
                  {loading ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-bg-3 px-4 py-2.5 text-sm font-semibold text-tx-2 hover:bg-bg-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
