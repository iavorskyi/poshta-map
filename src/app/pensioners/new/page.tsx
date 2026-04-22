import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PensionerForm } from "../PensionerForm";

export const dynamic = "force-dynamic";

export default async function NewPensionerPage() {
  const payments = await prisma.payment.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/pensioners" className="text-sm text-blue-600 hover:underline">
          ← До списку
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Новий пенсіонер</h1>
      </div>
      <PensionerForm payments={payments} />
    </div>
  );
}
