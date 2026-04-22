"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addCurrentPayment,
  deleteCurrentPayment,
  deleteRound,
  updateCurrentPayment,
  updateRoundMeta,
} from "../actions";
import { formatDate, formatUAH, toDateInputValue } from "@/lib/format";

type Item = {
  id: number;
  pensionerId: number;
  pensionerName: string;
  pensionerAddress: string;
  paymentId: number;
  paymentName: string;
  paymentCode: string;
  amount: number;
  isPaid: boolean;
};

type Round = {
  id: number;
  date: string; // ISO
  postmanId: number | null;
  notes: string | null;
};

type Payment = { id: number; name: string; code: string };
type Postman = { id: number; name: string };

export function RoundDetailClient({
  round,
  items,
  pensioners,
  payments,
  postmen,
}: {
  round: Round;
  items: Item[];
  pensioners: { id: number; fullName: string }[];
  payments: Payment[];
  postmen: Postman[];
}) {
  const [editMeta, setEditMeta] = useState(false);
  const [date, setDate] = useState(toDateInputValue(round.date));
  const [postmanId, setPostmanId] = useState<number | "">(round.postmanId ?? "");
  const [notes, setNotes] = useState(round.notes ?? "");

  const [newPensionerId, setNewPensionerId] = useState<number | "">("");
  const [newPaymentId, setNewPaymentId] = useState<number | "">("");
  const [newAmount, setNewAmount] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const totals = useMemo(() => {
    const planned = items.reduce((s, it) => s + it.amount, 0);
    const paid = items.filter((i) => i.isPaid).reduce((s, it) => s + it.amount, 0);
    return { planned, paid, remaining: planned - paid };
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<number, { name: string; address: string; items: Item[] }>();
    for (const it of items) {
      const g = map.get(it.pensionerId);
      if (g) g.items.push(it);
      else
        map.set(it.pensionerId, {
          name: it.pensionerName,
          address: it.pensionerAddress,
          items: [it],
        });
    }
    return Array.from(map.entries()).map(([pid, g]) => ({ pensionerId: pid, ...g }));
  }, [items]);

  const saveMeta = () => {
    setError(null);
    startTransition(async () => {
      await updateRoundMeta(round.id, {
        date,
        postmanId: postmanId === "" ? null : Number(postmanId),
        notes: notes.trim() || null,
      });
      setEditMeta(false);
    });
  };

  const toggleIsPaid = (id: number, next: boolean) => {
    startTransition(async () => {
      await updateCurrentPayment(id, round.id, { isPaid: next });
    });
  };

  const changeAmount = (id: number, amount: number) => {
    startTransition(async () => {
      await updateCurrentPayment(id, round.id, { amount });
    });
  };

  const removeItem = (id: number) => {
    if (!confirm("Видалити цю виплату?")) return;
    startTransition(async () => {
      await deleteCurrentPayment(id, round.id);
    });
  };

  const addItem = () => {
    setError(null);
    if (!newPensionerId || !newPaymentId || newAmount === "") {
      setError("Заповніть пенсіонера, тип виплати і суму");
      return;
    }
    startTransition(async () => {
      const res = await addCurrentPayment(round.id, {
        pensionerId: Number(newPensionerId),
        paymentId: Number(newPaymentId),
        amount: Number(newAmount),
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setNewPensionerId("");
      setNewPaymentId("");
      setNewAmount("");
    });
  };

  const removeRound = () => {
    if (!confirm("Видалити весь обхід разом з виплатами?")) return;
    startTransition(async () => {
      await deleteRound(round.id);
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {editMeta ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-slate-600">Дата</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-slate-600">Поштар</span>
                <select
                  value={postmanId}
                  onChange={(e) => setPostmanId(e.target.value ? Number(e.target.value) : "")}
                  className="input"
                >
                  <option value="">— не обрано —</option>
                  {postmen.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-slate-600">Примітки</span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveMeta}
                disabled={isPending}
                className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm"
              >
                Зберегти
              </button>
              <button
                onClick={() => setEditMeta(false)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Обхід {formatDate(round.date)}</h1>
              <div className="text-sm text-slate-600 mt-1">
                Поштар: {postmen.find((pm) => pm.id === round.postmanId)?.name ?? "—"}
              </div>
              {round.notes && (
                <div className="text-sm text-slate-600 mt-1">Примітки: {round.notes}</div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditMeta(true)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                Редагувати
              </button>
              <button
                onClick={removeRound}
                className="rounded border border-red-300 text-red-700 px-3 py-1.5 text-sm hover:bg-red-50"
              >
                Видалити
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat title="Запланована сума виплат" value={formatUAH(totals.planned)} />
        <Stat title="Фактично виплачено" value={formatUAH(totals.paid)} tone="green" />
        <Stat title="Залишок" value={formatUAH(totals.remaining)} tone="orange" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="font-medium">Додати виплату вручну</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_auto] gap-2 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-slate-600">Пенсіонер</span>
            <select
              value={newPensionerId}
              onChange={(e) => setNewPensionerId(e.target.value ? Number(e.target.value) : "")}
              className="input"
            >
              <option value="">— оберіть —</option>
              {pensioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-slate-600">Тип виплати</span>
            <select
              value={newPaymentId}
              onChange={(e) => setNewPaymentId(e.target.value ? Number(e.target.value) : "")}
              className="input"
            >
              <option value="">— оберіть —</option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-slate-600">Сума</span>
            <input
              type="number"
              step="0.01"
              min={0}
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value ? Number(e.target.value) : "")}
              className="input"
            />
          </label>
          <button
            type="button"
            onClick={addItem}
            disabled={isPending}
            className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:opacity-60"
          >
            Додати
          </button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <div className="space-y-3">
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
            У цьому обході поки немає виплат.
          </div>
        ) : (
          grouped.map((g) => {
            const subPlanned = g.items.reduce((s, it) => s + it.amount, 0);
            const subPaid = g.items
              .filter((it) => it.isPaid)
              .reduce((s, it) => s + it.amount, 0);
            return (
              <div
                key={g.pensionerId}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-slate-500">{g.address}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>
                      План: <span className="font-medium">{formatUAH(subPlanned)}</span>
                    </div>
                    <div className="text-green-700">Виплачено: {formatUAH(subPaid)}</div>
                  </div>
                </div>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs">
                      <th className="text-left font-normal">Тип</th>
                      <th className="text-left font-normal">Код</th>
                      <th className="text-right font-normal">Сума</th>
                      <th className="text-center font-normal w-28">Виплачено</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="py-2">{it.paymentName}</td>
                        <td className="py-2 font-mono text-xs">{it.paymentCode}</td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            defaultValue={it.amount}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isNaN(v) && v !== it.amount) changeAmount(it.id, v);
                            }}
                            className="input w-28 text-right"
                          />
                        </td>
                        <td className="py-2 text-center">
                          <input
                            type="checkbox"
                            checked={it.isPaid}
                            onChange={(e) => toggleIsPaid(it.id, e.target.checked)}
                            className="h-4 w-4 accent-blue-600"
                          />
                        </td>
                        <td className="py-2 text-right">
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
          })
        )}
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: "green" | "orange";
}) {
  const color =
    tone === "green"
      ? "text-green-700"
      : tone === "orange"
      ? "text-orange-700"
      : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
