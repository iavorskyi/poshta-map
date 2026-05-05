import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PensionerForm } from "../PensionerForm";
import { parseRange } from "@/lib/dateRange";
import { formatDate, formatUAH } from "@/lib/format";
import { CurrentPaymentsFilter } from "@/app/current-payments/CurrentPaymentsFilter";
import { CurrentPaymentsTable } from "@/app/current-payments/CurrentPaymentsTable";
import { AddCurrentPayment } from "@/app/current-payments/AddCurrentPayment";
import { BackLink } from "@/components/BackLink";

export default async function EditPensionerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const sp = await searchParams;
  const { from, to, fromStr, toStr } = parseRange(sp.from, sp.to);

  const [pensioner, payments, currentPayments, buildings, postmen] = await Promise.all([
    prisma.pensioner.findUnique({ where: { id } }),
    prisma.payment.findMany({ orderBy: { name: "asc" } }),
    prisma.currentPayment.findMany({
      where: { pensionerId: id, date: { gte: from, lte: to } },
      include: { pensioner: true, payment: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.building.findMany({ orderBy: [{ street: "asc" }, { number: "asc" }] }),
    prisma.postman.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!pensioner) notFound();

  const totals = {
    planned: currentPayments.reduce((s, it) => s + it.amount, 0),
    paid: currentPayments.filter((i) => i.isPaid).reduce((s, it) => s + it.amount, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <BackLink fallbackHref="/pensioners" fallbackLabel="До списку" />
        <h1 className="text-2xl font-semibold mt-1">{pensioner.fullName}</h1>
      </div>

      <PensionerForm
        pensioner={{
          id: pensioner.id,
          fullName: pensioner.fullName,
          buildingId: pensioner.buildingId,
          apartment: pensioner.apartment,
          phone: pensioner.phone,
          passportNumber: pensioner.passportNumber,
          pensionPaymentDay: pensioner.pensionPaymentDay,
          postmanId: pensioner.postmanId,
          notes: pensioner.notes,
        }}
        buildings={buildings.map((b) => ({ id: b.id, street: b.street, number: b.number }))}
        postmen={postmen}
      />

      <div className="space-y-3 pt-4 border-t border-border">
        <div>
          <h2 className="text-lg font-semibold">Поточні виплати</h2>
          <p className="text-sm text-fg-muted">
            Період: {formatDate(from)} — {formatDate(to)}. Разом заплановано{" "}
            <strong>{formatUAH(totals.planned)}</strong>, виплачено{" "}
            <strong className="text-success">{formatUAH(totals.paid)}</strong>, залишок{" "}
            <strong className="text-warning">{formatUAH(totals.planned - totals.paid)}</strong>
            .
          </p>
        </div>

        <CurrentPaymentsFilter
          fromStr={fromStr}
          toStr={toStr}
          pensionerId={null}
          pensioners={[]}
          mode="pensioner"
          pensionerIdForLink={id}
        />

        <AddCurrentPayment
          pensioners={[{ id: pensioner.id, fullName: pensioner.fullName }]}
          payments={payments}
          defaultDate={fromStr}
          defaultPensionerId={pensioner.id}
        />

        {currentPayments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle text-sm">
            У вибраному періоді виплат немає.
          </div>
        ) : (
          <CurrentPaymentsTable
            items={currentPayments.map((it) => ({
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
        )}
      </div>
    </div>
  );
}
