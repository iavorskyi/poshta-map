"use client";

import { useMemo, useState, useTransition } from "react";
import { createRound } from "../actions";
import { formatUAH, toDateInputValue, fromDateInputValue } from "@/lib/format";
import { useToast } from "@/components/Toast";

type Pensioner = {
  id: number;
  fullName: string;
  address: string;
  pensionPaymentDay: number;
};

type Payment = { id: number; name: string; code: string };
type Postman = { id: number; name: string };

type ExistingCP = {
  id: number;
  paymentId: number;
  amount: number;
  isPaid: boolean;
  roundId: number | null;
};

type DraftItem = {
  key: string;
  existingId?: number;
  paymentId: number | "";
  amount: number | "";
  isPaid: boolean;
};

type Draft = {
  pensionerId: number;
  items: DraftItem[];
};

type PaymentTemplate = { paymentId: number; amount: number };

export function NewRoundClient({
  pensioners,
  payments,
  postmen,
  pensionerMonthPayments,
  pensionerPaymentTemplates,
  isAdmin,
}: {
  pensioners: Pensioner[];
  payments: Payment[];
  postmen: Postman[];
  pensionerMonthPayments: Record<number, ExistingCP[]>;
  pensionerPaymentTemplates: Record<number, PaymentTemplate[]>;
  isAdmin: boolean;
}) {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [date, setDate] = useState(today);
  const [postmanId, setPostmanId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [manualPensionerId, setManualPensionerId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const selectedDay = date ? fromDateInputValue(date).getDate() : null;

  const suggested = useMemo(() => {
    if (selectedDay == null) return [];
    return pensioners.filter((p) => {
      if (drafts.some((d) => d.pensionerId === p.id)) return false;
      return p.pensionPaymentDay === selectedDay;
    });
  }, [pensioners, selectedDay, drafts]);

  const addPensioner = (pensionerId: number) => {
    const existing = pensionerMonthPayments[pensionerId] ?? [];
    const templates = pensionerPaymentTemplates[pensionerId] ?? [];
    const usedPaymentIds = new Set(existing.map((cp) => cp.paymentId));

    const items: DraftItem[] = [
      ...existing.map((cp) => ({
        key: `${pensionerId}-ex-${cp.id}`,
        existingId: cp.id,
        paymentId: cp.paymentId,
        amount: cp.amount,
        isPaid: cp.isPaid,
      })),
      ...templates
        .filter((t) => !usedPaymentIds.has(t.paymentId))
        .map((t, i) => ({
          key: `${pensionerId}-tmpl-${t.paymentId}-${Date.now()}-${i}`,
          paymentId: t.paymentId,
          amount: t.amount,
          isPaid: false,
        })),
    ];

    if (items.length === 0) {
      items.push({
        key: `${pensionerId}-init-${Date.now()}`,
        paymentId: "",
        amount: "",
        isPaid: false,
      });
    }

    setDrafts((ds) => [...ds, { pensionerId, items }]);
  };

  const removePensioner = (pensionerId: number) =>
    setDrafts((ds) => ds.filter((d) => d.pensionerId !== pensionerId));

  const addItem = (pensionerId: number) => {
    setDrafts((ds) =>
      ds.map((d) =>
        d.pensionerId === pensionerId
          ? {
              ...d,
              items: [
                ...d.items,
                {
                  key: `${pensionerId}-new-${Date.now()}`,
                  paymentId: "",
                  amount: "",
                  isPaid: false,
                },
              ],
            }
          : d
      )
    );
  };

  const updateItem = (
    pensionerId: number,
    key: string,
    patch: Partial<DraftItem>
  ) => {
    setDrafts((ds) =>
      ds.map((d) =>
        d.pensionerId === pensionerId
          ? { ...d, items: d.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }
          : d
      )
    );
  };

  const removeItem = (pensionerId: number, key: string) => {
    setDrafts((ds) =>
      ds.map((d) =>
        d.pensionerId === pensionerId
          ? { ...d, items: d.items.filter((it) => it.key !== key) }
          : d
      )
    );
  };

  const totalPlanned = drafts.reduce(
    (sum, d) =>
      sum + d.items.reduce((s, it) => s + (typeof it.amount === "number" ? it.amount : 0), 0),
    0
  );

  const onSubmit = (formData: FormData) => {
    setError(null);
    const initial: {
      pensionerId: number;
      paymentId: number;
      amount: number;
      existingId?: number;
      isPaid?: boolean;
    }[] = [];
    for (const d of drafts) {
      for (const it of d.items) {
        if (!it.paymentId || it.amount === "" || Number.isNaN(Number(it.amount))) {
          setError("У кожної виплати має бути тип і сума");
          showToast("У кожної виплати має бути тип і сума", "error");
          return;
        }
        initial.push({
          pensionerId: d.pensionerId,
          paymentId: Number(it.paymentId),
          amount: Number(it.amount),
          existingId: it.existingId,
          isPaid: it.isPaid,
        });
      }
    }
    formData.set("initialPayments", JSON.stringify(initial));

    startTransition(async () => {
      const res = await createRound(formData);
      if (res && "error" in res && res.error) setError(res.error);
    });
  };

  const pensionerById = useMemo(
    () => Object.fromEntries(pensioners.map((p) => [p.id, p] as const)),
    [pensioners]
  );

  const availableForManual = pensioners.filter(
    (p) => !drafts.some((d) => d.pensionerId === p.id)
  );

  return (
    <form action={onSubmit} className="space-y-6">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="postmanId" value={postmanId === "" ? "" : String(postmanId)} />
      <input type="hidden" name="notes" value={notes} />

      <div className="card p-4 space-y-3">
        <div className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3`}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-fg-muted">Дата обходу *</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              required
            />
          </label>
          {isAdmin && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-fg-muted">Поштар</span>
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
          )}
          <label className="flex flex-col gap-1 text-sm md:col-span-1">
            <span className="text-xs text-fg-muted">Примітки</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              placeholder="Необов'язково"
            />
          </label>
        </div>
      </div>

      {suggested.length > 0 && (
        <div className="rounded-lg border border-brand bg-brand/10 p-4 space-y-2">
          <div className="font-medium text-sm">
            Пропозиції на {selectedDay}-е число (день виплати пенсії, {suggested.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {suggested.map((pensioner) => (
              <button
                type="button"
                key={pensioner.id}
                onClick={() => addPensioner(pensioner.id)}
                className="text-left rounded border border-border bg-surface px-3 py-2 text-sm hover:border-brand hover:bg-brand/10 transition-colors"
              >
                <div className="font-medium">{pensioner.fullName}</div>
                <div className="text-xs text-fg-subtle">{pensioner.address}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-medium">Пенсіонери в обході</div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={manualPensionerId}
              onChange={(e) => setManualPensionerId(e.target.value ? Number(e.target.value) : "")}
              className="input sm:max-w-xs"
            >
              <option value="">Додати вручну…</option>
              {availableForManual.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!manualPensionerId}
              onClick={() => {
                if (!manualPensionerId) return;
                addPensioner(Number(manualPensionerId));
                setManualPensionerId("");
              }}
              className="btn-secondary shrink-0"
            >
              Додати
            </button>
          </div>
        </div>

        {drafts.length === 0 ? (
          <div className="text-sm text-fg-subtle">Ще нікого не додано.</div>
        ) : (
          <div className="space-y-3">
            {drafts.map((d) => {
              const p = pensionerById[d.pensionerId];
              if (!p) return null;
              const subtotal = d.items.reduce(
                (s, it) => s + (typeof it.amount === "number" ? it.amount : 0),
                0
              );
              return (
                <div key={d.pensionerId} className="rounded border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.fullName}</div>
                      <div className="text-xs text-fg-subtle">{p.address}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">{formatUAH(subtotal)}</div>
                      <button
                        type="button"
                        onClick={() => removePensioner(d.pensionerId)}
                        className="text-sm text-danger hover:underline"
                      >
                        Прибрати
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {d.items.map((it) => {
                      const paid = it.isPaid;
                      return (
                        <div
                          key={it.key}
                          className={`grid grid-cols-[1fr_auto] md:grid-cols-[1fr_140px_auto] gap-2 items-center ${
                            paid ? "opacity-60" : ""
                          }`}
                        >
                          <select
                            value={it.paymentId}
                            disabled={paid}
                            onChange={(e) =>
                              updateItem(d.pensionerId, it.key, {
                                paymentId: e.target.value ? Number(e.target.value) : "",
                              })
                            }
                            className="input disabled:bg-elevated disabled:cursor-not-allowed col-span-2 md:col-span-1"
                          >
                            <option value="">— тип виплати —</option>
                            {payments.map((pay) => (
                              <option key={pay.id} value={pay.id}>
                                {pay.name} ({pay.code})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="Сума"
                            value={it.amount}
                            disabled={paid}
                            onChange={(e) =>
                              updateItem(d.pensionerId, it.key, {
                                amount: e.target.value ? Number(e.target.value) : "",
                              })
                            }
                            className="input disabled:bg-elevated disabled:cursor-not-allowed"
                          />
                          {paid ? (
                            <span
                              className="text-xs text-fg-subtle px-2 shrink-0"
                              title="Ця виплата вже оплачена в цьому місяці"
                            >
                              оплачено
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => removeItem(d.pensionerId, it.key)}
                              className="text-danger text-lg px-3 py-1 shrink-0"
                              aria-label="Видалити"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => addItem(d.pensionerId)}
                      className="text-sm link"
                    >
                      + Додати виплату
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end pt-2 border-t border-border text-sm">
          <div className="text-fg-muted mr-2">Разом заплановано:</div>
          <div className="font-semibold">{formatUAH(totalPlanned)}</div>
        </div>
      </div>

      {error && <div className="text-sm text-danger">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary"
        >
          Створити обхід
        </button>
      </div>
    </form>
  );
}
