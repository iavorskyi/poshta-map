import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AddBuilding } from "./AddBuilding";

export default async function DistrictPage() {
  const buildings = await prisma.building.findMany({
    orderBy: [{ street: "asc" }, { number: "asc" }],
    include: { _count: { select: { entrances: true } } },
  });

  // Group by street
  const groups = new Map<
    string,
    { id: number; number: string; entrancesCount: number }[]
  >();
  for (const b of buildings) {
    const arr = groups.get(b.street) ?? [];
    arr.push({ id: b.id, number: b.number, entrancesCount: b._count.entrances });
    groups.set(b.street, arr);
  }
  // Sort numbers naturally within each street
  const sortedGroups = Array.from(groups.entries())
    .map(([street, items]) => ({
      street,
      items: items.sort((a, b) =>
        a.number.localeCompare(b.number, "uk", { numeric: true, sensitivity: "base" })
      ),
    }))
    .sort((a, b) => a.street.localeCompare(b.street, "uk"));

  const streets = Array.from(new Set(buildings.map((b) => b.street))).sort((a, b) =>
    a.localeCompare(b, "uk")
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Дільниця</h1>
        <div className="text-sm text-slate-600">
          Будинків: <strong>{buildings.length}</strong> · Вулиць:{" "}
          <strong>{streets.length}</strong>
        </div>
      </div>
      <p className="text-slate-600 text-sm">
        Будинки, які обслуговує відділення. Натисніть на будинок щоб додати парадні.
      </p>

      <AddBuilding streets={streets} />

      {sortedGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 text-sm">
          Поки немає жодного будинку. Додайте перший вище.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map((g) => (
            <section
              key={g.street}
              className="rounded-lg border border-slate-200 bg-white p-3 md:p-4"
            >
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <h2 className="font-semibold">{g.street}</h2>
                <span className="text-xs text-slate-500">
                  {g.items.length}{" "}
                  {g.items.length === 1 ? "будинок" : g.items.length < 5 ? "будинки" : "будинків"}
                </span>
              </div>
              <ul className="flex flex-wrap gap-2">
                {g.items.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/district/${b.id}`}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 px-2.5 py-1 text-sm"
                    >
                      <span className="font-medium">№ {b.number}</span>
                      {b.entrancesCount > 0 && (
                        <span className="text-xs text-slate-500">
                          · {b.entrancesCount}{" "}
                          {b.entrancesCount === 1 ? "пар." : "пар."}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
