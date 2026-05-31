import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { BackLink } from "@/components/BackLink";

const MONTH_LABELS = [
  "Січ",
  "Лют",
  "Бер",
  "Кві",
  "Тра",
  "Чер",
  "Лип",
  "Сер",
  "Вер",
  "Жов",
  "Лис",
  "Гру",
];

export default async function PublicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const publicationId = Number(id);
  if (!Number.isFinite(publicationId)) notFound();

  const yearNum = Number(sp.year);
  const year =
    Number.isFinite(yearNum) && yearNum > 1900 && yearNum < 3000
      ? yearNum
      : new Date().getFullYear();

  const [publication, subscriptions] = await Promise.all([
    prisma.publication.findUnique({ where: { id: publicationId } }),
    prisma.subscription.findMany({
      where: { publicationId, year },
      include: {
        subscriber: {
          include: {
            building: { select: { street: true, number: true } },
          },
        },
      },
      orderBy: { subscriber: { fullName: "asc" } },
    }),
  ]);

  if (!publication) notFound();

  const monthTotals = Array.from({ length: 12 }, (_, i) =>
    subscriptions.reduce(
      (sum, s) => sum + (s.activeMonths[i] ? 1 : 0),
      0,
    ),
  );

  return (
    <div className="space-y-4">
      <BackLink
        fallbackHref="/subscriptions/publications"
        fallbackLabel="До видань"
      />

      <div>
        <h1 className="text-2xl font-semibold">
          {publication.name}
          <span className="ml-2 align-middle font-mono text-base text-fg-subtle">
            {publication.code}
          </span>
        </h1>
        <div className="text-sm text-fg-muted mt-1">
          {publication.issuesPerMonth != null && (
            <>Випусків/міс: {publication.issuesPerMonth} · </>
          )}
          {publication.notes ?? <span className="text-fg-subtle">—</span>}
        </div>
      </div>

      <YearSwitcher year={year} publicationId={publicationId} />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-fg-muted">
            <tr>
              <th className="text-left px-3 py-2 sticky left-0 bg-elevated z-10">
                Передплатник
              </th>
              <th className="text-left px-3 py-2">Адреса</th>
              {MONTH_LABELS.map((m, i) => (
                <th key={i} className="px-2 py-2 text-center w-10">
                  {m}
                </th>
              ))}
              <th className="text-right px-3 py-2">∑</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((s) => {
              const total = s.activeMonths.filter(Boolean).length;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 sticky left-0 bg-surface z-10">
                    <Link
                      href={`/subscriptions/subscribers/${s.subscriberId}?year=${year}`}
                      className="text-link hover:text-link-hover hover:underline"
                    >
                      {s.subscriber.fullName}
                    </Link>
                    {s.subscriber.isOrganization && (
                      <span className="ml-2 rounded-full bg-elevated px-2 py-0.5 text-xs text-fg-muted">
                        організація
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-fg-muted">
                    {s.subscriber.building ? (
                      <>
                        {s.subscriber.building.street},{" "}
                        {s.subscriber.building.number}
                        {s.subscriber.corpus && `, корп. ${s.subscriber.corpus}`}
                        {s.subscriber.apartment &&
                          `, кв. ${s.subscriber.apartment}`}
                      </>
                    ) : s.subscriber.streetText && s.subscriber.numberText ? (
                      <span
                        className="text-fg-subtle italic"
                        title="Адреса поза дільницею"
                      >
                        {s.subscriber.streetText}, {s.subscriber.numberText}
                        {s.subscriber.corpus && `, корп. ${s.subscriber.corpus}`}
                        {s.subscriber.apartment &&
                          `, кв. ${s.subscriber.apartment}`}
                      </span>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  {s.activeMonths.map((active, i) => (
                    <td
                      key={i}
                      className={`px-2 py-2 text-center ${
                        active ? "text-success" : "text-fg-subtle"
                      }`}
                    >
                      {active ? "✓" : "·"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium">{total}</td>
                </tr>
              );
            })}
            {subscriptions.length > 0 && (
              <tr className="border-t border-border bg-elevated/30 font-medium">
                <td className="px-3 py-2 sticky left-0 bg-elevated/30 z-10">
                  Разом
                </td>
                <td className="px-3 py-2"></td>
                {monthTotals.map((t, i) => (
                  <td key={i} className="px-2 py-2 text-center">
                    {t}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  {monthTotals.reduce((s, n) => s + n, 0)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {subscriptions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle text-sm">
          У {year} році підписок на це видання немає.
        </div>
      )}
    </div>
  );
}

function YearSwitcher({
  year,
  publicationId,
}: {
  year: number;
  publicationId: number;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={`/subscriptions/publications/${publicationId}?year=${year - 1}`}
        className="link"
      >
        ← {year - 1}
      </Link>
      <span className="font-medium">{year}</span>
      <Link
        href={`/subscriptions/publications/${publicationId}?year=${year + 1}`}
        className="link"
      >
        {year + 1} →
      </Link>
    </div>
  );
}
