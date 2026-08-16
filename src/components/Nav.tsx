"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/report", label: "Weekly Report" },
  { href: "/leads", label: "Walk-in Leads" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-charcoal/10 bg-white">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="Logo" className="h-7 object-contain" />
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                  active
                    ? "bg-charcoal text-white"
                    : "text-ink/60 hover:text-charcoal hover:bg-charcoal/5"
                }`}
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