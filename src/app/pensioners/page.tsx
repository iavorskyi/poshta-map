import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ImportPensioners } from "./ImportPensioners";

export const dynamic = "force-dynamic";

export default async function PensionersPage() {
  const pensioners = await prisma.pensioner.findMany({
    orderBy: { fullName: "asc" },
    include: {
      _count: { select: { currentPayments: true } },
      building: true,
    },
  });

  const formatAddress = (p: (typeof pensioners)[number]) => {
    const apt = p.apartment ? `, кв. ${p.apartment}` : "";
    return `${p.building.street}, ${p.building.number}${apt}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Пенсіонери</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportPensioners />
          <Link
            href="/pensioners/new"
            className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
          >
            + Додати пенсіонера
          </Link>
        </div>
      </div>

      {pensioners.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
          Ще немає пенсіонерів
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="md:hidden space-y-2">
            {pensioners.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pensioners/${p.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-3 active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-blue-700 truncate">{p.fullName}</div>
                      <div className="text-sm text-slate-600 mt-0.5">{formatAddress(p)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.phone ?? "без телефону"} · пенсія {p.pensionPaymentDay}-го
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {p._count.currentPayments} виплат
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-lg border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">ФІО</th>
                  <th className="text-left px-3 py-2">Адреса</th>
                  <th className="text-left px-3 py-2">Телефон</th>
                  <th className="text-left px-3 py-2">День пенсії</th>
                  <th className="text-left px-3 py-2">Виплат</th>
                </tr>
              </thead>
              <tbody>
                {pensioners.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={`/pensioners/${p.id}`} className="text-blue-700 hover:underline">
                        {p.fullName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{formatAddress(p)}</td>
                    <td className="px-3 py-2">{p.phone ?? "—"}</td>
                    <td className="px-3 py-2">{p.pensionPaymentDay}</td>
                    <td className="px-3 py-2">{p._count.currentPayments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
