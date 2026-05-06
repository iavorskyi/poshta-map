"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createCurrentPayment } from "./actions";
import { toDateInputValue } from "@/lib/format";
import { useToast } from "@/components/Toast";

export function AddCurrentPayment({
  pensioners,
  payments,
  defaultDate,
  defaultPensionerId,
}: {
  pensioners: { id: number; fullName: string }[];
  payments: { id: number; name: string; code: string }[];
  defaultDate?: string;
  defaultPensionerId?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [pensionerId, setPensionerId] = useState<number | "">(defaultPensionerId ?? "");
  const [paymentId, setPaymentId] = useState<number | "">("");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(defaultDate || toDateInputValue(new Date()));
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const canSubmit = pensioners.length > 0 && payments.length > 0;

  const submit = () => {
    setError(null);
    if (!pensionerId || !paymentId || amount === "" || !date) {
      setError("Заповніть усі поля");
      showToast("Заповніть усі поля", "error");
      return;
    }
    startTransition(async () => {
      const res = await createCurrentPayment({
        pensionerId: Number(pensionerId),
        paymentId: Number(paymentId),
        date,
        amount: Number(amount),
        isPaid,
      });
      if (res?.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      setPaymentId("");
      setAmount("");
      setIsPaid(false);
      setOpen(false);
      showToast("Виплату додано", "success");
    });
  };

  if (!canSubmit) {
    return (
      <div className="card p-4 text-sm text-fg-muted">
        Щоб додавати виплати, потрібно щонайменше один{" "}
        <Link href="/pensioners" className="link">
          пенсіонер
        </Link>{" "}
        і один{" "}
        <Link href="/payments" className="link">
          тип виплати
        </Link>
        .
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm text-fg-muted hover:border-brand hover:text-fg transition-colors"
      >
        + Додати поточну виплату
      </button>
    );
  }

  return (
    <div className="card p-3 md:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">Додати поточну виплату</div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-fg-subtle hover:text-fg text-sm px-2 py-1"
          aria-label="Закрити"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_150px_140px] gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">Пенсіонер</span>
          <select
            value={pensionerId}
            onChange={(e) => setPensionerId(e.target.value ? Number(e.target.value) : "")}
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
          <span className="text-xs text-fg-muted">Тип виплати</span>
          <select
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value ? Number(e.target.value) : "")}
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
          <span className="text-xs text-fg-muted">Дата</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">Сума</span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
            className="input"
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
            className="h-5 w-5 accent-brand"
          />
          Виплачено
        </label>
        <button
          onClick={submit}
          disabled={isPending}
          className="btn-primary"
        >
          Додати
        </button>
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}
    </div>
  );
}
