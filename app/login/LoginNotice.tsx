"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Shows a one-off toast on /login explaining why the user landed here,
 * based on the `reason` the middleware appended when it signed them out.
 * Renders nothing itself. A stable toast id avoids a duplicate under
 * React StrictMode's double-invoked effects in development.
 */
export function LoginNotice({ reason }: { reason?: string }) {
  useEffect(() => {
    if (reason === "revoked") {
      toast.error("Your Hub access was revoked. Please contact HR.", {
        id: "login-notice",
      });
    } else if (reason === "expired") {
      toast.warning("Your session expired. Please sign in again.", {
        id: "login-notice",
      });
    }
  }, [reason]);

  return null;
}
