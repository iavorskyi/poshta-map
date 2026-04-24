import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatUAH } from "@/lib/format";
import { parseRange } from "@/lib/dateRange";
import { CurrentPaymentsFilter } from "./CurrentPaymentsFilter";
import { CurrentPaymentsTable } from "./CurrentPaymentsTable";
import { AddCurrentPayment } from "./AddCurrentPayment";

export const dynamic = "force-dynamic";

export default async function CurrentPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; pensionerId?: string }>;
}) {
  const sp = await searchParams;
  const { from, to, fromStr, toStr } = parseRange(sp.from, sp.to);
  const pensionerId = sp.pensionerId ? Number(sp.pensionerId) : null;

  const [items, pensioners, payments] = await Promise.all([
    prisma.currentPayment.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(pensionerId ? { pensionerId } : {}),
      },
      include: { pensioner: true, payment: true, round: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.pensioner.findMany({ orderBy: { fullName: "asc" } }),
    prisma.payment.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totals = {
    planned: items.reduce((s, it) => s + it.amount, 0),
    paid: items.filter((i) => i.isPaid).reduce((s, it) => s + it.amount, 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Поточні виплати</h1>
      </div>

      <CurrentPaymentsFilter
        fromStr={fromStr}
        toStr={toStr}
        pensionerId={pensionerId}
        pensioners={pensioners.map((p) => ({ id: p.id, fullName: p.fullName }))}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <Stat title="Виплат" value={String(items.length)} />
        <Stat title="Заплановано" value={formatUAH(totals.planned)} />
        <Stat title="Виплачено" value={formatUAH(totals.paid)} tone="green" />
        <Stat title="Залишок" value={formatUAH(totals.planned - totals.paid)} tone="orange" />
      </div>

      <AddCurrentPayment
        pensioners={pensioners.map((p) => ({ id: p.id, fullName: p.fullName }))}
        payments={payments}
        defaultDate={fromStr}
        defaultPensionerId={pensionerId}
      />

      <CurrentPaymentsTable
        items={items.map((it) => ({
          id: it.id,
          date: it.date.toISOString(),
          pensionerId: it.pensionerId,
          pensionerName: it.pensioner.fullName,
          paymentName: it.payment.name,
          paymentCode: it.payment.code,
          amount: it.amount,
          isPaid: it.isPaid,
          roundId: it.roundId,
        }))}
      />

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 text-sm">
          У вибраному періоді виплат немає.{" "}
          <Link href="/rounds/new" className="text-blue-600 hover:underline">
            Створити обхід
          </Link>{" "}
          або додайте виплату вручну вище.
        </div>
      )}

      <div className="text-xs text-slate-500">
        Період: {formatDate(from)} — {formatDate(to)}
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: "green" | "orange";
}) {
  const color =
    tone === "green"
      ? "text-green-700"
      : tone === "orange"
      ? "text-orange-700"
      : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 md:p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className={`text-base md:text-xl font-semibold mt-1 ${color} truncate`}>{value}</div>
    </div>
  );
}
