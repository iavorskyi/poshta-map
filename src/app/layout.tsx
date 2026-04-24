import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Поштар — облік пенсіонерів і виплат",
  description: "Сервіс для рутинних задач поштаря",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <nav className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-3 sm:gap-6">
            <Link href="/" className="font-semibold text-lg shrink-0">
              Поштар
            </Link>
            <div className="flex items-center gap-3 sm:gap-4 text-sm overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 whitespace-nowrap">
              <Link href="/rounds" className="hover:text-blue-600 py-1">
                Обходи
              </Link>
              <Link href="/current-payments" className="hover:text-blue-600 py-1">
                Виплати
              </Link>
              <Link href="/pensioners" className="hover:text-blue-600 py-1">
                Пенсіонери
              </Link>
              <Link href="/payments" className="hover:text-blue-600 py-1">
                Типи
              </Link>
              <Link href="/postmen" className="hover:text-blue-600 py-1">
                Поштарі
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
