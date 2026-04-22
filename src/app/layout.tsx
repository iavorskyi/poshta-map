import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Поштар — облік пенсіонерів і виплат",
  description: "Сервіс для рутинних задач поштаря",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="bg-white border-b border-slate-200">
          <nav className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold text-lg">
              Поштар
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/rounds" className="hover:text-blue-600">
                Обходи
              </Link>
              <Link href="/pensioners" className="hover:text-blue-600">
                Пенсіонери
              </Link>
              <Link href="/payments" className="hover:text-blue-600">
                Типи виплат
              </Link>
              <Link href="/postmen" className="hover:text-blue-600">
                Поштарі
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
