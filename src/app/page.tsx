import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const [pensioners, payments, rounds, currentPayments, postmen] = await Promise.all([
    prisma.pensioner.count(),
    prisma.payment.count(),
    prisma.round.count(),
    prisma.currentPayment.count(),
    prisma.postman.count(),
  ]);

  const cards = [
    { href: "/rounds", title: "Обходи", count: rounds, hint: "Сформувати денний обхід" },
    {
      href: "/current-payments",
      title: "Поточні виплати",
      count: currentPayments,
      hint: "Усі виплати з фільтром по датах",
    },
    { href: "/pensioners", title: "Пенсіонери", count: pensioners, hint: "База пенсіонерів" },
    { href: "/payments", title: "Типи виплат", count: payments, hint: "Довідник виплат" },
    { href: "/postmen", title: "Поштарі", count: postmen, hint: "Хто йде в обхід" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Головна</h1>
        <p className="text-slate-600 mt-1">
          Сервіс для рутинних задач поштаря — облік пенсіонерів, їх виплат і щоденні обходи.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm transition"
          >
            <div className="text-sm text-slate-500">{c.hint}</div>
            <div className="text-lg font-medium mt-1">{c.title}</div>
            <div className="text-3xl font-semibold mt-2">{c.count}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
