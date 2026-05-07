"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Postman = { id: number; name: string };

type Props = {
  q: string;
  postmanFilter: string; // "", "none", or numeric id as string
  day: string; // "" or 1..31 as string
  sort: string;
  dir: string;
  postmen: Postman[];
};

export function PensionersFilter({
  q,
  postmanFilter,
  day,
  sort,
  dir,
  postmen,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [qVal, setQVal] = useState(q);
  const [pmVal, setPmVal] = useState(postmanFilter);
  const [dayVal, setDayVal] = useState(day);
  const [isPending, startTransition] = useTransition();

  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    const params = new URLSearchParams(sp.toString());

    if (qVal.trim()) params.set("q", qVal.trim());
    else params.delete("q");

    if (pmVal) params.set("postmanId", pmVal);
    else params.delete("postmanId");

    if (dayVal && /^\d+$/.test(dayVal)) {
      const n = Number(dayVal);
      if (n >= 1 && n <= 31) params.set("day", String(n));
      else params.delete("day");
    } else {
      params.delete("day");
    }

    const next = `${pathname}?${params.toString()}`;
    const current = `${pathname}?${sp.toString()}`;
    if (next === current) return;

    const t = setTimeout(() => {
      startTransition(() => router.push(next));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qVal, pmVal, dayVal]);

  const reset = () => {
    setQVal("");
    setPmVal("");
    setDayVal("");
  };

  const onSortChange = (value: string) => {
    const [s, d] = value.split(":");
    const params = new URLSearchParams(sp.toString());
    if (s) params.set("sort", s);
    else params.delete("sort");
    if (d) params.set("dir", d);
    else params.delete("dir");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  return (
    <div className="card p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-2">
        <label className="flex flex-col gap-1 text-sm md:flex-1 md:min-w-48">
          <span className="text-xs text-fg-muted">Пошук</span>
          <input
            type="search"
            value={qVal}
            onChange={(e) => setQVal(e.target.value)}
            className="input"
            placeholder="ФІО, телефон, вулиця, № будинку"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm md:w-56">
          <span className="text-xs text-fg-muted">Листоноша</span>
          <select
            value={pmVal}
            onChange={(e) => setPmVal(e.target.value)}
            className="input"
          >
            <option value="">Усі</option>
            <option value="none">— без листоноші —</option>
            {postmen.map((pm) => (
              <option key={pm.id} value={String(pm.id)}>
                {pm.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm md:w-32">
          <span className="text-xs text-fg-muted">День пенсії</span>
          <input
            type="number"
            min={1}
            max={31}
            value={dayVal}
            onChange={(e) => setDayVal(e.target.value)}
            className="input"
            placeholder="1..31"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm md:w-56 md:hidden">
          <span className="text-xs text-fg-muted">Сортування</span>
          <select
            value={`${sort}:${dir}`}
            onChange={(e) => onSortChange(e.target.value)}
            className="input"
          >
            <option value="name:asc">ФІО (А→Я)</option>
            <option value="name:desc">ФІО (Я→А)</option>
            <option value="address:asc">Адреса (А→Я)</option>
            <option value="address:desc">Адреса (Я→А)</option>
            <option value="day:asc">День пенсії (1→31)</option>
            <option value="day:desc">День пенсії (31→1)</option>
            <option value="payments:desc">Виплат (більше)</option>
            <option value="payments:asc">Виплат (менше)</option>
          </select>
        </label>
        <div className="flex items-center gap-3 md:ml-auto">
          {isPending && <span className="text-xs text-fg-subtle">Оновлення…</span>}
          <button
            type="button"
            onClick={reset}
            disabled={isPending}
            className="btn-secondary"
          >
            Скинути
          </button>
        </div>
      </div>
    </div>
  );
}
