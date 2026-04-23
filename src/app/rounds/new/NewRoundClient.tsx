"use client";

import { useMemo, useState, useTransition } from "react";
import { createRound } from "../actions";
import { formatUAH, toDateInputValue, fromDateInputValue } from "@/lib/format";

type Pensioner = {
  id: number;
  fullName: string;
  address: string;
  pensionPaymentDay: number;
};

type Payment = { id: number; name: string; code: string };
type Postman = { id: number; name: string };

type Draft = {
  pensionerId: number;
  items: {
    key: string;
    paymentId: number | "";
    amount: number | "";
  }[];
};

export function NewRoundClient({
  pensioners,
  payments,
  postmen,
}: {
  pensioners: Pensioner[];
  payments: Payment[];
  postmen: Postman[];
}) {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [date, setDate] = useState(today);
  const [postmanId, setPostmanId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [manualPensionerId, setManualPensionerId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDay = date ? fromDateInputValue(date).getDate() : null;

  const suggested = useMemo(() => {
    if (selectedDay == null) return [];
    return pensioners.filter((p) => {
      if (drafts.some((d) => d.pensionerId === p.id)) return false;
      return p.pensionPaymentDay === selectedDay;
    });
  }, [pensioners, selectedDay, drafts]);

  const addPensioner = (pensionerId: number) => {
    setDrafts((ds) => [
      ...ds,
      {
        pensionerId,
        items: [
          {
            key: `${pensionerId}-init-${Date.now()}`,
            paymentId: "",
            amount: "",
          },
        ],
      },
    ]);
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
                { key: `${pensionerId}-new-${Date.now()}`, paymentId: "", amount: "" },
              ],
            }
          : d
      )
    );
  };

  const updateItem = (
    pensionerId: number,
    key: string,
    patch: Partial<Draft["items"][number]>
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
    const initial: { pensionerId: number; paymentId: number; amount: number }[] = [];
    for (const d of drafts) {
      for (const it of d.items) {
        if (!it.paymentId || it.amount === "" || Number.isNaN(Number(it.amount))) {
          setError("У кожної виплати має бути тип і сума");
          return;
        }
        initial.push({
          pensionerId: d.pensionerId,
          paymentId: Number(it.paymentId),
          amount: Number(it.amount),
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

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-slate-600">Дата обходу *</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              required
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
          <label className="flex flex-col gap-1 text-sm md:col-span-1">
            <span className="text-xs text-slate-600">Примітки</span>
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
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-2">
          <div className="font-medium text-sm">
            Пропозиції на {selectedDay}-е число (день виплати пенсії, {suggested.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {suggested.map((pensioner) => (
              <button
                type="button"
                key={pensioner.id}
                onClick={() => addPensioner(pensioner.id)}
                className="text-left rounded border border-blue-300 bg-white px-3 py-2 text-sm hover:bg-blue-100"
              >
                <div className="font-medium">{pensioner.fullName}</div>
                <div className="text-xs text-slate-500">{pensioner.address}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">Пенсіонери в обході</div>
          <div className="flex items-center gap-2">
            <select
              value={manualPensionerId}
              onChange={(e) => setManualPensionerId(e.target.value ? Number(e.target.value) : "")}
              className="input max-w-xs"
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
              className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Додати
            </button>
          </div>
        </div>

        {drafts.length === 0 ? (
          <div className="text-sm text-slate-500">Ще нікого не додано.</div>
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
                <div key={d.pensionerId} className="rounded border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.fullName}</div>
                      <div className="text-xs text-slate-500">{p.address}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">{formatUAH(subtotal)}</div>
                      <button
                        type="button"
                        onClick={() => removePensioner(d.pensionerId)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Прибрати
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {d.items.map((it) => (
                      <div
                        key={it.key}
                        className="grid grid-cols-[1fr_140px_auto] gap-2 items-center"
                      >
                        <select
                          value={it.paymentId}
                          onChange={(e) =>
                            updateItem(d.pensionerId, it.key, {
                              paymentId: e.target.value ? Number(e.target.value) : "",
                            })
                          }
                          className="input"
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
                          onChange={(e) =>
                            updateItem(d.pensionerId, it.key, {
                              amount: e.target.value ? Number(e.target.value) : "",
                            })
                          }
                          className="input"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(d.pensionerId, it.key)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addItem(d.pensionerId)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      + Додати виплату
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end pt-2 border-t border-slate-100 text-sm">
          <div className="text-slate-600 mr-2">Разом заплановано:</div>
          <div className="font-semibold">{formatUAH(totalPlanned)}</div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60"
        >
          Створити обхід
        </button>
      </div>
    </form>
  );
}
