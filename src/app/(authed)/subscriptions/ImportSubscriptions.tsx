"use client";

import { useRef, useState, useTransition } from "react";
import { previewSubscriptionsImport, type SubImportPreview } from "./importActions";
import { SubscriptionImportPreview } from "./SubscriptionImportPreview";
import { useGlobalPending } from "@/components/RouteProgress";

export function ImportSubscriptions() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SubImportPreview | null>(null);
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
    if (!file) {
      setError("Оберіть файл");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      try {
        const res = await previewSubscriptionsImport(fd);
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
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        Імпорт з Excel
      </button>
    );
  }

  const inPreview = preview != null;

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-surface rounded-t-lg sm:rounded-lg border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
          <div className="font-semibold">
            {inPreview ? "Підтвердження імпорту передплат" : "Імпорт передплат з Excel"}
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
            <SubscriptionImportPreview
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
                  Аркуш <strong>Передплати</strong>, один рядок = одна передплата
                  (передплатник × видання × рік). Колонки: <strong>Рік</strong>,{" "}
                  <strong>Код видання</strong>, <strong>ПІБ</strong>, Тип, Телефон,
                  Вулиця/Буд./Кор./Кв., Доставка, <strong>01…12</strong> (кількість
                  примірників на місяць). Видання беруться за кодом — відсутні
                  створяться автоматично.
                </p>
                <p>
                  Передплатник розпізнається за ПІБ + адресою; рішення
                  (прив&apos;язати до наявного / створити нового) підтверджується
                  вручну на наступному кроці. Повторний імпорт того самого року
                  оновлює кількості, дублів не створює.
                </p>
              </div>

              <a href="/api/subscriptions/template" className="inline-block text-sm link">
                ↓ Завантажити шаблон .xlsx
              </a>

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
                <details open className="rounded border border-danger-border bg-danger-bg">
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
                  disabled={!file || isPending}
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
