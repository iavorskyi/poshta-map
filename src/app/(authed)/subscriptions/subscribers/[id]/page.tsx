import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageSubscriptions } from "@/lib/permissions";
import { getCachedPublications } from "@/lib/queries";
import { BackLink } from "@/components/BackLink";
import { SubscriberDetailClient } from "./SubscriberDetailClient";

export default async function SubscriberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const subscriberId = Number(id);
  if (!Number.isFinite(subscriberId)) notFound();

  const yearNum = Number(sp.year);
  const year =
    Number.isFinite(yearNum) && yearNum > 1900 && yearNum < 3000
      ? yearNum
      : new Date().getFullYear();

  const [subscriber, subscriptions, publications] = await Promise.all([
    prisma.subscriber.findUnique({
      where: { id: subscriberId },
      include: {
        building: { select: { id: true, street: true, number: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { subscriberId, year },
      include: {
        publication: { select: { id: true, code: true, name: true } },
      },
      orderBy: { publication: { name: "asc" } },
    }),
    getCachedPublications(),
  ]);

  if (!subscriber) notFound();

  const canManage = canManageSubscriptions(me);
  const existingIds = new Set(subscriptions.map((s) => s.publicationId));
  const availablePublications = publications.filter(
    (p) => !existingIds.has(p.id),
  );

  return (
    <div className="space-y-4">
      <BackLink
        fallbackHref="/subscriptions/subscribers"
        fallbackLabel="До передплатників"
      />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">
            {subscriber.fullName}
            {subscriber.isOrganization && (
              <span className="ml-2 align-middle rounded-full bg-elevated px-2 py-0.5 text-xs text-fg-muted">
                організація
              </span>
            )}
          </h1>
          <div className="text-sm text-fg-muted mt-1 space-x-2">
            {subscriber.building ? (
              <span>
                {subscriber.building.street}, {subscriber.building.number}
                {subscriber.corpus && `, корп. ${subscriber.corpus}`}
                {subscriber.apartment && `, кв. ${subscriber.apartment}`}
              </span>
            ) : subscriber.streetText && subscriber.numberText ? (
              <span
                className="text-fg-subtle italic"
                title="Адреса поза дільницею"
              >
                {subscriber.streetText}, {subscriber.numberText}
                {subscriber.corpus && `, корп. ${subscriber.corpus}`}
                {subscriber.apartment && `, кв. ${subscriber.apartment}`}
              </span>
            ) : (
              <span className="text-fg-subtle">адреса не вказана</span>
            )}
            <span>·</span>
            <span>
              {subscriber.deliveryMode === "ADDRESS" ? "На адресу" : "Самовивіз"}
            </span>
            {subscriber.phone && (
              <>
                <span>·</span>
                <span>{subscriber.phone}</span>
              </>
            )}
          </div>
          {subscriber.notes && (
            <div className="text-sm text-fg-subtle mt-1">{subscriber.notes}</div>
          )}
        </div>
      </div>

      <YearSwitcher year={year} subscriberId={subscriberId} />

      <SubscriberDetailClient
        subscriberId={subscriberId}
        year={year}
        canManage={canManage}
        subscriptions={subscriptions.map((s) => ({
          id: s.id,
          publicationId: s.publicationId,
          publicationCode: s.publication.code,
          publicationName: s.publication.name,
          activeMonths: Array.from({ length: 12 }, (_, i) =>
            Boolean(s.activeMonths[i]),
          ),
          notes: s.notes,
        }))}
        availablePublications={availablePublications}
      />

      {subscriptions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle text-sm">
          У {year} році підписок немає.{" "}
          {canManage ? (
            "Додайте видання нижче."
          ) : (
            <Link href="/subscriptions/publications" className="link">
              Каталог видань
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function YearSwitcher({
  year,
  subscriberId,
}: {
  year: number;
  subscriberId: number;
}) {
  const prev = year - 1;
  const next = year + 1;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={`/subscriptions/subscribers/${subscriberId}?year=${prev}`}
        className="link"
      >
        ← {prev}
      </Link>
      <span className="font-medium">{year}</span>
      <Link
        href={`/subscriptions/subscribers/${subscriberId}?year=${next}`}
        className="link"
      >
        {next} →
      </Link>
    </div>
  );
}
