import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { formatDate, formatUAH } from "@/lib/format";
import { parseRange } from "@/lib/dateRange";
import { CurrentPaymentsFilter } from "./CurrentPaymentsFilter";
import { CurrentPaymentsTable, type SortKey } from "./CurrentPaymentsTable";
import { AddCurrentPayment } from "./AddCurrentPayment";
import { ImportCurrentPayments } from "./ImportCurrentPayments";
import { requireUser } from "@/lib/auth";
import { canEditCurrentPayment, canEditPensioner } from "@/lib/permissions";
import { getCachedPayments } from "@/lib/queries";

const SORT_KEYS: SortKey[] = [
  "date",
  "pensioner",
  "payment",
  "amount",
  "postman",
  "paid",
];

function parseSort(raw: string | undefined): SortKey {
  return SORT_KEYS.includes(raw as SortKey) ? (raw as SortKey) : "date";
}

function parseDir(raw: string | undefined): "asc" | "desc" {
  return raw === "desc" ? "desc" : "asc";
}

export default async function CurrentPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    pensionerId?: string;
    paymentId?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;
  const { from, to, fromStr, toStr } = parseRange(sp.from, sp.to);
  const pensionerId = sp.pensionerId ? Number(sp.pensionerId) : null;
  const paymentId = sp.paymentId ? Number(sp.paymentId) : null;
  const sort = parseSort(sp.sort);
  const dir = parseDir(sp.dir);

  const orderBy: Prisma.CurrentPaymentOrderByWithRelationInput[] = (() => {
    switch (sort) {
      case "pensioner":
        return [{ pensioner: { fullName: dir } }, { date: "asc" }, { id: "asc" }];
      case "payment":
        return [{ payment: { name: dir } }, { date: "asc" }, { id: "asc" }];
      case "amount":
        return [{ amount: dir }, { date: "asc" }, { id: "asc" }];
      case "postman":
        return [
          { pensioner: { postman: { name: dir } } },
          { date: "asc" },
          { id: "asc" },
        ];
      case "paid":
        return [{ isPaid: dir }, { date: "asc" }, { id: "asc" }];
      case "date":
      default:
        return [{ date: dir }, { id: "asc" }];
    }
  })();

  const [items, pensioners, payments] = await Promise.all([
    prisma.currentPayment.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(pensionerId ? { pensionerId } : {}),
        ...(paymentId ? { paymentId } : {}),
      },
      include: {
        pensioner: {
          select: {
            id: true,
            fullName: true,
            postmanId: true,
            postman: { select: { id: true, name: true } },
          },
        },
        payment: true,
        round: { select: { id: true, postmanId: true } },
      },
      orderBy,
    }),
    prisma.pensioner.findMany({ orderBy: { fullName: "asc" } }),
    getCachedPayments(),
  ]);

  const totals = {
    planned: items.reduce((s, it) => s + it.amount, 0),
    paid: items.filter((i) => i.isPaid).reduce((s, it) => s + it.amount, 0),
  };

  const editablePensioners = pensioners.filter((p) => canEditPensioner(me, p));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Поточні виплати</h1>
        {me.isAdmin && <ImportCurrentPayments payments={payments} />}
      </div>

      <CurrentPaymentsFilter
        fromStr={fromStr}
        toStr={toStr}
        pensionerId={pensionerId}
        pensioners={pensioners.map((p) => ({ id: p.id, fullName: p.fullName }))}
        paymentId={paymentId}
        payments={payments.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <Stat title="Виплат" value={String(items.length)} />
        <Stat title="Заплановано" value={formatUAH(totals.planned)} />
        <Stat title="Виплачено" value={formatUAH(totals.paid)} tone="success" />
        <Stat title="Залишок" value={formatUAH(totals.planned - totals.paid)} tone="warning" />
      </div>

      {editablePensioners.length > 0 && (
        <AddCurrentPayment
          pensioners={editablePensioners.map((p) => ({ id: p.id, fullName: p.fullName }))}
          payments={payments}
          defaultDate={fromStr}
          defaultPensionerId={pensionerId}
          isAdmin={me.isAdmin}
        />
      )}

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
          postmanName: it.pensioner.postman?.name ?? null,
          canEdit: canEditCurrentPayment(me, {
            round: it.round,
            pensioner: it.pensioner,
          }),
        }))}
        sort={sort}
        dir={dir}
      />

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle text-sm">
          У вибраному періоді виплат немає.{" "}
          <Link href="/rounds/new" className="link">
            Створити обхід
          </Link>{" "}
          або додайте виплату вручну вище.
        </div>
      )}

      <div className="text-xs text-fg-subtle">
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
  tone?: "success" | "warning";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : "text-fg";
  return (
    <div className="card p-3 md:p-4">
      <div className="text-xs text-fg-subtle">{title}</div>
      <div className={`text-base md:text-xl font-semibold mt-1 ${color} truncate`}>{value}</div>
    </div>
  );
}
