"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toDateInputValue } from "@/lib/format";
import { useGlobalPending } from "@/components/RouteProgress";
import { previewNoticeSlipImport, type NoticeSlipDefaults } from "./actions";
import type { NoticeSlipPrintData } from "@/lib/noticeSlipShared";
import type { NoticeSlipRow, RowError } from "@/lib/noticeSlipImport";

export function ImportNoticeSlips({
  defaults,
  onRowsChange,
}: {
  defaults: NoticeSlipDefaults;
  onRowsChange: (rows: NoticeSlipPrintData[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<NoticeSlipRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<RowError[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const inputRef = useRef<HTMLInputElement>(null);

  const [batchDate, setBatchDate] = useState(toDateInputValue(new Date()));
  const [branchAddress, setBranchAddress] = useState(defaults.branchAddress);
  const [workingHours, setWorkingHours] = useState(defaults.workingHours);
  const [phone, setPhone] = useState(defaults.phone);

  useEffect(() => {
    if (!rows || rows.length === 0) {
      onRowsChange([]);
      return;
    }
    onRowsChange(
      rows.map((r) => ({
        key: `import-${r.rowNumber}`,
        name: r.name,
        address: r.address,
        itemType: r.itemType,
        trackingNumber: r.trackingNumber,
        branchAddress,
        workingHours,
        phone,
        dateStr: batchDate,
      }))
    );
  }, [rows, batchDate, branchAddress, workingHours, phone, onRowsChange]);

  const reset = () => {
    setFile(null);
    setRows(null);
    setParseErrors(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = () => {
    setError(null);
    setParseErrors(null);
    setRows(null);
    if (!file) {
      setError("Оберіть файл");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await previewNoticeSlipImport(fd);
      if (res.ok) {
        setRows(res.rows);
        setParseErrors(res.errors.length ? res.errors : null);
      } else {
        setError(res.error);
        if (res.parseErrors) setParseErrors(res.parseErrors);
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

  return (
    <div className="card p-3 md:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">Масовий імпорт з Excel</div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="text-fg-subtle hover:text-fg text-sm px-2 py-1"
          aria-label="Закрити"
        >
          ✕
        </button>
      </div>

      <div className="text-sm text-fg-muted space-y-1">
        <p>Колонки: ФІО, Адреса, ШКІ, Тип (просте/рекомендоване).</p>
        <p>
          Якщо адреса не вказана окремою колонкою, її можна дописати в дужках у
          колонці ФІО — розпізнається автоматично.
        </p>
      </div>

      <a href="/api/notice-slips/template" className="inline-block text-sm link">
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
            setRows(null);
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
            Помилки в рядках ({parseErrors.length})
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!file || isPending}
          className="btn-primary"
        >
          {isPending ? "Розбір файлу…" : "Розібрати файл"}
        </button>
      </div>

      {rows && rows.length > 0 && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="text-sm font-medium">
            Розпізнано {rows.length} {rows.length === 1 ? "рядок" : "рядків"} — додано до
            прев&apos;ю друку нижче
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-fg-muted">
                  <th className="pr-3 pb-1">ФІО</th>
                  <th className="pr-3 pb-1">Адреса</th>
                  <th className="pr-3 pb-1">Тип</th>
                  <th className="pr-3 pb-1">ШКІ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNumber} className="border-t border-border">
                    <td className="pr-3 py-1">{r.name}</td>
                    <td className="pr-3 py-1">{r.address}</td>
                    <td className="pr-3 py-1">
                      {r.itemType === "PLAIN" ? "просте" : "рекомендоване"}
                    </td>
                    <td className="pr-3 py-1">{r.trackingNumber ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-fg-muted">Дата вкладення (спільна для пачки)</span>
              <input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-fg-muted">Адреса відділення</span>
              <input
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-fg-muted">Режим роботи</span>
              <input
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-fg-muted">Телефон</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
