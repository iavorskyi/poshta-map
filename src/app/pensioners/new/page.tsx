import { prisma } from "@/lib/prisma";
import { PensionerForm } from "../PensionerForm";
import { BackLink } from "@/components/BackLink";

export const dynamic = "force-dynamic";

export default async function NewPensionerPage() {
  const [buildings, postmen] = await Promise.all([
    prisma.building.findMany({
      orderBy: [{ street: "asc" }, { number: "asc" }],
    }),
    prisma.postman.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <BackLink fallbackHref="/pensioners" fallbackLabel="До списку" />
        <h1 className="text-2xl font-semibold mt-1">Новий пенсіонер</h1>
      </div>
      <PensionerForm
        buildings={buildings.map((b) => ({ id: b.id, street: b.street, number: b.number }))}
        postmen={postmen}
      />
    </div>
  );
}
