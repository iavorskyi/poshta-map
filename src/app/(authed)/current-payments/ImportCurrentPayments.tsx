"use client";

import { useRef, useState, useTransition } from "react";
import { importCurrentPayments, type CpImportResult } from "./actions";

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
  const [result, setResult] = useState<CpImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = () => {
    setError(null);
    setResult(null);
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
        const res = await importCurrentPayments(fd);
        setResult(res);
        if (res.errors.length === 0 && res.warnings.length === 0) {
          setOpen(false);
          reset();
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

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-surface rounded-t-lg sm:rounded-lg border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
          <div className="font-semibold">Імпорт поточних виплат з Excel</div>
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
          <div className="text-sm text-fg-muted space-y-1">
            <p>
              Колонки: <strong>ФІО</strong>, <strong>Вулиця</strong>, <strong>Будинок</strong>,{" "}
              <strong>День</strong> (1..31), <strong>Сума</strong>, Виплачено
              (так/ні). Пенсіонер шукається за ФІО + вулицею + будинком.
            </p>
            <p>
              <strong>Один файл — один тип виплати.</strong> Місяць і рік підставляються
              автоматично з полів нижче.
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
                setResult(null);
                setError(null);
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

          {result && (
            <div className="space-y-2">
              <div className="rounded border border-border bg-elevated px-3 py-2 text-sm">
                Створено: <strong>{result.created}</strong>
                {result.warnings.length > 0 && (
                  <>
                    {" "}· Пропущено: <strong className="text-warning">{result.warnings.length}</strong>
                  </>
                )}
                {result.errors.length > 0 && (
                  <>
                    {" "}· Помилок: <strong className="text-danger">{result.errors.length}</strong>
                  </>
                )}
              </div>
              {result.warnings.length > 0 && (
                <details className="rounded border border-warning-border bg-warning-bg">
                  <summary className="cursor-pointer px-3 py-2 text-sm text-warning">
                    Попередження ({result.warnings.length})
                  </summary>
                  <ul className="px-3 pb-3 text-xs text-warning space-y-1 max-h-60 overflow-y-auto">
                    {result.warnings.map((w, i) => (
                      <li key={i}>
                        Рядок {w.rowNumber}: {w.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {result.errors.length > 0 && (
                <details className="rounded border border-danger-border bg-danger-bg">
                  <summary className="cursor-pointer px-3 py-2 text-sm text-danger">
                    Помилки ({result.errors.length})
                  </summary>
                  <ul className="px-3 pb-3 text-xs text-danger space-y-1 max-h-60 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i}>
                        {err.rowNumber > 0 ? `Рядок ${err.rowNumber}: ` : ""}
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
            <button
              type="button"
              onClick={submit}
              disabled={!file || !paymentId || isPending}
              className="btn-primary"
            >
              {isPending ? "Імпорт…" : "Імпортувати"}
            </button>
            {result && (
              <button
                type="button"
                onClick={reset}
                className="btn-secondary"
              >
                Імпортувати ще
              </button>
            )}
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
        </div>
      </div>
    </div>
  );
}
