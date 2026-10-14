"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/", label: "Controls" },
  { href: "/tests", label: "Tests" },
  { href: "/trends", label: "Trends" },
  { href: "/tags", label: "Tags" },
  { href: "/connections", label: "Connections" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="w-full max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        <span className="font-semibold text-sm tracking-tight">Compliance Tracker</span>
        <nav className="flex gap-1">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
