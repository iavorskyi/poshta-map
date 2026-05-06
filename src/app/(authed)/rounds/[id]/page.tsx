import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RoundDetailClient } from "./RoundDetailClient";
import { BackLink } from "@/components/BackLink";
import { requireUser } from "@/lib/auth";
import { canEditRound } from "@/lib/permissions";

export default async function RoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const [round, pensioners, payments, postmen] = await Promise.all([
    prisma.round.findUnique({
      where: { id },
      include: {
        postman: true,
        currentPayments: {
          include: {
            pensioner: { include: { building: true } },
            payment: true,
          },
          orderBy: [{ pensioner: { fullName: "asc" } }, { id: "asc" }],
        },
      },
    }),
    prisma.pensioner.findMany({ orderBy: { fullName: "asc" } }),
    prisma.payment.findMany({ orderBy: { name: "asc" } }),
    prisma.postman.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!round) notFound();

  const canEdit = canEditRound(me, round);

  const pensionerIdsInRound = Array.from(
    new Set(round.currentPayments.map((cp) => cp.pensionerId))
  );

  const allCps = pensionerIdsInRound.length
    ? await prisma.currentPayment.findMany({
        where: { pensionerId: { in: pensionerIdsInRound } },
        orderBy: { date: "desc" },
        select: {
          pensionerId: true,
          paymentId: true,
          amount: true,
          payment: { select: { name: true, code: true } },
        },
      })
    : [];

  const templatesByPensioner: Record<
    number,
    { paymentId: number; paymentName: string; paymentCode: string; amount: number }[]
  > = {};
  const seenTpl: Record<number, Set<number>> = {};
  for (const cp of allCps) {
    if (!seenTpl[cp.pensionerId]) seenTpl[cp.pensionerId] = new Set();
    if (seenTpl[cp.pensionerId].has(cp.paymentId)) continue;
    seenTpl[cp.pensionerId].add(cp.paymentId);
    if (!templatesByPensioner[cp.pensionerId])
      templatesByPensioner[cp.pensionerId] = [];
    templatesByPensioner[cp.pensionerId].push({
      paymentId: cp.paymentId,
      paymentName: cp.payment.name,
      paymentCode: cp.payment.code,
      amount: cp.amount,
    });
  }

  const inRoundByPensioner: Record<number, Set<number>> = {};
  for (const cp of round.currentPayments) {
    if (!inRoundByPensioner[cp.pensionerId])
      inRoundByPensioner[cp.pensionerId] = new Set();
    inRoundByPensioner[cp.pensionerId].add(cp.paymentId);
  }

  const suggestedByPensioner: Record<
    number,
    { paymentId: number; paymentName: string; paymentCode: string; amount: number }[]
  > = {};
  for (const pidStr of Object.keys(templatesByPensioner)) {
    const pid = Number(pidStr);
    const used = inRoundByPensioner[pid] ?? new Set<number>();
    const missing = templatesByPensioner[pid].filter(
      (t) => !used.has(t.paymentId)
    );
    if (missing.length > 0) suggestedByPensioner[pid] = missing;
  }

  return (
    <div className="space-y-4">
      <div>
        <BackLink fallbackHref="/rounds" fallbackLabel="До обходів" />
      </div>
      <RoundDetailClient
        round={{
          id: round.id,
          date: round.date.toISOString(),
          postmanId: round.postmanId,
          notes: round.notes,
          closedAt: round.closedAt ? round.closedAt.toISOString() : null,
        }}
        items={round.currentPayments.map((cp) => ({
          id: cp.id,
          pensionerId: cp.pensionerId,
          pensionerName: cp.pensioner.fullName,
          pensionerBuildingId: cp.pensioner.buildingId,
          pensionerAddress: `${cp.pensioner.building.street}, ${cp.pensioner.building.number}${cp.pensioner.apartment ? `, кв. ${cp.pensioner.apartment}` : ""}`,
          paymentId: cp.paymentId,
          paymentName: cp.payment.name,
          paymentCode: cp.payment.code,
          amount: cp.amount,
          isPaid: cp.isPaid,
        }))}
        pensioners={pensioners.map((p) => ({ id: p.id, fullName: p.fullName }))}
        payments={payments}
        postmen={postmen}
        suggestedByPensioner={suggestedByPensioner}
        isAdmin={me.isAdmin}
        canEdit={canEdit}
      />
    </div>
  );
}
