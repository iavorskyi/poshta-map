import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatUAH } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RoundsPage() {
  const rounds = await prisma.round.findMany({
    orderBy: { date: "desc" },
    include: {
      postman: true,
      currentPayments: { select: { amount: true, isPaid: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Обходи</h1>
        <Link
          href="/rounds/new"
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
        >
          + Новий обхід
        </Link>
      </div>

      {rounds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
          Ще немає обходів
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="md:hidden space-y-2">
            {rounds.map((r) => {
              const planned = r.currentPayments.reduce((s, p) => s + p.amount, 0);
              const paid = r.currentPayments
                .filter((p) => p.isPaid)
                .reduce((s, p) => s + p.amount, 0);
              return (
                <li key={r.id}>
                  <Link
                    href={`/rounds/${r.id}`}
                    className="block rounded-lg border border-slate-200 bg-white p-3 active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-blue-700">{formatDate(r.date)}</div>
                        <div className="text-sm text-slate-600 mt-0.5">
                          {r.postman?.name ?? "без поштаря"} · {r.currentPayments.length} виплат
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        <div className="font-medium">{formatUAH(planned)}</div>
                        <div className="text-xs text-green-700">{formatUAH(paid)}</div>
                        <div className="text-xs text-orange-700">
                          залишок {formatUAH(planned - paid)}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-lg border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Дата</th>
                  <th className="text-left px-3 py-2">Поштар</th>
                  <th className="text-left px-3 py-2">Виплат</th>
                  <th className="text-right px-3 py-2">Заплановано</th>
                  <th className="text-right px-3 py-2">Виплачено</th>
                  <th className="text-right px-3 py-2">Залишок</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => {
                  const planned = r.currentPayments.reduce((s, p) => s + p.amount, 0);
                  const paid = r.currentPayments
                    .filter((p) => p.isPaid)
                    .reduce((s, p) => s + p.amount, 0);
                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <Link href={`/rounds/${r.id}`} className="text-blue-700 hover:underline">
                          {formatDate(r.date)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{r.postman?.name ?? "—"}</td>
                      <td className="px-3 py-2">{r.currentPayments.length}</td>
                      <td className="px-3 py-2 text-right">{formatUAH(planned)}</td>
                      <td className="px-3 py-2 text-right">{formatUAH(paid)}</td>
                      <td className="px-3 py-2 text-right">{formatUAH(planned - paid)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
