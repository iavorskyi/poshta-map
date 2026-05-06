import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ImportPensioners } from "./ImportPensioners";
import { requireUser } from "@/lib/auth";

export default async function PensionersPage() {
  const me = await requireUser();
  const pensioners = await prisma.pensioner.findMany({
    orderBy: { fullName: "asc" },
    include: {
      _count: { select: { currentPayments: true } },
      building: true,
      postman: true,
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
          {me.isAdmin && <ImportPensioners />}
          <Link
            href="/pensioners/new"
            className="btn-primary"
          >
            + Додати пенсіонера
          </Link>
        </div>
      </div>

      {pensioners.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle">
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
                  className="block card p-3 active:bg-elevated transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-link truncate">{p.fullName}</div>
                      <div className="text-sm text-fg-muted mt-0.5">{formatAddress(p)}</div>
                      <div className="text-xs text-fg-subtle mt-0.5">
                        {p.phone ?? "без телефону"} · пенсія {p.pensionPaymentDay}-го
                        {p.postman ? ` · ${p.postman.name}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-xs text-fg-muted">
                      {p._count.currentPayments} виплат
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-fg-muted">
                <tr>
                  <th className="text-left px-3 py-2">ФІО</th>
                  <th className="text-left px-3 py-2">Адреса</th>
                  <th className="text-left px-3 py-2">Телефон</th>
                  <th className="text-left px-3 py-2">День пенсії</th>
                  <th className="text-left px-3 py-2">Поштар</th>
                  <th className="text-left px-3 py-2">Виплат</th>
                </tr>
              </thead>
              <tbody>
                {pensioners.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-elevated">
                    <td className="px-3 py-2">
                      <Link href={`/pensioners/${p.id}`} className="text-link hover:text-link-hover hover:underline">
                        {p.fullName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{formatAddress(p)}</td>
                    <td className="px-3 py-2">{p.phone ?? "—"}</td>
                    <td className="px-3 py-2">{p.pensionPaymentDay}</td>
                    <td className="px-3 py-2">{p.postman?.name ?? "—"}</td>
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
