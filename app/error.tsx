"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Global error boundary. Catches errors thrown outside the Hub pages'
 * boundary — for example while the (hub) layout loads the current user.
 * Must be a Client Component.
 */
export default function GlobalError({
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
      message="An unexpected error occurred. Please try again."
      onRetry={reset}
    />
  );
}
