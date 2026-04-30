import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/BackLink";
import { NewAddressRoundClient } from "./NewAddressRoundClient";

export const dynamic = "force-dynamic";

export default async function NewAddressRoundPage() {
  const [buildings, postmen] = await Promise.all([
    prisma.building.findMany({
      orderBy: [{ street: "asc" }, { number: "asc" }],
      select: { id: true, street: true, number: true },
    }),
    prisma.postman.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <BackLink fallbackHref="/rounds?tab=address" fallbackLabel="До обходів" />
        <h1 className="text-2xl font-semibold mt-1">Новий по-адресний обхід</h1>
      </div>
      <NewAddressRoundClient buildings={buildings} postmen={postmen} />
    </div>
  );
}
