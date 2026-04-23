"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { currentMonthRange } from "@/lib/dateRange";

type Props = {
  fromStr: string;
  toStr: string;
  pensionerId: number | null;
  pensioners: { id: number; fullName: string }[];
  /**
   * When "pensioner" the pensioner selector is hidden (page is already scoped
   * to one pensioner).
   */
  mode?: "all" | "pensioner";
  /** Unused, kept for explicit prop passing from pensioner detail page. */
  pensionerIdForLink?: number;
};

export function CurrentPaymentsFilter({
  fromStr,
  toStr,
  pensionerId,
  pensioners,
  mode = "all",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [from, setFrom] = useState(fromStr);
  const [to, setTo] = useState(toStr);
  const [pid, setPid] = useState<number | "">(pensionerId ?? "");
  const [isPending, startTransition] = useTransition();

  const apply = () => {
    const params = new URLSearchParams(sp.toString());
    params.set("from", from);
    params.set("to", to);
    if (mode === "all") {
      if (pid === "") params.delete("pensionerId");
      else params.set("pensionerId", String(pid));
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const reset = () => {
    const range = currentMonthRange();
    setFrom(range.from);
    setTo(range.to);
    if (mode === "all") setPid("");
    startTransition(() =>
      router.push(`${pathname}?from=${range.from}&to=${range.to}`)
    );
  };

  const gridCols =
    mode === "pensioner"
      ? "md:grid-cols-[160px_160px_auto_auto]"
      : "md:grid-cols-[160px_160px_1fr_auto_auto]";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`grid grid-cols-1 ${gridCols} gap-2 items-end`}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-slate-600">Від</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-slate-600">До</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input"
          />
        </label>
        {mode === "all" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-slate-600">Пенсіонер</span>
            <select
              value={pid}
              onChange={(e) => setPid(e.target.value ? Number(e.target.value) : "")}
              className="input"
            >
              <option value="">Усі пенсіонери</option>
              {pensioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          onClick={apply}
          disabled={isPending}
          className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-60"
        >
          Застосувати
        </button>
        <button
          onClick={reset}
          disabled={isPending}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          Скинути
        </button>
      </div>
    </div>
  );
}
