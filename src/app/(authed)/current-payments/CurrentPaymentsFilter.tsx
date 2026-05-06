"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { currentMonthRange } from "@/lib/dateRange";
import { PensionerCombobox } from "@/components/PensionerCombobox";

type Props = {
  fromStr: string;
  toStr: string;
  pensionerId: number | null;
  pensioners: { id: number; fullName: string }[];
  paymentId?: number | null;
  payments?: { id: number; name: string; code: string }[];
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
  paymentId = null,
  payments = [],
  mode = "all",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [from, setFrom] = useState(fromStr);
  const [to, setTo] = useState(toStr);
  const [pid, setPid] = useState<number | "">(pensionerId ?? "");
  const [payId, setPayId] = useState<number | "">(paymentId ?? "");
  const [isPending, startTransition] = useTransition();

  const showPaymentFilter = payments.length > 0;

  // Skip the very first effect run — values came from props/URL, no need to push.
  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    if (!from || !to) return;

    const params = new URLSearchParams(sp.toString());
    params.set("from", from);
    params.set("to", to);
    if (mode === "all") {
      if (pid === "") params.delete("pensionerId");
      else params.set("pensionerId", String(pid));
    }
    if (showPaymentFilter) {
      if (payId === "") params.delete("paymentId");
      else params.set("paymentId", String(payId));
    }

    const next = `${pathname}?${params.toString()}`;
    const current = `${pathname}?${sp.toString()}`;
    if (next === current) return;

    const t = setTimeout(() => {
      startTransition(() => router.push(next));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, pid, payId]);

  const reset = () => {
    const range = currentMonthRange();
    setFrom(range.from);
    setTo(range.to);
    if (mode === "all") setPid("");
    if (showPaymentFilter) setPayId("");
  };

  return (
    <div className="card p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-2">
        <label className="flex flex-col gap-1 text-sm md:w-40">
          <span className="text-xs text-fg-muted">Від</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm md:w-40">
          <span className="text-xs text-fg-muted">До</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input"
          />
        </label>
        {mode === "all" && (
          <label className="flex flex-col gap-1 text-sm md:flex-1 md:min-w-48">
            <span className="text-xs text-fg-muted">Пенсіонер</span>
            <PensionerCombobox
              pensioners={pensioners}
              value={pid}
              onChange={setPid}
              placeholder="Усі пенсіонери"
            />
          </label>
        )}
        {showPaymentFilter && (
          <label className="flex flex-col gap-1 text-sm md:w-56">
            <span className="text-xs text-fg-muted">Тип виплати</span>
            <select
              value={payId}
              onChange={(e) => setPayId(e.target.value ? Number(e.target.value) : "")}
              className="input"
            >
              <option value="">Усі типи</option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-3 md:ml-auto">
          {isPending && <span className="text-xs text-fg-subtle">Оновлення…</span>}
          <button
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
