"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type App = { id: string; name: string };

type Props = {
  userEmail: string;
  apps: App[];
  assignedAppIds: string[];
};

const POPOVER_WIDTH = 256; // matches w-64

/**
 * Per-user app assignment (UC8 / US3.3): a dropdown of checkboxes with a
 * "Select all" option. On save we diff the current selection against what
 * was assigned and apply only the changes (insert added, delete removed)
 * via the browser client (RLS: "hr_admin can manage app access"). The
 * change shows up in the user's catalog on their next Hub load.
 *
 * The popover is rendered through a portal to document.body so it is not
 * clipped by the table's `overflow-x-auto` container.
 */
export function AppAccessControl({ userEmail, apps, assignedAppIds }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
  }>({ left: 0, top: 0 });
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(assignedAppIds),
  );
  const [saving, setSaving] = useState(false);

  if (apps.length === 0) {
    return <span className="text-xs text-tx-3">No apps in catalog</span>;
  }

  function openPopover() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const margin = 8;
      const left = Math.min(
        Math.max(margin, rect.right - POPOVER_WIDTH),
        window.innerWidth - POPOVER_WIDTH - margin,
      );
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Flip the popover above the trigger when there isn't room below it
      // (e.g. rows near the bottom of the screen) but there is room above.
      if (spaceBelow < 280 && spaceAbove > spaceBelow) {
        setPos({ left, bottom: window.innerHeight - rect.top + 4 });
      } else {
        setPos({ left, top: rect.bottom + 4 });
      }
    }
    // Always reflect the latest server state when opening.
    setChecked(new Set(assignedAppIds));
    setOpen(true);
  }

  function toggle(appId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  }

  const allSelected = checked.size === apps.length;

  function toggleAll() {
    setChecked(allSelected ? new Set() : new Set(apps.map((a) => a.id)));
  }

  async function save() {
    const initial = new Set(assignedAppIds);
    const toAdd = [...checked].filter((id) => !initial.has(id));
    const toRemove = [...initial].filter((id) => !checked.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("user_app_access")
          .delete()
          .eq("user_email", userEmail)
          .in("app_id", toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const { error } = await supabase.from("user_app_access").insert(
          toAdd.map((appId) => ({
            user_email: userEmail,
            app_id: appId,
            granted_by: user?.id ?? null,
          })),
        );
        if (error) throw error;
      }

      toast.success(`App access updated for ${userEmail}.`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPopover}
        className="rounded-lg border border-bg-3 px-3 py-1.5 text-sm font-semibold text-tx-2 hover:bg-bg-2"
      >
        {assignedAppIds.length} of {apps.length} apps
      </button>

      {open &&
        createPortal(
          <>
            {/* Backdrop to catch outside clicks and close the popover. */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              className="fixed z-50 rounded-xl border border-bg-3 bg-bg-1 p-3 shadow-lg"
              style={{
                left: pos.left,
                top: pos.top,
                bottom: pos.bottom,
                width: POPOVER_WIDTH,
              }}
            >
              <label className="flex cursor-pointer items-center gap-2 border-b border-bg-3 pb-2 text-sm font-semibold text-tx-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 accent-acc-blue"
                />
                Select all
              </label>

              <div className="max-h-56 overflow-y-auto py-2">
                {apps.map((app) => (
                  <label
                    key={app.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-tx-1 hover:bg-bg-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(app.id)}
                      onChange={() => toggle(app.id)}
                      className="size-4 accent-acc-blue"
                    />
                    {app.name}
                  </label>
                ))}
              </div>

              <div className="flex gap-2 border-t border-bg-3 pt-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-acc-blue px-3 py-2 text-sm font-semibold text-tx-1-c disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-bg-3 px-3 py-2 text-sm font-semibold text-tx-2 hover:bg-bg-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
