"use client";

import { useRouter } from "next/navigation";

/**
 * Date selector for the admin parking occupancy view. Navigating updates
 * the `?date=` query param, which the Server Component reads to re-query.
 * Admins can pick any date (past or future), not just the booking window.
 */
export function ParkingDatePicker({
  value,
  today,
}: {
  value: string;
  today: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={value}
        onChange={(e) =>
          router.push(`/admin/parking?date=${e.target.value}`)
        }
        className="rounded-lg border border-bg-3 bg-bg-1 px-3 py-2 text-sm outline-none focus:border-acc-blue"
      />
      {value !== today && (
        <button
          type="button"
          onClick={() => router.push("/admin/parking")}
          className="rounded-lg border border-bg-3 px-3 py-2 text-sm font-semibold text-tx-2 hover:bg-bg-2"
        >
          Today
        </button>
      )}
    </div>
  );
}
