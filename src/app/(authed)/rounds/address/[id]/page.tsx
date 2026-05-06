import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/BackLink";
import { AddressRoundDetailClient } from "./AddressRoundDetailClient";
import { requireUser } from "@/lib/auth";
import { canEditAddressRound } from "@/lib/permissions";

export default async function AddressRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const [round, buildings, postmen] = await Promise.all([
    prisma.addressRound.findUnique({
      where: { id },
      include: {
        items: {
          include: { building: true },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        },
      },
    }),
    prisma.building.findMany({
      orderBy: [{ street: "asc" }, { number: "asc" }],
      select: { id: true, street: true, number: true },
    }),
    prisma.postman.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!round) notFound();

  const canEdit = canEditAddressRound(me, round);

  return (
    <div className="space-y-4">
      <div>
        <BackLink fallbackHref="/rounds?tab=address" fallbackLabel="До обходів" />
      </div>
      <AddressRoundDetailClient
        round={{
          id: round.id,
          date: round.date.toISOString(),
          postmanId: round.postmanId,
          notes: round.notes,
          closedAt: round.closedAt ? round.closedAt.toISOString() : null,
        }}
        items={round.items.map((it) => ({
          id: it.id,
          buildingId: it.buildingId,
          buildingStreet: it.building.street,
          buildingNumber: it.building.number,
          done: it.done,
          notes: it.notes,
        }))}
        buildings={buildings}
        postmen={postmen}
        isAdmin={me.isAdmin}
        canEdit={canEdit}
      />
    </div>
  );
}
