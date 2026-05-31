"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/subscriptions/publications", label: "Видання" },
  { href: "/subscriptions/subscribers", label: "Передплатники" },
];

export function SubscriptionsTabs() {
  const pathname = usePathname() ?? "";
  return (
    <div className="flex gap-1 border-b border-border text-sm">
      {TABS.map((t) => {
        const active =
          pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              active
                ? "px-3 py-2 border-b-2 border-brand text-fg font-medium -mb-px"
                : "px-3 py-2 border-b-2 border-transparent text-fg-muted hover:text-fg -mb-px"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
