import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatUAH } from "@/lib/format";
import { PrintActions } from "./PrintActions";

export const dynamic = "force-dynamic";

export default async function RoundPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      postman: true,
      currentPayments: {
        include: {
          pensioner: { include: { building: true } },
          payment: true,
        },
        orderBy: [{ pensioner: { fullName: "asc" } }, { id: "asc" }],
      },
    },
  });

  if (!round) notFound();

  // Group items by pensioner
  type Slip = {
    pensionerId: number;
    fullName: string;
    address: string;
    items: { id: number; name: string; code: string; amount: number; isPaid: boolean }[];
    total: number;
  };
  const map = new Map<number, Slip>();
  for (const cp of round.currentPayments) {
    let slip = map.get(cp.pensionerId);
    if (!slip) {
      slip = {
        pensionerId: cp.pensionerId,
        fullName: cp.pensioner.fullName,
        address: `${cp.pensioner.building.street}, ${cp.pensioner.building.number}${
          cp.pensioner.apartment ? `, кв. ${cp.pensioner.apartment}` : ""
        }`,
        items: [],
        total: 0,
      };
      map.set(cp.pensionerId, slip);
    }
    slip.items.push({
      id: cp.id,
      name: cp.payment.name,
      code: cp.payment.code,
      amount: cp.amount,
      isPaid: cp.isPaid,
    });
    slip.total += cp.amount;
  }
  const slips = Array.from(map.values());

  const dateStr = formatDate(round.date);
  const postmanName = round.postman?.name ?? "—";
  const postmanPhone = round.postman?.phone ?? null;

  return (
    <>
      <PrintActions roundDate={dateStr} />
      <div className="print-area">
        <div className="slip-grid">
          {slips.length === 0 ? (
            <div className="text-sm text-slate-500 p-4">
              У цьому обході немає виплат, нема що друкувати.
            </div>
          ) : (
            slips.map((s) => (
              <article key={s.pensionerId} className="slip">
                <header className="slip-header">
                  <div className="slip-meta">
                    Обхід {dateStr} · {postmanName}
                  </div>
                  {postmanPhone && (
                    <div className="slip-meta-phone">тел. {postmanPhone}</div>
                  )}
                  <div className="slip-name">{s.fullName}</div>
                  <div className="slip-addr">{s.address}</div>
                </header>
                <ul className="slip-items">
                  {s.items.map((it) => (
                    <li key={it.id}>
                      <span className="slip-item-name">
                        {it.name}{" "}
                        <span className="slip-item-code">({it.code})</span>
                      </span>
                      <span className="slip-item-amount">{formatUAH(it.amount)}</span>
                    </li>
                  ))}
                </ul>
                <footer className="slip-total">
                  <span>Разом</span>
                  <span className="slip-total-amount">{formatUAH(s.total)}</span>
                </footer>
              </article>
            ))
          )}
        </div>
      </div>
    </>
  );
}
