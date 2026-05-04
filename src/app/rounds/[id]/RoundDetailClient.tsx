"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addCurrentPayment,
  deleteCurrentPayment,
  deleteRound,
  setRoundClosed,
  updateCurrentPayment,
  updateRoundMeta,
} from "../actions";
import { formatDate, formatUAH, toDateInputValue } from "@/lib/format";
import { useToast } from "@/components/Toast";

type Item = {
  id: number;
  pensionerId: number;
  pensionerName: string;
  pensionerBuildingId: number;
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
  closedAt: string | null;
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
  const router = useRouter();
  const { showToast } = useToast();
  const [editMeta, setEditMeta] = useState(false);
  const [date, setDate] = useState(toDateInputValue(round.date));
  const [postmanId, setPostmanId] = useState<number | "">(round.postmanId ?? "");
  const [notes, setNotes] = useState(round.notes ?? "");

  const [showAdd, setShowAdd] = useState(false);
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
    const map = new Map<
      number,
      { name: string; address: string; buildingId: number; items: Item[] }
    >();
    for (const it of items) {
      const g = map.get(it.pensionerId);
      if (g) g.items.push(it);
      else
        map.set(it.pensionerId, {
          name: it.pensionerName,
          address: it.pensionerAddress,
          buildingId: it.pensionerBuildingId,
          items: [it],
        });
    }
    return Array.from(map.entries()).map(([pid, g]) => {
      const sortedItems = g.items
        .slice()
        .sort((a, b) => Number(a.isPaid) - Number(b.isPaid));
      const done = g.items.length > 0 && g.items.every((it) => it.isPaid);
      return { pensionerId: pid, ...g, items: sortedItems, done };
    });
  }, [items]);

  const todoGroups = useMemo(() => grouped.filter((g) => !g.done), [grouped]);
  const doneGroups = useMemo(() => grouped.filter((g) => g.done), [grouped]);

  const saveMeta = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateRoundMeta(round.id, {
          date,
          postmanId: postmanId === "" ? null : Number(postmanId),
          notes: notes.trim() || null,
        });
        setEditMeta(false);
        showToast("Збережено", "success");
      } catch (e) {
        showToast(
          `Не вдалось зберегти: ${e instanceof Error ? e.message : "невідома помилка"}`,
          "error"
        );
      }
    });
  };

  const toggleIsPaid = (id: number, next: boolean) => {
    startTransition(async () => {
      try {
        await updateCurrentPayment(id, round.id, { isPaid: next });
      } catch (e) {
        showToast(
          `Не вдалось оновити статус: ${e instanceof Error ? e.message : "невідома помилка"}`,
          "error"
        );
      }
    });
  };

  const changeAmount = (id: number, amount: number) => {
    startTransition(async () => {
      try {
        await updateCurrentPayment(id, round.id, { amount });
      } catch (e) {
        showToast(
          `Не вдалось оновити суму: ${e instanceof Error ? e.message : "невідома помилка"}`,
          "error"
        );
      }
    });
  };

  const removeItem = (id: number) => {
    if (!confirm("Видалити цю виплату?")) return;
    startTransition(async () => {
      const res = await deleteCurrentPayment(id, round.id);
      if (res?.error) showToast(res.error, "error");
      else showToast("Виплату видалено", "success");
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
        showToast(res.error, "error");
        return;
      }
      setNewPensionerId("");
      setNewPaymentId("");
      setNewAmount("");
      setShowAdd(false);
      showToast("Виплату додано", "success");
    });
  };

  const removeRound = () => {
    if (!confirm("Видалити весь обхід разом з виплатами?")) return;
    startTransition(async () => {
      const res = await deleteRound(round.id);
      if (res?.error) {
        showToast(res.error, "error");
        return;
      }
      showToast("Обхід видалено", "success");
      router.push("/rounds");
    });
  };

  const isClosed = !!round.closedAt;
  const toggleClosed = () => {
    const next = !isClosed;
    if (next) {
      const unpaid = items.filter((i) => !i.isPaid).length;
      const msg = unpaid
        ? `Закрити обхід? Залишилося незакритих виплат: ${unpaid}.`
        : "Закрити обхід?";
      if (!confirm(msg)) return;
    }
    startTransition(async () => {
      const res = await setRoundClosed(round.id, next);
      if (res?.error) {
        showToast(res.error, "error");
        return;
      }
      showToast(next ? "Обхід закрито" : "Обхід відкрито", "success");
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-3 md:p-4">
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
                className="rounded bg-blue-600 text-white px-4 py-2 text-sm"
              >
                Зберегти
              </button>
              <button
                onClick={() => setEditMeta(false)}
                className="rounded border border-slate-300 px-4 py-2 text-sm"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-semibold">
                  Обхід {formatDate(round.date)}
                </h1>
                {isClosed && (
                  <span className="rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-xs">
                    Закритий
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Поштар: {postmen.find((pm) => pm.id === round.postmanId)?.name ?? "—"}
              </div>
              {round.notes && (
                <div className="text-sm text-slate-600 mt-1">Примітки: {round.notes}</div>
              )}
              {isClosed && round.closedAt && (
                <div className="text-xs text-slate-500 mt-1">
                  Закритий {formatDate(round.closedAt)}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEditMeta(true)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                Редагувати
              </button>
              <button
                onClick={toggleClosed}
                disabled={isPending}
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                {isClosed ? "Відкрити обхід" : "Закрити обхід"}
              </button>
              <Link
                href={`/rounds/${round.id}/print`}
                target="_blank"
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Роздрукувати бігунки
              </Link>
              <button
                onClick={removeRound}
                className="rounded border border-red-300 text-red-700 px-3 py-2 text-sm hover:bg-red-50"
              >
                Видалити
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Stat title="План" value={formatUAH(totals.planned)} />
        <Stat title="Виплачено" value={formatUAH(totals.paid)} tone="green" />
        <Stat title="Залишок" value={formatUAH(totals.remaining)} tone="orange" />
      </div>

      {showAdd ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 md:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Додати виплату вручну</div>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-slate-500 text-sm px-2 py-1"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px] gap-2">
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
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addItem}
              disabled={isPending}
              className="rounded bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-60"
            >
              Додати
            </button>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-700"
        >
          + Додати виплату
        </button>
      )}

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
          У цьому обході поки немає виплат.
        </div>
      ) : (
        <div className="space-y-3">
          {todoGroups.map((g) => (
            <PensionerGroupCard
              key={g.pensionerId}
              group={g}
              onChangeAmount={changeAmount}
              onToggleIsPaid={toggleIsPaid}
              onRemoveItem={removeItem}
            />
          ))}

          {doneGroups.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center gap-3 text-xs text-slate-500 uppercase tracking-wide mb-2">
                <span>Виплачені ({doneGroups.length})</span>
                <span className="flex-1 border-t border-slate-200" />
              </div>
              <div className="space-y-3 opacity-80">
                {doneGroups.map((g) => (
                  <PensionerGroupCard
                    key={g.pensionerId}
                    group={g}
                    onChangeAmount={changeAmount}
                    onToggleIsPaid={toggleIsPaid}
                    onRemoveItem={removeItem}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type PensionerGroup = {
  pensionerId: number;
  name: string;
  address: string;
  buildingId: number;
  items: Item[];
  done: boolean;
};

function PensionerGroupCard({
  group: g,
  onChangeAmount,
  onToggleIsPaid,
  onRemoveItem,
}: {
  group: PensionerGroup;
  onChangeAmount: (id: number, amount: number) => void;
  onToggleIsPaid: (id: number, next: boolean) => void;
  onRemoveItem: (id: number) => void;
}) {
  const subPlanned = g.items.reduce((s, it) => s + it.amount, 0);
  const subPaid = g.items.filter((it) => it.isPaid).reduce((s, it) => s + it.amount, 0);
  return (
    <div
      className={`rounded-lg border p-3 md:p-4 ${
        g.done ? "border-green-200 bg-green-50/40" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/pensioners/${g.pensionerId}`}
            className="font-medium text-blue-700 hover:underline"
          >
            {g.name}
          </Link>
          <div>
            <Link
              href={`/district/${g.buildingId}`}
              className="text-xs text-blue-600 hover:underline"
            >
              {g.address}
            </Link>
          </div>
        </div>
        <div className="text-right text-sm shrink-0">
          <div className="font-medium">{formatUAH(subPlanned)}</div>
          <div className="text-xs text-green-700">{formatUAH(subPaid)}</div>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {g.items.map((it) => (
          <li
            key={it.id}
            className={`rounded border p-2 ${
              it.isPaid ? "border-green-200 bg-green-50/30" : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  {it.paymentName}{" "}
                  <span className="font-mono text-xs text-slate-500">({it.paymentCode})</span>
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                min={0}
                defaultValue={it.amount}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v) && v !== it.amount) onChangeAmount(it.id, v);
                }}
                className="input !w-28 text-right"
                aria-label="Сума"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm flex-1">
                <input
                  type="checkbox"
                  checked={it.isPaid}
                  onChange={(e) => onToggleIsPaid(it.id, e.target.checked)}
                  className="h-5 w-5 accent-blue-600"
                />
                <span
                  className={it.isPaid ? "text-green-700 font-medium" : "text-slate-600"}
                >
                  {it.isPaid ? "Виплачено" : "Відмітити виплаченою"}
                </span>
              </label>
              <button
                onClick={() => onRemoveItem(it.id)}
                className="text-red-600 text-sm px-2 py-1"
                aria-label="Видалити"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
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
    <div className="rounded-lg border border-slate-200 bg-white p-3 md:p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className={`text-base md:text-2xl font-semibold mt-1 ${color} truncate`}>{value}</div>
    </div>
  );
}
