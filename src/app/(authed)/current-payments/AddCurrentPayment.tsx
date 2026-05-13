"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createCurrentPayment } from "./actions";
import { toDateInputValue } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { useGlobalPending } from "@/components/RouteProgress";
import {
  PaymentTypeManager,
  type PaymentType,
} from "@/components/PaymentTypeManager";

export function AddCurrentPayment({
  pensioners,
  payments,
  defaultDate,
  defaultPensionerId,
  isAdmin,
}: {
  pensioners: { id: number; fullName: string }[];
  payments: { id: number; name: string; code: string }[];
  defaultDate?: string;
  defaultPensionerId?: number | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pensionerId, setPensionerId] = useState<number | "">(defaultPensionerId ?? "");
  const [paymentId, setPaymentId] = useState<number | "">("");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(defaultDate || toDateInputValue(new Date()));
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const { showToast } = useToast();

  const [localPayments, setLocalPayments] = useState<PaymentType[]>(payments);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerMode, setManagerMode] = useState<"list" | "create">("list");

  useEffect(() => {
    setLocalPayments(payments);
  }, [payments]);

  const canSubmit = pensioners.length > 0 && localPayments.length > 0;

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

  const onPaymentSelectChange = (value: string) => {
    if (value === "__create__") {
      if (!isAdmin) return;
      setManagerMode("create");
      setManagerOpen(true);
      return;
    }
    if (value === "__manage__") {
      if (!isAdmin) return;
      setManagerMode("list");
      setManagerOpen(true);
      return;
    }
    setPaymentId(value ? Number(value) : "");
  };

  if (!canSubmit) {
    return (
      <>
        <div className="card p-4 text-sm text-fg-muted">
          Щоб додавати виплати, потрібно щонайменше один{" "}
          <Link href="/pensioners" className="link">
            пенсіонер
          </Link>{" "}
          і один тип виплати
          {isAdmin && localPayments.length === 0 && (
            <>
              {" "}
              —{" "}
              <button
                type="button"
                onClick={() => {
                  setManagerMode("create");
                  setManagerOpen(true);
                }}
                className="link"
              >
                створити тип виплати
              </button>
            </>
          )}
          .
        </div>
        {isAdmin && (
          <PaymentTypeManager
            open={managerOpen}
            initialMode={managerMode}
            payments={localPayments}
            onChange={setLocalPayments}
            onCreated={(p) => setPaymentId(p.id)}
            onClose={() => setManagerOpen(false)}
          />
        )}
      </>
    );
  }

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm text-fg-muted hover:border-brand hover:text-fg transition-colors"
        >
          + Додати поточну виплату
        </button>
        {isAdmin && (
          <PaymentTypeManager
            open={managerOpen}
            initialMode={managerMode}
            payments={localPayments}
            onChange={setLocalPayments}
            onCreated={(p) => setPaymentId(p.id)}
            onClose={() => setManagerOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
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
              onChange={(e) => onPaymentSelectChange(e.target.value)}
              className="input"
            >
              <option value="">— оберіть —</option>
              {localPayments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
              {isAdmin && (
                <>
                  <option disabled>──────────</option>
                  <option value="__create__">+ Створити новий тип…</option>
                  <option value="__manage__">⚙ Керувати типами…</option>
                </>
              )}
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
      {isAdmin && (
        <PaymentTypeManager
          open={managerOpen}
          initialMode={managerMode}
          payments={localPayments}
          onChange={setLocalPayments}
          onCreated={(p) => setPaymentId(p.id)}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </>
  );
}
