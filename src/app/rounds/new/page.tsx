import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NewRoundClient } from "./NewRoundClient";

export const dynamic = "force-dynamic";

export default async function NewRoundPage() {
  const [pensioners, payments, postmen] = await Promise.all([
    prisma.pensioner.findMany({
      orderBy: { fullName: "asc" },
      include: {
        templates: { include: { payment: true } },
      },
    }),
    prisma.payment.findMany({ orderBy: { name: "asc" } }),
    prisma.postman.findMany({ orderBy: { name: "asc" } }),
  ]);

  const plainPensioners = pensioners.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    address: `${p.street}, ${p.house}${p.apartment ? `, кв. ${p.apartment}` : ""}`,
    pensionPaymentDay: p.pensionPaymentDay,
    templates: p.templates.map((t) => ({
      id: t.id,
      paymentId: t.paymentId,
      paymentName: t.payment.name,
      paymentCode: t.payment.code,
      dayOfMonth: t.dayOfMonth,
      defaultAmount: t.defaultAmount,
    })),
  }));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/rounds" className="text-sm text-blue-600 hover:underline">
          ← До обходів
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Новий обхід</h1>
      </div>
      <NewRoundClient pensioners={plainPensioners} payments={payments} postmen={postmen} />
    </div>
  );
}
