"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-runs the current route's Server Components to pull fresh data on
 * demand (soft refresh, no full page reload). Shows a spinning state while
 * the refresh is in flight.
 */
export function RefreshButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startRefresh(() => router.refresh())}
      disabled={disabled || isRefreshing}
      className="inline-flex items-center gap-1.5 rounded-lg border border-bg-3 px-3 py-2 text-sm font-semibold text-tx-2 hover:bg-bg-2 disabled:opacity-50"
    >
      <span aria-hidden className={isRefreshing ? "animate-spin" : ""}>
        &#8635;
      </span>
      {isRefreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
}
