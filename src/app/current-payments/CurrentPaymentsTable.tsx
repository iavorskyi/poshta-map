"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteCurrentPayment, updateCurrentPaymentFields } from "./actions";
import { formatDate, formatUAH } from "@/lib/format";

type Item = {
  id: number;
  date: string;
  pensionerId: number;
  pensionerName: string;
  paymentName: string;
  paymentCode: string;
  amount: number;
  isPaid: boolean;
  roundId: number | null;
};

export function CurrentPaymentsTable({ items }: { items: Item[] }) {
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;

  const togglePaid = (id: number, next: boolean) => {
    startTransition(async () => {
      await updateCurrentPaymentFields(id, { isPaid: next });
    });
  };

  const changeAmount = (id: number, amount: number) => {
    startTransition(async () => {
      await updateCurrentPaymentFields(id, { amount });
    });
  };

  const removeItem = (id: number) => {
    if (!confirm("Видалити цю виплату?")) return;
    startTransition(async () => {
      await deleteCurrentPayment(id);
    });
  };

  return (
    <>
      {/* Mobile: card list */}
      <ul className="md:hidden space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className={`rounded-lg border bg-surface p-3 ${
              it.isPaid ? "border-success-border" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/pensioners/${it.pensionerId}`}
                  className="font-medium text-link hover:text-link-hover hover:underline block truncate"
                >
                  {it.pensionerName}
                </Link>
                <div className="text-sm text-fg-muted mt-0.5">
                  {it.paymentName}{" "}
                  <span className="font-mono text-xs text-fg-subtle">({it.paymentCode})</span>
                </div>
                <div className="text-xs text-fg-subtle mt-0.5">
                  {formatDate(it.date)}
                  {it.roundId && (
                    <>
                      {" · "}
                      <Link
                        href={`/rounds/${it.roundId}`}
                        className="link"
                      >
                        обхід #{it.roundId}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{formatUAH(it.amount)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm flex-1">
                <input
                  type="checkbox"
                  checked={it.isPaid}
                  disabled={isPending}
                  onChange={(e) => togglePaid(it.id, e.target.checked)}
                  className="h-5 w-5 accent-brand"
                />
                <span className={it.isPaid ? "text-success font-medium" : "text-fg-muted"}>
                  {it.isPaid ? "Виплачено" : "Відмітити виплаченою"}
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                defaultValue={it.amount}
                disabled={isPending}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v) && v !== it.amount) changeAmount(it.id, v);
                }}
                className="input !w-28 text-right"
                aria-label="Сума"
              />
              <button
                onClick={() => removeItem(it.id)}
                className="text-danger text-sm px-2 py-1"
                aria-label="Видалити"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-fg-muted">
            <tr>
              <th className="text-left px-3 py-2">Дата</th>
              <th className="text-left px-3 py-2">Пенсіонер</th>
              <th className="text-left px-3 py-2">Тип</th>
              <th className="text-right px-3 py-2">Сума</th>
              <th className="text-center px-3 py-2 w-28">Виплачено</th>
              <th className="text-left px-3 py-2">Обхід</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-3 py-2">{formatDate(it.date)}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/pensioners/${it.pensionerId}`}
                    className="text-link hover:text-link-hover hover:underline"
                  >
                    {it.pensionerName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {it.paymentName}{" "}
                  <span className="font-mono text-xs text-fg-subtle">({it.paymentCode})</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={it.amount}
                    disabled={isPending}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v !== it.amount) changeAmount(it.id, v);
                    }}
                    className="input w-28 text-right"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={it.isPaid}
                    disabled={isPending}
                    onChange={(e) => togglePaid(it.id, e.target.checked)}
                    className="h-4 w-4 accent-brand"
                  />
                </td>
                <td className="px-3 py-2">
                  {it.roundId ? (
                    <Link href={`/rounds/${it.roundId}`} className="link">
                      #{it.roundId}
                    </Link>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => removeItem(it.id)}
                    className="text-danger hover:underline text-sm"
                  >
                    Видалити
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
