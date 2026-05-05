import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Поштар — облік пенсіонерів і виплат",
  description: "Сервіс для рутинних задач поштаря",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Inline script to set theme class before paint to avoid FOUC.
const themeInitScript = `
(function(){try{var s=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s==='dark'||(!s&&m);if(d)document.documentElement.classList.add('dark');}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <ToastProvider>
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
                  Поштарі
                </Link>
              </div>
              <ThemeToggle />
            </nav>
          </header>
          <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
