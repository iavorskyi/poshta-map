import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatUAH } from "@/lib/format";

export const dynamic = "force-dynamic";

type Tab = "pension" | "address";

export default async function RoundsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = sp.tab === "address" ? "address" : "pension";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Обходи</h1>

      <div className="border-b border-slate-200 flex gap-1 -mb-px">
        <TabLink active={tab === "pension"} href="/rounds" label="Пенсія" />
        <TabLink
          active={tab === "address"}
          href="/rounds?tab=address"
          label="По-адресні"
        />
      </div>

      {tab === "pension" ? <PensionTab /> : <AddressTab />}
    </div>
  );
}

function TabLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  const cls = active
    ? "border-blue-600 text-blue-700"
    : "border-transparent text-slate-600 hover:text-slate-900";
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm border-b-2 ${cls}`}
    >
      {label}
    </Link>
  );
}

async function PensionTab() {
  const rounds = await prisma.round.findMany({
    orderBy: [{ closedAt: { sort: "asc", nulls: "first" } }, { date: "desc" }],
    include: {
      postman: true,
      currentPayments: { select: { amount: true, isPaid: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
                    className={`block rounded-lg border p-3 active:bg-slate-50 ${
                      r.closedAt ? "border-slate-200 bg-slate-50/60" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-blue-700">{formatDate(r.date)}</div>
                          {r.closedAt && (
                            <span className="rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-xs">
                              Закритий
                            </span>
                          )}
                        </div>
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
                    <tr
                      key={r.id}
                      className={`border-t border-slate-100 hover:bg-slate-50 ${
                        r.closedAt ? "text-slate-500" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Link href={`/rounds/${r.id}`} className="text-blue-700 hover:underline">
                            {formatDate(r.date)}
                          </Link>
                          {r.closedAt && (
                            <span className="rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-xs">
                              Закритий
                            </span>
                          )}
                        </div>
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

async function AddressTab() {
  const rounds = await prisma.addressRound.findMany({
    orderBy: [{ closedAt: { sort: "asc", nulls: "first" } }, { date: "desc" }],
    include: {
      postman: true,
      _count: { select: { items: true } },
      items: { select: { done: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/rounds/address/new"
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
        >
          + Новий обхід
        </Link>
      </div>

      {rounds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
          Ще немає по-адресних обходів
        </div>
      ) : (
        <ul className="space-y-2">
          {rounds.map((r) => {
            const total = r.items.length;
            const done = r.items.filter((i) => i.done).length;
            return (
              <li key={r.id}>
                <Link
                  href={`/rounds/address/${r.id}`}
                  className={`block rounded-lg border p-3 hover:bg-slate-50 ${
                    r.closedAt ? "border-slate-200 bg-slate-50/60" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-blue-700">{formatDate(r.date)}</div>
                        {r.closedAt && (
                          <span className="rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-xs">
                            Закритий
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 mt-0.5">
                        {r.postman?.name ?? "без поштаря"} · будинків: {total}
                      </div>
                      {r.notes && (
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">{r.notes}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <div className="text-xs text-green-700">пройдено {done}/{total}</div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
