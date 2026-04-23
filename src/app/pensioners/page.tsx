import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PensionersPage() {
  const pensioners = await prisma.pensioner.findMany({
    orderBy: { fullName: "asc" },
    include: { _count: { select: { currentPayments: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Пенсіонери</h1>
        <Link
          href="/pensioners/new"
          className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"
        >
          + Додати пенсіонера
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
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
            {pensioners.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Ще немає пенсіонерів
                </td>
              </tr>
            )}
            {pensioners.map((p) => (
              <tr
                key={p.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-3 py-2">
                  <Link href={`/pensioners/${p.id}`} className="text-blue-700 hover:underline">
                    {p.fullName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {p.street}, {p.house}
                  {p.apartment ? `, кв. ${p.apartment}` : ""}
                </td>
                <td className="px-3 py-2">{p.phone ?? "—"}</td>
                <td className="px-3 py-2">{p.pensionPaymentDay}</td>
                <td className="px-3 py-2">{p._count.currentPayments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
