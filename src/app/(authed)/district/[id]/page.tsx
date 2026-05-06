import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BuildingDetailClient } from "./BuildingDetailClient";
import { BackLink } from "@/components/BackLink";

export default async function BuildingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      entrances: { orderBy: { number: "asc" } },
    },
  });
  if (!building) notFound();

  return (
    <div className="space-y-4">
      <div>
        <BackLink fallbackHref="/district" fallbackLabel="До дільниці" />
      </div>
      <BuildingDetailClient
        building={{
          id: building.id,
          street: building.street,
          number: building.number,
          notes: building.notes,
        }}
        entrances={building.entrances.map((e) => ({
          id: e.id,
          number: e.number,
          aptFrom: e.aptFrom,
          aptTo: e.aptTo,
          notes: e.notes,
        }))}
      />
    </div>
  );
}
