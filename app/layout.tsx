import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/Toaster";

/*
 * Brand typefaces (Open Sans / Raleway) are declared as a CSS font stack
 * in globals.css for now. We intentionally do NOT use `next/font/google`
 * because the corporate network blocks Google Fonts at build time
 * (TLS handshake failure through the proxy).
 *
 * TODO: self-host the fonts with `next/font/local` once we have the
 * licensed .woff2 files (drop them in /app/fonts). That gives us the exact
 * brand typefaces with zero external requests at build or runtime.
 */
export const metadata: Metadata = {
  title: "Accelya Hub",
  description: "Internal applications hub for Accelya employees.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
