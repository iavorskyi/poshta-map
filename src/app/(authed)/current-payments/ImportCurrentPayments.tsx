"use client";

import { useRef, useState, useTransition } from "react";
import { previewCurrentPaymentsImport, type CpPreview } from "./actions";
import { CurrentPaymentsPreview } from "./CurrentPaymentsPreview";
import { useGlobalPending } from "@/components/RouteProgress";

const MONTHS_UA = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

export function ImportCurrentPayments({
  payments,
}: {
  payments: { id: number; name: string; code: string }[];
}) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [paymentId, setPaymentId] = useState<number | "">(payments[0]?.id ?? "");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CpPreview | null>(null);
  const [parseErrors, setParseErrors] = useState<
    { rowNumber: number; message: string }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setParseErrors(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = () => {
    setError(null);
    setParseErrors(null);
    setPreview(null);
    if (!paymentId) {
      setError("Оберіть тип виплати");
      return;
    }
    if (!file) {
      setError("Оберіть файл");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("paymentId", String(paymentId));
    fd.set("year", String(year));
    fd.set("month", String(month));
    startTransition(async () => {
      try {
        const res = await previewCurrentPaymentsImport(fd);
        if (res.ok) {
          setPreview(res.preview);
        } else {
          setError(res.error);
          if (res.parseErrors) setParseErrors(res.parseErrors);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Помилка імпорту");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary"
      >
        Імпорт з Excel
      </button>
    );
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const inPreview = preview != null;

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-surface rounded-t-lg sm:rounded-lg border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
          <div className="font-semibold">
            {inPreview
              ? "Підтвердження імпорту виплат"
              : "Імпорт поточних виплат з Excel"}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="text-fg-subtle hover:text-fg px-2 py-1"
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {inPreview ? (
            <CurrentPaymentsPreview
              preview={preview!}
              onBack={() => setPreview(null)}
              onClose={() => {
                setOpen(false);
                reset();
              }}
            />
          ) : (
            <>
              <div className="text-sm text-fg-muted space-y-1">
                <p>
                  Колонки: <strong>ФІО</strong>, <strong>Вулиця</strong>,{" "}
                  <strong>Будинок</strong>, <strong>День</strong> (1..31),{" "}
                  <strong>Сума</strong>, Виплачено (так/ні). Пенсіонер шукається
                  за ФІО + вулицею + будинком — спершу точно, потім з допуском
                  на одруківки. Рішення (прив'язати до існуючого / створити
                  нового) підтверджується вручну на наступному кроці.
                </p>
                <p>
                  <strong>Один файл — один тип виплати.</strong> Місяць і рік
                  підставляються автоматично з полів нижче.
                </p>
              </div>

              <a
                href="/api/current-payments/template"
                className="inline-block text-sm link"
              >
                ↓ Завантажити шаблон .xlsx
              </a>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 text-sm sm:col-span-3">
                  <span className="text-xs text-fg-muted">Тип виплати *</span>
                  <select
                    value={paymentId}
                    onChange={(e) =>
                      setPaymentId(e.target.value ? Number(e.target.value) : "")
                    }
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
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-xs text-fg-muted">Місяць</span>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="input"
                  >
                    {MONTHS_UA.map((name, i) => (
                      <option key={i + 1} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-fg-muted">Рік</span>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="input"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setError(null);
                    setParseErrors(null);
                  }}
                  className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-elevated file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg hover:file:bg-border"
                />
                {file && (
                  <div className="text-xs text-fg-subtle mt-1">
                    {file.name} · {(file.size / 1024).toFixed(1)} КБ
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded border border-danger-border bg-danger-bg text-danger px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              {parseErrors && parseErrors.length > 0 && (
                <details
                  open
                  className="rounded border border-danger-border bg-danger-bg"
                >
                  <summary className="cursor-pointer px-3 py-2 text-sm text-danger">
                    Помилки парсингу ({parseErrors.length})
                  </summary>
                  <ul className="px-3 pb-3 text-xs text-danger space-y-1 max-h-60 overflow-y-auto">
                    {parseErrors.map((err, i) => (
                      <li key={i}>
                        {err.rowNumber > 0 ? `Рядок ${err.rowNumber}: ` : ""}
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!file || !paymentId || isPending}
                  className="btn-primary"
                >
                  {isPending ? "Підготовка…" : "Підготувати імпорт"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="ml-auto btn-secondary"
                >
                  Закрити
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
