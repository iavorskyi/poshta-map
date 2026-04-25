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
        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
      >
        Імпорт з Excel
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-white rounded-t-lg sm:rounded-lg border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white">
          <div className="font-semibold">Імпорт пенсіонерів з Excel</div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="text-slate-500 px-2 py-1"
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-600 space-y-1">
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
            className="inline-block text-sm text-blue-600 hover:underline"
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
              className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
            {file && (
              <div className="text-xs text-slate-500 mt-1">
                {file.name} · {(file.size / 1024).toFixed(1)} КБ
              </div>
            )}
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                Створено: <strong>{result.created}</strong> · Оновлено:{" "}
                <strong>{result.updated}</strong>
                {result.errors.length > 0 && (
                  <>
                    {" "}· Пропущено: <strong className="text-red-700">{result.errors.length}</strong>
                  </>
                )}
              </div>
              {result.errors.length > 0 && (
                <details className="rounded border border-red-200 bg-red-50">
                  <summary className="cursor-pointer px-3 py-2 text-sm text-red-700">
                    Помилки ({result.errors.length})
                  </summary>
                  <ul className="px-3 pb-3 text-xs text-red-700 space-y-1 max-h-60 overflow-y-auto">
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

          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={submit}
              disabled={!file || isPending}
              className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {isPending ? "Імпорт…" : "Імпортувати"}
            </button>
            {result && (
              <button
                type="button"
                onClick={reset}
                className="rounded border border-slate-300 px-4 py-2 text-sm"
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
              className="ml-auto rounded border border-slate-300 px-4 py-2 text-sm"
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
