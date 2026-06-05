import { prisma } from "@/lib/prisma";
import { NewRoundClient } from "./NewRoundClient";
import { BackLink } from "@/components/BackLink";
import { requireUser } from "@/lib/auth";
import { canEditPensioner } from "@/lib/permissions";
import { getCachedPayments, getCachedPostmen } from "@/lib/queries";

export default async function NewRoundPage() {
  const me = await requireUser();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [pensioners, payments, postmen, monthPayments] = await Promise.all([
    prisma.pensioner.findMany({
      orderBy: { fullName: "asc" },
      include: { building: true },
    }),
    getCachedPayments(),
    getCachedPostmen(),
    prisma.currentPayment.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "asc" },
    }),
  ]);

  const editablePensioners = pensioners.filter((p) => canEditPensioner(me, p));

  const plainPensioners = editablePensioners.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    address: `${p.building.street}, ${p.building.number}${p.apartment ? `, кв. ${p.apartment}` : ""}`,
    pensionPaymentDay: p.pensionPaymentDay,
    postmanId: p.postmanId,
    buildingStreet: p.building.street,
    buildingNumber: p.building.number,
    buildingLatitude: p.building.latitude,
    buildingLongitude: p.building.longitude,
  }));

  const pensionerMonthPayments: Record<
    number,
    { id: number; paymentId: number; amount: number; isPaid: boolean; roundId: number | null }[]
  > = {};
  const pensionerUnpaidCpDays: Record<number, number[]> = {};
  for (const cp of monthPayments) {
    if (cp.isPaid) continue;
    if (!pensionerMonthPayments[cp.pensionerId]) pensionerMonthPayments[cp.pensionerId] = [];
    pensionerMonthPayments[cp.pensionerId].push({
      id: cp.id,
      paymentId: cp.paymentId,
      amount: cp.amount,
      isPaid: cp.isPaid,
      roundId: cp.roundId,
    });
    const day = cp.date.getDate();
    if (!pensionerUnpaidCpDays[cp.pensionerId]) pensionerUnpaidCpDays[cp.pensionerId] = [];
    if (!pensionerUnpaidCpDays[cp.pensionerId].includes(day)) {
      pensionerUnpaidCpDays[cp.pensionerId].push(day);
    }
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
        pensionerUnpaidCpDays={pensionerUnpaidCpDays}
        isAdmin={me.isAdmin}
      />
    </div>
  );
}
