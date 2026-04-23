import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NewRoundClient } from "./NewRoundClient";

export const dynamic = "force-dynamic";

export default async function NewRoundPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [pensioners, payments, postmen, monthPayments] = await Promise.all([
    prisma.pensioner.findMany({ orderBy: { fullName: "asc" } }),
    prisma.payment.findMany({ orderBy: { name: "asc" } }),
    prisma.postman.findMany({ orderBy: { name: "asc" } }),
    prisma.currentPayment.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "asc" },
    }),
  ]);

  const plainPensioners = pensioners.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    address: `${p.street}, ${p.house}${p.apartment ? `, кв. ${p.apartment}` : ""}`,
    pensionPaymentDay: p.pensionPaymentDay,
  }));

  const pensionerMonthPayments: Record<
    number,
    { id: number; paymentId: number; amount: number; isPaid: boolean; roundId: number | null }[]
  > = {};
  for (const cp of monthPayments) {
    if (!pensionerMonthPayments[cp.pensionerId]) pensionerMonthPayments[cp.pensionerId] = [];
    pensionerMonthPayments[cp.pensionerId].push({
      id: cp.id,
      paymentId: cp.paymentId,
      amount: cp.amount,
      isPaid: cp.isPaid,
      roundId: cp.roundId,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/rounds" className="text-sm text-blue-600 hover:underline">
          ← До обходів
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Новий обхід</h1>
      </div>
      <NewRoundClient
        pensioners={plainPensioners}
        payments={payments}
        postmen={postmen}
        pensionerMonthPayments={pensionerMonthPayments}
      />
    </div>
  );
}
