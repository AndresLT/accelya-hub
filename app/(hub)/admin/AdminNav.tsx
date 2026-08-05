"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Users" },
  { href: "/admin/parking", label: "Parking" },
  { href: "/admin/desks", label: "Desks" },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/logs", label: "Access log" },
] as const;

/**
 * Secondary navigation for the admin section. Client Component because it
 * uses the current pathname to highlight the active tab.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-bg-3">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "border-acc-blue text-acc-blue"
                : "border-transparent text-tx-3 hover:text-tx-1"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
