"use client";

import { useRouter } from "next/navigation";

/**
 * Date selector for admin occupancy views. Navigating updates the `?date=`
 * query param on `basePath`, which the Server Component reads to re-query.
 * Admins can pick any date (past or future), not just the booking window.
 */
export function AdminDatePicker({
  basePath,
  value,
  today,
}: {
  basePath: string;
  value: string;
  today: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={value}
        onChange={(e) => router.push(`${basePath}?date=${e.target.value}`)}
        className="rounded-lg border border-bg-3 bg-bg-1 px-3 py-2 text-sm outline-none focus:border-acc-blue"
      />
      {value !== today && (
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className="rounded-lg border border-bg-3 px-3 py-2 text-sm font-semibold text-tx-2 hover:bg-bg-2"
        >
          Today
        </button>
      )}
    </div>
  );
}
