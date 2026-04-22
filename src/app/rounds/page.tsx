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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Обходи</h1>
        <Link
          href="/rounds/new"
          className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"
        >
          + Новий обхід
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
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
            {rounds.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Ще немає обходів
                </td>
              </tr>
            )}
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
    </div>
  );
}
