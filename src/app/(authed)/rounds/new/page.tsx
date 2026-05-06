import { prisma } from "@/lib/prisma";
import { NewRoundClient } from "./NewRoundClient";
import { BackLink } from "@/components/BackLink";
import { requireUser } from "@/lib/auth";
import { canEditPensioner } from "@/lib/permissions";

export default async function NewRoundPage() {
  const me = await requireUser();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [pensioners, payments, postmen, monthPayments, allCps] = await Promise.all([
    prisma.pensioner.findMany({
      orderBy: { fullName: "asc" },
      include: { building: true },
    }),
    prisma.payment.findMany({ orderBy: { name: "asc" } }),
    prisma.postman.findMany({ orderBy: { name: "asc" } }),
    prisma.currentPayment.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.currentPayment.findMany({
      orderBy: { date: "desc" },
      select: { pensionerId: true, paymentId: true, amount: true },
    }),
  ]);

  const editablePensioners = pensioners.filter((p) => canEditPensioner(me, p));

  const plainPensioners = editablePensioners.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    address: `${p.building.street}, ${p.building.number}${p.apartment ? `, кв. ${p.apartment}` : ""}`,
    pensionPaymentDay: p.pensionPaymentDay,
  }));

  const pensionerMonthPayments: Record<
    number,
    { id: number; paymentId: number; amount: number; isPaid: boolean; roundId: number | null }[]
  > = {};
  const paidPaymentIdsByPensioner: Record<number, number[]> = {};
  for (const cp of monthPayments) {
    if (cp.isPaid) {
      if (!paidPaymentIdsByPensioner[cp.pensionerId])
        paidPaymentIdsByPensioner[cp.pensionerId] = [];
      paidPaymentIdsByPensioner[cp.pensionerId].push(cp.paymentId);
      continue;
    }
    if (!pensionerMonthPayments[cp.pensionerId]) pensionerMonthPayments[cp.pensionerId] = [];
    pensionerMonthPayments[cp.pensionerId].push({
      id: cp.id,
      paymentId: cp.paymentId,
      amount: cp.amount,
      isPaid: cp.isPaid,
      roundId: cp.roundId,
    });
  }

  const pensionerPaymentTemplates: Record<
    number,
    { paymentId: number; amount: number }[]
  > = {};
  const seenTemplate: Record<number, Set<number>> = {};
  for (const cp of allCps) {
    if (!seenTemplate[cp.pensionerId]) seenTemplate[cp.pensionerId] = new Set();
    if (seenTemplate[cp.pensionerId].has(cp.paymentId)) continue;
    seenTemplate[cp.pensionerId].add(cp.paymentId);
    if (!pensionerPaymentTemplates[cp.pensionerId])
      pensionerPaymentTemplates[cp.pensionerId] = [];
    pensionerPaymentTemplates[cp.pensionerId].push({
      paymentId: cp.paymentId,
      amount: cp.amount,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <BackLink fallbackHref="/rounds" fallbackLabel="До обходів" />
        <h1 className="text-2xl font-semibold mt-1">Новий обхід</h1>
      </div>
      <NewRoundClient
        pensioners={plainPensioners}
        payments={payments}
        postmen={postmen}
        pensionerMonthPayments={pensionerMonthPayments}
        pensionerPaymentTemplates={pensionerPaymentTemplates}
        paidPaymentIdsByPensioner={paidPaymentIdsByPensioner}
        isAdmin={me.isAdmin}
      />
    </div>
  );
}
