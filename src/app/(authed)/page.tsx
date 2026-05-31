import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDate, formatUAH } from "@/lib/format";

export default async function Home() {
  const me = await requireUser();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // "Мої" виплати на головній — лише пенсіонерів, закріплених за поточним
  // листоношею. Хто фактично робив обхід не враховуємо.
  const mineFilter = { pensioner: { postmanId: me.id } };

  const [
    monthGroups,
    overdueCountRows,
    overdue,
    todayItems,
    pensionersCount,
    upcomingRoundsCount,
    subscribersCount,
    activeSubscriptionsCount,
  ] = await Promise.all([
    prisma.currentPayment.groupBy({
      by: ["isPaid"],
      where: { ...mineFilter, date: { gte: monthStart, lt: monthEnd } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.currentPayment.groupBy({
      by: ["isPaid"],
      where: { ...mineFilter, isPaid: false, date: { lt: today } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.currentPayment.findMany({
      where: { ...mineFilter, isPaid: false, date: { lt: today } },
      include: {
        pensioner: { include: { building: true } },
        payment: true,
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      take: 50,
    }),
    prisma.currentPayment.findMany({
      where: { ...mineFilter, date: { gte: today, lt: tomorrow } },
      include: { pensioner: true, payment: true },
      orderBy: [{ isPaid: "asc" }, { id: "asc" }],
    }),
    prisma.pensioner.count({ where: { postmanId: me.id } }),
    prisma.round.count({
      where: { postmanId: me.id, date: { gte: today }, closedAt: null },
    }),
    prisma.subscriber.count(),
    prisma.subscription.count({ where: { year: now.getFullYear() } }),
  ]);

  const paid = monthGroups.find((g) => g.isPaid === true);
  const unpaid = monthGroups.find((g) => g.isPaid === false);
  const paidCount = paid?._count._all ?? 0;
  const paidSum = paid?._sum.amount ?? 0;
  const unpaidCount = unpaid?._count._all ?? 0;
  const unpaidSum = unpaid?._sum.amount ?? 0;
  const totalCount = paidCount + unpaidCount;
  const totalSum = paidSum + unpaidSum;
  const progressPct = totalSum > 0 ? Math.round((paidSum / totalSum) * 100) : 0;

  const overdueCount = overdueCountRows[0]?._count._all ?? 0;
  const overdueSum = overdueCountRows[0]?._sum.amount ?? 0;

  const todaySum = todayItems.reduce((s, it) => s + it.amount, 0);
  const todayPaidCount = todayItems.filter((i) => i.isPaid).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Привіт, {me.name}!</h1>
        <p className="text-fg-muted mt-1">
          Зведення по ваших виплатах за поточний місяць.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Stat
          title="Виплачено цього місяця"
          sub={`${paidCount} з ${totalCount}`}
          value={formatUAH(paidSum)}
          tone="success"
        />
        <Stat
          title="Залишок до виплати"
          sub={`${unpaidCount} шт`}
          value={formatUAH(unpaidSum)}
          tone="warning"
        />
        <Stat
          title="Прострочено"
          sub={overdueCount === 0 ? "немає" : `${overdueCount} шт`}
          value={formatUAH(overdueSum)}
          tone={overdueCount > 0 ? "danger" : undefined}
        />
        <Stat
          title="На сьогодні"
          sub={
            todayItems.length === 0
              ? "—"
              : `${todayPaidCount}/${todayItems.length} виплачено`
          }
          value={formatUAH(todaySum)}
        />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-fg-muted">Прогрес місяця</span>
          <span className="font-medium">{progressPct}% виплачено</span>
        </div>
        <div className="mt-2 h-2 rounded bg-elevated overflow-hidden">
          <div
            className="h-full bg-success transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-fg-subtle">
          Заплановано {formatUAH(totalSum)}, виплачено{" "}
          <span className="text-success">{formatUAH(paidSum)}</span>, залишок{" "}
          <span className="text-warning">{formatUAH(totalSum - paidSum)}</span>.
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Прострочені виплати</h2>
          {overdueCount > overdue.length && (
            <span className="text-xs text-fg-subtle">
              Показано {overdue.length} із {overdueCount}.{" "}
              <Link href="/current-payments" className="link">
                Усі
              </Link>
            </span>
          )}
        </div>
        {overdue.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle text-sm">
            Прострочених виплат немає. Так тримати!
          </div>
        ) : (
          <>
            <ul className="md:hidden space-y-2">
              {overdue.map((it) => {
                const days = Math.floor(
                  (today.getTime() - it.date.getTime()) / 86_400_000,
                );
                return (
                  <li
                    key={it.id}
                    className="rounded-lg border border-danger-border bg-surface p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/pensioners/${it.pensionerId}`}
                          className="font-medium text-link block truncate"
                        >
                          {it.pensioner.fullName}
                        </Link>
                        <div className="text-xs text-fg-muted mt-0.5">
                          {it.pensioner.building.street},{" "}
                          {it.pensioner.building.number}
                          {it.pensioner.apartment
                            ? `, кв. ${it.pensioner.apartment}`
                            : ""}
                        </div>
                        <div className="text-xs text-fg-subtle mt-0.5">
                          {it.payment.name} · {formatDate(it.date)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold">
                          {formatUAH(it.amount)}
                        </div>
                        <div className="text-xs text-danger font-medium mt-0.5">
                          {days} дн
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden md:block card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-elevated text-fg-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Дата</th>
                    <th className="text-left px-3 py-2">Пенсіонер</th>
                    <th className="text-left px-3 py-2">Адреса</th>
                    <th className="text-left px-3 py-2">Тип</th>
                    <th className="text-right px-3 py-2">Сума</th>
                    <th className="text-right px-3 py-2">Днів</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((it) => {
                    const days = Math.floor(
                      (today.getTime() - it.date.getTime()) / 86_400_000,
                    );
                    return (
                      <tr key={it.id} className="border-t border-border">
                        <td className="px-3 py-2">{formatDate(it.date)}</td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/pensioners/${it.pensionerId}`}
                            className="text-link hover:text-link-hover hover:underline"
                          >
                            {it.pensioner.fullName}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-fg-muted">
                          {it.pensioner.building.street},{" "}
                          {it.pensioner.building.number}
                          {it.pensioner.apartment
                            ? `, кв. ${it.pensioner.apartment}`
                            : ""}
                        </td>
                        <td className="px-3 py-2">{it.payment.name}</td>
                        <td className="px-3 py-2 text-right">
                          {formatUAH(it.amount)}
                        </td>
                        <td className="px-3 py-2 text-right text-danger font-medium">
                          {days}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {todayItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">На сьогодні</h2>
          <ul className="card divide-y divide-border">
            {todayItems.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <Link
                    href={`/pensioners/${it.pensionerId}`}
                    className="text-link hover:text-link-hover hover:underline block truncate"
                  >
                    {it.pensioner.fullName}
                  </Link>
                  <div className="text-xs text-fg-subtle">
                    {it.payment.name}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{formatUAH(it.amount)}</div>
                  <div
                    className={`text-xs ${
                      it.isPaid ? "text-success" : "text-fg-subtle"
                    }`}
                  >
                    {it.isPaid ? "Виплачено" : "Очікує"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Швидкі переходи</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <NavCard
            href="/rounds"
            title="Обходи"
            hint={
              upcomingRoundsCount
                ? `Активних: ${upcomingRoundsCount}`
                : "Сформувати денний обхід"
            }
          />
          <NavCard
            href="/current-payments"
            title="Поточні виплати"
            hint="Усі виплати з фільтром"
          />
          <NavCard
            href="/pensioners"
            title="Пенсіонери"
            hint={`Закріплено: ${pensionersCount}`}
          />
          <NavCard
            href="/subscriptions/publications"
            title="Передплати"
            hint={
              subscribersCount === 0
                ? "Каталог видань і передплатники"
                : `Підписників: ${subscribersCount} · підписок у ${now.getFullYear()}: ${activeSubscriptionsCount}`
            }
          />
          {me.isAdmin && (
            <NavCard href="/postmen" title="Листоноші" hint="Управління" />
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  title,
  sub,
  value,
  tone,
}: {
  title: string;
  sub: string;
  value: string;
  tone?: "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "danger"
      ? "text-danger"
      : "text-fg";
  return (
    <div className="card p-3 md:p-4">
      <div className="text-xs text-fg-subtle">{title}</div>
      <div
        className={`text-base md:text-xl font-semibold mt-1 ${color} truncate`}
      >
        {value}
      </div>
      <div className="text-xs text-fg-muted mt-0.5">{sub}</div>
    </div>
  );
}

function NavCard({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-surface p-4 hover:border-brand hover:shadow-sm transition"
    >
      <div className="text-sm text-fg-subtle">{hint}</div>
      <div className="text-lg font-medium mt-1">{title}</div>
    </Link>
  );
}
