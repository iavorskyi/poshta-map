import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageSubscriptions } from "@/lib/permissions";
import { SubscribersClient } from "./SubscribersClient";
import { SubscriptionsTabs } from "../SubscriptionsTabs";

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; year?: string }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const yearNum = Number(sp.year);
  const year =
    Number.isFinite(yearNum) && yearNum > 1900 && yearNum < 3000
      ? yearNum
      : new Date().getFullYear();

  const [subscribers, buildings] = await Promise.all([
    prisma.subscriber.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { fullName: "asc" },
      include: {
        building: { select: { id: true, street: true, number: true } },
        _count: { select: { subscriptions: { where: { year } } } },
      },
    }),
    prisma.building.findMany({
      orderBy: [{ street: "asc" }, { number: "asc" }],
      select: { id: true, street: true, number: true },
    }),
  ]);

  const canManage = canManageSubscriptions(me);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Передплати</h1>
      </div>

      <SubscriptionsTabs />

      <SubscribersClient
        subscribers={subscribers.map((s) => ({
          id: s.id,
          fullName: s.fullName,
          isOrganization: s.isOrganization,
          phone: s.phone,
          buildingId: s.buildingId,
          building: s.building
            ? `${s.building.street}, ${s.building.number}`
            : null,
          corpus: s.corpus,
          apartment: s.apartment,
          deliveryMode: s.deliveryMode,
          notes: s.notes,
          activeCount: s._count.subscriptions,
        }))}
        buildings={buildings}
        q={q}
        year={year}
        canManage={canManage}
      />

      {subscribers.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle text-sm">
          {q ? (
            <>
              За запитом «{q}» нічого не знайдено.{" "}
              <Link href="/subscriptions/subscribers" className="link">
                Скинути
              </Link>
            </>
          ) : (
            "Передплатників ще немає. Додайте першого зверху."
          )}
        </div>
      )}
    </div>
  );
}
