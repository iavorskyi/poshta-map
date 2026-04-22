import { prisma } from "@/lib/prisma";
import { PaymentsClient } from "./PaymentsClient";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const payments = await prisma.payment.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Типи виплат</h1>
      <p className="text-slate-600 text-sm">
        Довідник виплат, які може отримувати пенсіонер (напр. Пенсія, Субсидія).
      </p>
      <PaymentsClient payments={payments} />
    </div>
  );
}
