"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * App-wide toast host. Rendered once in the root layout so any Client
 * Component can call `toast.*` from "sonner" and have it show here.
 *
 * Branding: `richColors` turns on the success/error/warning/info palette,
 * which we retint to Accelya's semantic tokens in globals.css (see the
 * `[data-sonner-toaster]` overrides). Keep visual/config choices here so
 * every toast in the app looks the same.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        style: {
          fontFamily: "var(--font-sans)",
          borderRadius: "0.625rem",
        },
      }}
    />
  );
}
