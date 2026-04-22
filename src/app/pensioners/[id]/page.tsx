import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PensionerForm } from "../PensionerForm";

export const dynamic = "force-dynamic";

export default async function EditPensionerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const [pensioner, payments] = await Promise.all([
    prisma.pensioner.findUnique({
      where: { id },
      include: {
        templates: { include: { payment: true }, orderBy: { dayOfMonth: "asc" } },
      },
    }),
    prisma.payment.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!pensioner) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/pensioners" className="text-sm text-blue-600 hover:underline">
          ← До списку
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{pensioner.fullName}</h1>
      </div>
      <PensionerForm
        pensioner={{
          id: pensioner.id,
          fullName: pensioner.fullName,
          street: pensioner.street,
          house: pensioner.house,
          apartment: pensioner.apartment,
          phone: pensioner.phone,
          passportNumber: pensioner.passportNumber,
          pensionPaymentDay: pensioner.pensionPaymentDay,
          notes: pensioner.notes,
          templates: pensioner.templates.map((t) => ({
            paymentId: t.paymentId,
            dayOfMonth: t.dayOfMonth,
            defaultAmount: t.defaultAmount,
          })),
        }}
        payments={payments}
      />
    </div>
  );
}
