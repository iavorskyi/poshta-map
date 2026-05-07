import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { ImportPensioners } from "./ImportPensioners";
import { PensionersFilter } from "./PensionersFilter";
import { requireUser } from "@/lib/auth";

type SortKey = "name" | "address" | "day" | "payments";

const SORT_KEYS: SortKey[] = ["name", "address", "day", "payments"];

function parseSort(raw: string | undefined): SortKey {
  return SORT_KEYS.includes(raw as SortKey) ? (raw as SortKey) : "name";
}

function parseDir(raw: string | undefined): "asc" | "desc" {
  return raw === "desc" ? "desc" : "asc";
}

export default async function PensionersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireUser();
  const sp = await searchParams;

  const q = String(sp.q ?? "").trim();
  const postmanFilter = String(sp.postmanId ?? "");
  const dayRaw = String(sp.day ?? "").trim();
  const dayNum = /^\d+$/.test(dayRaw) ? Number(dayRaw) : NaN;
  const day = dayNum >= 1 && dayNum <= 31 ? dayNum : null;
  const sort = parseSort(typeof sp.sort === "string" ? sp.sort : undefined);
  const dir = parseDir(typeof sp.dir === "string" ? sp.dir : undefined);

  const where: Prisma.PensionerWhereInput = {};
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { apartment: { contains: q, mode: "insensitive" } },
      {
        building: {
          is: {
            OR: [
              { street: { contains: q, mode: "insensitive" } },
              { number: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }
  if (postmanFilter === "none") {
    where.postmanId = null;
  } else if (/^\d+$/.test(postmanFilter)) {
    where.postmanId = Number(postmanFilter);
  }
  if (day !== null) where.pensionPaymentDay = day;

  let orderBy:
    | Prisma.PensionerOrderByWithRelationInput
    | Prisma.PensionerOrderByWithRelationInput[];
  switch (sort) {
    case "address":
      orderBy = [
        { building: { street: dir } },
        { building: { number: dir } },
        { apartment: dir },
        { fullName: "asc" },
      ];
      break;
    case "day":
      orderBy = [{ pensionPaymentDay: dir }, { fullName: "asc" }];
      break;
    case "payments":
      orderBy = [{ currentPayments: { _count: dir } }, { fullName: "asc" }];
      break;
    case "name":
    default:
      orderBy = { fullName: dir };
  }

  const [pensioners, postmen] = await Promise.all([
    prisma.pensioner.findMany({
      where,
      orderBy,
      include: {
        _count: { select: { currentPayments: true } },
        building: true,
        postman: true,
      },
    }),
    prisma.postman.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const formatAddress = (p: (typeof pensioners)[number]) => {
    const apt = p.apartment ? `, кв. ${p.apartment}` : "";
    return `${p.building.street}, ${p.building.number}${apt}`;
  };

  const hasFilters =
    q !== "" || postmanFilter !== "" || day !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Пенсіонери</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {me.isAdmin && <ImportPensioners />}
          <Link
            href="/pensioners/new"
            className="btn-primary"
          >
            + Додати пенсіонера
          </Link>
        </div>
      </div>

      <PensionersFilter
        q={q}
        postmanFilter={postmanFilter}
        day={day === null ? "" : String(day)}
        sort={sort}
        dir={dir}
        postmen={postmen}
      />

      {pensioners.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle">
          {hasFilters
            ? "За цими фільтрами нічого не знайдено"
            : "Ще немає пенсіонерів"}
        </div>
      ) : (
        <>
          <div className="text-xs text-fg-subtle">
            Знайдено: {pensioners.length}
          </div>

          {/* Mobile: cards */}
          <ul className="md:hidden space-y-2">
            {pensioners.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pensioners/${p.id}`}
                  className="block card p-3 active:bg-elevated transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-link truncate">{p.fullName}</div>
                      <div className="text-sm text-fg-muted mt-0.5">{formatAddress(p)}</div>
                      <div className="text-xs text-fg-subtle mt-0.5">
                        {p.phone ?? "без телефону"} · пенсія {p.pensionPaymentDay}-го
                        {p.postman ? ` · ${p.postman.name}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-xs text-fg-muted">
                      {p._count.currentPayments} виплат
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-fg-muted">
                <tr>
                  <SortHeader label="ФІО" sortKey="name" sort={sort} dir={dir} sp={sp} />
                  <SortHeader label="Адреса" sortKey="address" sort={sort} dir={dir} sp={sp} />
                  <th className="text-left px-3 py-2">Телефон</th>
                  <SortHeader label="День пенсії" sortKey="day" sort={sort} dir={dir} sp={sp} />
                  <th className="text-left px-3 py-2">Листоноша</th>
                  <SortHeader label="Виплат" sortKey="payments" sort={sort} dir={dir} sp={sp} />
                </tr>
              </thead>
              <tbody>
                {pensioners.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-elevated">
                    <td className="px-3 py-2">
                      <Link href={`/pensioners/${p.id}`} className="text-link hover:text-link-hover hover:underline">
                        {p.fullName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{formatAddress(p)}</td>
                    <td className="px-3 py-2">{p.phone ?? "—"}</td>
                    <td className="px-3 py-2">{p.pensionPaymentDay}</td>
                    <td className="px-3 py-2">{p.postman?.name ?? "—"}</td>
                    <td className="px-3 py-2">{p._count.currentPayments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  dir,
  sp,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  sp: Record<string, string | string[] | undefined>;
}) {
  const active = sort === sortKey;
  const nextDir: "asc" | "desc" = active && dir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") params.set(k, v);
  }
  params.set("sort", sortKey);
  params.set("dir", nextDir);
  const arrow = active ? (dir === "asc" ? "↑" : "↓") : "";
  return (
    <th className="text-left px-3 py-2">
      <Link
        href={`/pensioners?${params.toString()}`}
        className={`inline-flex items-center gap-1 hover:text-fg ${active ? "text-fg" : ""}`}
      >
        {label}
        {arrow && <span className="text-xs">{arrow}</span>}
      </Link>
    </th>
  );
}
