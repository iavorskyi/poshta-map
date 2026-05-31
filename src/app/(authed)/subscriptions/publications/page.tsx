import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageSubscriptions } from "@/lib/permissions";
import { PublicationsClient } from "./PublicationsClient";
import { SubscriptionsTabs } from "../SubscriptionsTabs";

export default async function PublicationsPage({
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

  const publications = await prisma.publication.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          subscriptions: { where: { year } },
        },
      },
    },
  });

  const canManage = canManageSubscriptions(me);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Передплати</h1>
      </div>

      <SubscriptionsTabs />

      <PublicationsClient
        publications={publications.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          issuesPerMonth: p.issuesPerMonth,
          notes: p.notes,
          activeCount: p._count.subscriptions,
        }))}
        q={q}
        year={year}
        canManage={canManage}
      />

      {publications.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle text-sm">
          {q ? (
            <>
              За запитом «{q}» нічого не знайдено.{" "}
              <Link href="/subscriptions/publications" className="link">
                Скинути
              </Link>
            </>
          ) : (
            "Видань ще немає. Додайте перше зверху."
          )}
        </div>
      )}
    </div>
  );
}
