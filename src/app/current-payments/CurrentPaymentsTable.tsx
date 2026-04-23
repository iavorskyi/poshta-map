"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteCurrentPayment, updateCurrentPaymentFields } from "./actions";
import { formatDate } from "@/lib/format";

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
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
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
            <tr key={it.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{formatDate(it.date)}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/pensioners/${it.pensionerId}`}
                  className="text-blue-700 hover:underline"
                >
                  {it.pensionerName}
                </Link>
              </td>
              <td className="px-3 py-2">
                {it.paymentName} <span className="font-mono text-xs text-slate-500">({it.paymentCode})</span>
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
                  className="h-4 w-4 accent-blue-600"
                />
              </td>
              <td className="px-3 py-2">
                {it.roundId ? (
                  <Link href={`/rounds/${it.roundId}`} className="text-blue-600 hover:underline">
                    #{it.roundId}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => removeItem(it.id)}
                  className="text-red-600 hover:underline text-sm"
                >
                  Видалити
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
