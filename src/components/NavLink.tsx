"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "text-fg font-medium border-b-2 border-brand py-1 -mb-px transition-colors"
          : "text-fg-muted hover:text-fg border-b-2 border-transparent py-1 -mb-px transition-colors"
      }
    >
      {children}
    </Link>
  );
}
