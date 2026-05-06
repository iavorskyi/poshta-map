"use client";

import { useRef, useState, useTransition } from "react";
import { importPensioners, type ImportResult } from "./actions";

export function ImportPensioners() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    setError(null);
    setResult(null);
    if (!file) {
      setError("Оберіть файл");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      try {
        const res = await importPensioners(fd);
        setResult(res);
        if (res.errors.length === 0) {
          setOpen(false);
          reset();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Помилка імпорту");
      }
    });
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
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

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-surface rounded-t-lg sm:rounded-lg border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
          <div className="font-semibold">Імпорт пенсіонерів з Excel</div>
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
              Колонки: <strong>ФІО</strong>, <strong>Вулиця</strong>, <strong>Будинок</strong>,
              Квартира, Телефон, Паспорт, <strong>День пенсії</strong>, Примітки. Жирним —
              обов&apos;язкові.
            </p>
            <p>
              Якщо знайдено пенсіонера з тим самим ФІО та адресою — його дані будуть оновлені.
              Інакше — створиться новий запис.
            </p>
          </div>

          <a
            href="/api/pensioners/template"
            className="inline-block text-sm link"
          >
            ↓ Завантажити шаблон .xlsx
          </a>

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
                Створено: <strong>{result.created}</strong> · Оновлено:{" "}
                <strong>{result.updated}</strong>
                {result.errors.length > 0 && (
                  <>
                    {" "}· Пропущено: <strong className="text-danger">{result.errors.length}</strong>
                  </>
                )}
              </div>
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
              disabled={!file || isPending}
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
