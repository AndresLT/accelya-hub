"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Error boundary for the Hub pages (catalog, admin). Catches errors thrown
 * while rendering a page — e.g. a failed Supabase query — and shows a
 * friendly retry UI instead of a broken screen. Must be a Client Component.
 */
export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      message="We couldn't load this page. Please try again in a moment."
      onRetry={reset}
    />
  );
}
