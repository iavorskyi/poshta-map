"use client";

import { useMemo, useState, useTransition } from "react";
import {
  applyCurrentPaymentsImport,
  type CpApplyResult,
  type CpDecision,
  type CpPreview,
  type CpPreviewRow,
} from "./actions";
import { useGlobalPending } from "@/components/RouteProgress";

type DecisionMap = Record<
  number,
  | { action: "use_existing"; pensionerId: number }
  | { action: "create_new" }
  | { action: "skip" }
>;

function defaultDecision(row: CpPreviewRow): DecisionMap[number] | null {
  if (row.building.kind !== "ok") return null;
  if (!row.pensioner) return null;
  switch (row.pensioner.kind) {
    case "exact":
      return { action: "use_existing", pensionerId: row.pensioner.id };
    case "fuzzy":
      return {
        action: "use_existing",
        pensionerId: row.pensioner.candidates[0].id,
      };
    case "ambiguous":
      // Нехай користувач явно обере.
      return null;
    case "none":
      return { action: "create_new" };
  }
}

function rowIsError(row: CpPreviewRow): boolean {
  return row.building.kind === "error";
}

function rowNeedsDecision(row: CpPreviewRow): boolean {
  if (rowIsError(row)) return false;
  if (!row.pensioner) return false;
  return row.pensioner.kind === "ambiguous";
}

export function CurrentPaymentsPreview({
  preview,
  onBack,
  onClose,
}: {
  preview: CpPreview;
  onBack: () => void;
  onClose: () => void;
}) {
  const [decisions, setDecisions] = useState<DecisionMap>(() => {
    const init: DecisionMap = {};
    for (const r of preview.rows) {
      const d = defaultDecision(r);
      if (d) init[r.rowNumber] = d;
    }
    return init;
  });
  const [result, setResult] = useState<CpApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);

  const counts = useMemo(() => {
    let exact = 0;
    let fuzzy = 0;
    let ambiguous = 0;
    let none = 0;
    let buildingError = 0;
    let dup = 0;
    for (const r of preview.rows) {
      if (r.building.kind === "error") buildingError++;
      else if (r.pensioner?.kind === "exact") exact++;
      else if (r.pensioner?.kind === "fuzzy") fuzzy++;
      else if (r.pensioner?.kind === "ambiguous") ambiguous++;
      else if (r.pensioner?.kind === "none") none++;
      if (r.dupInMonth) dup++;
    }
    return { exact, fuzzy, ambiguous, none, buildingError, dup };
  }, [preview.rows]);

  const missingDecisions = preview.rows.some(
    (r) => rowNeedsDecision(r) && !decisions[r.rowNumber]
  );

  const setDecision = (rowNumber: number, value: DecisionMap[number]) => {
    setDecisions((prev) => ({ ...prev, [rowNumber]: value }));
  };

  const apply = () => {
    setError(null);
    setResult(null);
    const decisionList: CpDecision[] = [];
    for (const r of preview.rows) {
      if (rowIsError(r)) continue;
      const d = decisions[r.rowNumber];
      if (!d) continue;
      decisionList.push({ rowNumber: r.rowNumber, ...d });
    }
    const rowsPayload = preview.rows
      .filter((r) => !rowIsError(r))
      .map((r) => ({
        rowNumber: r.rowNumber,
        fullName: r.fullName,
        street: r.street,
        house: r.house,
        day: r.day,
        amount: r.amount,
        isPaid: r.isPaid,
      }));

    startTransition(async () => {
      try {
        const res = await applyCurrentPaymentsImport({
          paymentId: preview.paymentId,
          year: preview.year,
          month: preview.month,
          rows: rowsPayload,
          decisions: decisionList,
        });
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Помилка імпорту");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded border border-border bg-elevated px-3 py-2 text-sm">
        <div>
          Виплата: <strong>{preview.paymentName}</strong> ({preview.paymentCode}){" "}
          · {String(preview.month).padStart(2, "0")}.{preview.year}
        </div>
        <div className="text-xs text-fg-muted mt-1">
          Точно: <strong className="text-success">{counts.exact}</strong> ·
          {" "}Схоже: <strong className="text-warning">{counts.fuzzy}</strong> ·
          {" "}Кілька варіантів:{" "}
          <strong className="text-warning">{counts.ambiguous}</strong> ·
          {" "}Нові: <strong>{counts.none}</strong> ·
          {" "}Помилок будинків:{" "}
          <strong className="text-danger">{counts.buildingError}</strong>
          {counts.dup > 0 && (
            <>
              {" "}· Вже існують у місяці:{" "}
              <strong className="text-warning">{counts.dup}</strong>
            </>
          )}
        </div>
      </div>

      {preview.parseErrors.length > 0 && (
        <details className="rounded border border-warning-border bg-warning-bg" open>
          <summary className="cursor-pointer px-3 py-2 text-sm text-warning">
            Помилки парсингу ({preview.parseErrors.length})
          </summary>
          <ul className="px-3 pb-3 text-xs text-warning space-y-1 max-h-40 overflow-y-auto">
            {preview.parseErrors.map((e, i) => (
              <li key={i}>
                {e.rowNumber > 0 ? `Рядок ${e.rowNumber}: ` : ""}
                {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
        {preview.rows.map((row) => (
          <PreviewRowCard
            key={row.rowNumber}
            row={row}
            decision={decisions[row.rowNumber] ?? null}
            onChange={(d) => setDecision(row.rowNumber, d)}
            disabled={isPending || !!result}
          />
        ))}
      </ul>

      {error && (
        <div className="rounded border border-danger-border bg-danger-bg text-danger px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="rounded border border-border bg-elevated px-3 py-2 text-sm">
            Створено: <strong>{result.created}</strong>
            {result.createdPensioners.length > 0 && (
              <>
                {" "}· Додано пенсіонерів:{" "}
                <strong className="text-success">
                  {result.createdPensioners.length}
                </strong>
              </>
            )}
            {result.warnings.length > 0 && (
              <>
                {" "}· Пропущено:{" "}
                <strong className="text-warning">{result.warnings.length}</strong>
              </>
            )}
            {result.errors.length > 0 && (
              <>
                {" "}· Помилок:{" "}
                <strong className="text-danger">{result.errors.length}</strong>
              </>
            )}
          </div>
          {result.createdPensioners.length > 0 && (
            <details open className="rounded border border-border bg-elevated">
              <summary className="cursor-pointer px-3 py-2 text-sm">
                Створені пенсіонери ({result.createdPensioners.length})
              </summary>
              <ul className="px-3 pb-3 text-xs space-y-1 max-h-60 overflow-y-auto">
                {result.createdPensioners.map((p) => (
                  <li key={p.id}>
                    <a href={`/pensioners/${p.id}`} className="link">
                      {p.fullName}
                    </a>{" "}
                    <span className="text-fg-subtle">
                      — {p.street}, № {p.house}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
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
        {!result && (
          <>
            <button
              type="button"
              onClick={apply}
              disabled={isPending || missingDecisions}
              className="btn-primary"
              title={
                missingDecisions
                  ? "Прийміть рішення для всіх рядків з кількома варіантами"
                  : undefined
              }
            >
              {isPending ? "Імпорт…" : "Імпортувати"}
            </button>
            <button
              type="button"
              onClick={onBack}
              disabled={isPending}
              className="btn-secondary"
            >
              ← Повернутись
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto btn-secondary"
        >
          Закрити
        </button>
      </div>
    </div>
  );
}

function PreviewRowCard({
  row,
  decision,
  onChange,
  disabled,
}: {
  row: CpPreviewRow;
  decision: DecisionMap[number] | null;
  onChange: (d: DecisionMap[number]) => void;
  disabled: boolean;
}) {
  const addr = `${row.street}, ${row.house}`;

  if (row.building.kind === "error") {
    const err = row.building.error;
    let msg = "";
    if (err.kind === "ambiguous") {
      const list = err.candidates
        .map((c) => `"${c.street}, ${c.number}"`)
        .join(", ");
      msg = `Кілька будинків можуть відповідати: ${list}. Уточніть у файлі та повторіть імпорт.`;
    } else if (err.kind === "none") {
      msg = "Будинок не знайдено в дільниці. Виправте у файлі та повторіть імпорт.";
    } else {
      msg = err.message;
    }
    return (
      <li className="rounded border border-danger-border bg-danger-bg px-3 py-2 text-sm">
        <div className="font-medium">
          Рядок {row.rowNumber}: {row.fullName}
        </div>
        <div className="text-xs text-fg-muted">
          {addr} · день {row.day} · {row.amount}
        </div>
        <div className="text-danger text-xs mt-1">{msg}</div>
      </li>
    );
  }

  const buildingNote =
    row.building.matchedStreet &&
    row.building.matchedStreet !== row.street
      ? `Розпізнано "${row.street}" як "${row.building.matchedStreet}"`
      : null;

  const status = row.pensioner!;
  const statusBadge = (() => {
    switch (status.kind) {
      case "exact":
        return <span className="text-success text-xs">● Точний матч</span>;
      case "fuzzy":
        return <span className="text-warning text-xs">● Схоже на існуючого</span>;
      case "ambiguous":
        return (
          <span className="text-warning text-xs">● Кілька варіантів — оберіть</span>
        );
      case "none":
        return <span className="text-xs">● Новий пенсіонер</span>;
    }
  })();

  const containerClass = (() => {
    if (status.kind === "exact") return "border-success-border bg-success-bg";
    if (status.kind === "fuzzy") return "border-warning-border bg-warning-bg";
    if (status.kind === "ambiguous") return "border-warning-border bg-warning-bg";
    return "border-border bg-elevated";
  })();

  return (
    <li className={`rounded border ${containerClass} px-3 py-2 text-sm space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            Рядок {row.rowNumber}: {row.fullName}
          </div>
          <div className="text-xs text-fg-muted">
            {addr} · день {row.day} · {row.amount}
            {row.isPaid && " · виплачено"}
          </div>
          {buildingNote && (
            <div className="text-xs text-fg-muted mt-1">{buildingNote}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {statusBadge}
          {row.dupInMonth && (
            <span className="text-warning text-xs">⚠ Вже є в місяці</span>
          )}
        </div>
      </div>

      {status.kind === "exact" ? (
        <div className="text-xs text-fg-muted">
          → виплата буде прив'язана до{" "}
          <strong>{status.fullName}</strong>
        </div>
      ) : (
        <DecisionControls
          row={row}
          status={status}
          decision={decision}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </li>
  );
}

function DecisionControls({
  row,
  status,
  decision,
  onChange,
  disabled,
}: {
  row: CpPreviewRow;
  status: Exclude<CpPreviewRow["pensioner"], null | { kind: "exact"; id: number; fullName: string }>;
  decision: DecisionMap[number] | null;
  onChange: (d: DecisionMap[number]) => void;
  disabled: boolean;
}) {
  const rowKey = `r${row.rowNumber}`;

  const isUseExisting = (id: number) =>
    decision?.action === "use_existing" && decision.pensionerId === id;
  const isCreateNew = decision?.action === "create_new";
  const isSkip = decision?.action === "skip";

  const renderCandidate = (
    c: { id: number; fullName: string; distance: number },
    label: string
  ) => (
    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
      <input
        type="radio"
        name={`${rowKey}-action`}
        checked={isUseExisting(c.id)}
        disabled={disabled}
        onChange={() =>
          onChange({ action: "use_existing", pensionerId: c.id })
        }
      />
      <span>
        {label}: <strong>{c.fullName}</strong>
        {c.distance > 0 && (
          <span className="text-fg-subtle"> (відстань {c.distance})</span>
        )}
      </span>
    </label>
  );

  const otherOptions = row.buildingOptions.filter((o) => {
    if (status.kind === "fuzzy" || status.kind === "ambiguous") {
      return !status.candidates.some((c) => c.id === o.id);
    }
    return true;
  });

  return (
    <div className="space-y-1 pl-1">
      {status.kind === "fuzzy" &&
        status.candidates.map((c) => renderCandidate(c, "Прийняти запропонованого"))}
      {status.kind === "ambiguous" &&
        status.candidates.map((c) => renderCandidate(c, "Обрати"))}

      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="radio"
          name={`${rowKey}-action`}
          checked={isCreateNew}
          disabled={disabled}
          onChange={() => onChange({ action: "create_new" })}
        />
        <span>
          Створити нового з ФІО <strong>«{row.fullName}»</strong>
        </span>
      </label>

      {otherOptions.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span>Або обрати іншого в будинку:</span>
          <select
            disabled={disabled}
            value={
              decision?.action === "use_existing" &&
              otherOptions.some((o) => o.id === decision.pensionerId)
                ? decision.pensionerId
                : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onChange({ action: "use_existing", pensionerId: Number(v) });
            }}
            className="input py-0.5 text-xs"
          >
            <option value="">— оберіть —</option>
            {otherOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.fullName}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="radio"
          name={`${rowKey}-action`}
          checked={isSkip}
          disabled={disabled}
          onChange={() => onChange({ action: "skip" })}
        />
        <span className="text-fg-muted">Пропустити цей рядок</span>
      </label>
    </div>
  );
}
