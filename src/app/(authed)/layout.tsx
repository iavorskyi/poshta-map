import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AuthedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const me = await requireUser();

  return (
    <>
      <header className="bg-surface border-b border-border sticky top-0 z-20">
        <nav className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-3 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-fg font-bold text-sm"
              aria-hidden="true"
            >
              П
            </span>
            <span className="font-semibold text-lg">Поштар</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4 text-sm overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 whitespace-nowrap flex-1">
            <Link
              href="/rounds"
              className="text-fg-muted hover:text-fg transition-colors py-1"
            >
              Обходи
            </Link>
            <Link
              href="/district"
              className="text-fg-muted hover:text-fg transition-colors py-1"
            >
              Дільниця
            </Link>
            <Link
              href="/current-payments"
              className="text-fg-muted hover:text-fg transition-colors py-1"
            >
              Виплати
            </Link>
            <Link
              href="/pensioners"
              className="text-fg-muted hover:text-fg transition-colors py-1"
            >
              Пенсіонери
            </Link>
            {me.isAdmin && (
              <>
                <Link
                  href="/payments"
                  className="text-fg-muted hover:text-fg transition-colors py-1"
                >
                  Типи
                </Link>
                <Link
                  href="/postmen"
                  className="text-fg-muted hover:text-fg transition-colors py-1"
                >
                  Листоноші
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/profile"
              className="hidden sm:flex items-center gap-2 text-sm text-fg-muted hover:text-fg transition-colors"
              title="Профіль"
            >
              <span className="font-medium">{me.name}</span>
              {me.isAdmin && (
                <span className="rounded-full bg-brand text-brand-fg px-2 py-0.5 text-xs font-medium">
                  Адмін
                </span>
              )}
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
    </>
  );
}
