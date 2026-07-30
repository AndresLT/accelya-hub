"use client";

import Link from "next/link";

/**
 * Shared, branded error UI used by the route error boundaries (error.tsx).
 * Offers an optional retry (re-renders the failed segment) and a link home.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  showHomeLink = true,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showHomeLink?: boolean;
}) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-bg-3 bg-bg-1 p-8 text-center">
      <h1 className="mb-2 font-heading text-lg font-bold text-tx-1">{title}</h1>
      <p className="mb-6 text-sm text-tx-3">{message}</p>
      <div className="flex items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-acc-blue px-4 py-2.5 text-sm font-semibold text-tx-1-c"
          >
            Try again
          </button>
        )}
        {showHomeLink && (
          <Link
            href="/"
            className="rounded-lg border border-bg-3 px-4 py-2.5 text-sm font-semibold text-tx-2 hover:bg-bg-2"
          >
            Back to Hub
          </Link>
        )}
      </div>
    </div>
  );
}
