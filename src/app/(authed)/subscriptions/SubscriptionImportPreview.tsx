"use client";

import { useMemo, useState, useTransition } from "react";
import {
  applySubscriptionsImport,
  type SubApplyResult,
  type SubDecision,
  type SubImportNameSuggestion,
  type SubImportPreview,
  type SubImportPreviewRow,
  type SubRowPayload,
} from "./importActions";
import type { SubRemovalCandidate } from "./importActions";
import { useGlobalPending } from "@/components/RouteProgress";

const MONTHS_SHORT = [
  "Січ", "Лют", "Бер", "Кві", "Тра", "Чер",
  "Лип", "Сер", "Вер", "Жов", "Лис", "Гру",
];

type DecisionMap = Record<
  number,
  | { action: "use_existing"; subscriberId: number }
  | { action: "create_new" }
  | { action: "skip" }
>;

// Рядок без адреси на доставку неможливо створити як нового передплатника —
// лише привʼязати до наявного або пропустити.
function rowHasAddressError(row: SubImportPreviewRow): boolean {
  return row.addressError != null;
}

function defaultDecision(row: SubImportPreviewRow): DecisionMap[number] {
  if (rowHasAddressError(row)) {
    // Немає адреси: за замовчуванням пропускаємо, але можна обрати наявного.
    if (row.subscriber.kind === "exact") {
      return { action: "use_existing", subscriberId: row.subscriber.id };
    }
    return { action: "skip" };
  }
  switch (row.subscriber.kind) {
    case "exact":
      return { action: "use_existing", subscriberId: row.subscriber.id };
    case "fuzzy":
      return { action: "use_existing", subscriberId: row.subscriber.candidates[0].id };
    case "none":
      return { action: "create_new" };
  }
}

export function SubscriptionImportPreview({
  preview,
  onBack,
  onClose,
}: {
  preview: SubImportPreview;
  onBack: () => void;
  onClose: () => void;
}) {
  const [decisions, setDecisions] = useState<DecisionMap>(() => {
    const init: DecisionMap = {};
    for (const r of preview.rows) init[r.rowNumber] = defaultDecision(r);
    return init;
  });
  // Рішення щодо зняття: за замовчуванням усі лишаємо (false = keep).
  const [toRemove, setToRemove] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<SubApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);

  const removeCount = useMemo(
    () => preview.removals.filter((r) => toRemove[r.subscriptionId]).length,
    [preview.removals, toRemove],
  );

  const counts = useMemo(() => {
    let exact = 0;
    let fuzzy = 0;
    let none = 0;
    let update = 0;
    for (const r of preview.rows) {
      if (r.subscriber.kind === "exact") exact++;
      else if (r.subscriber.kind === "fuzzy") fuzzy++;
      else none++;
      if (r.willUpdate) update++;
    }
    return { exact, fuzzy, none, update };
  }, [preview.rows]);

  const setDecision = (rowNumber: number, value: DecisionMap[number]) => {
    setDecisions((prev) => ({ ...prev, [rowNumber]: value }));
  };

  const apply = () => {
    setError(null);
    setResult(null);
    const rowsPayload: SubRowPayload[] = preview.rows.map((r) => ({
      rowNumber: r.rowNumber,
      year: r.year,
      publicationCode: r.publicationCode,
      publicationName: r.publication.name,
      fullName: r.fullName,
      isOrganization: r.isOrganization,
      phone: r.phone,
      street: r.street,
      number: r.number,
      corpus: r.corpus,
      apartment: r.apartment,
      deliveryMode: r.deliveryMode,
      months: r.months,
    }));
    const decisionList: SubDecision[] = preview.rows.map((r) => {
      const d = decisions[r.rowNumber] ?? { action: "skip" as const };
      return { rowNumber: r.rowNumber, ...d };
    });

    const removalList = preview.removals.map((r) => ({
      subscriptionId: r.subscriptionId,
      action: (toRemove[r.subscriptionId] ? "remove" : "keep") as "remove" | "keep",
    }));

    startTransition(async () => {
      try {
        const res = await applySubscriptionsImport({
          rows: rowsPayload,
          decisions: decisionList,
          removals: removalList,
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
          Рік: <strong>{preview.year}</strong> · рядків:{" "}
          <strong>{preview.rows.length}</strong>
          <span className="text-xs text-fg-subtle">
            {" "}· формат: {preview.format === "raw" ? "сирий експорт Укрпошти" : "шаблон"}
          </span>
          {preview.mergedPeriods > 0 && (
            <span className="text-xs text-fg-subtle">
              {" "}· зведено періодів: {preview.mergedPeriods}
            </span>
          )}
        </div>
        <div className="text-xs text-fg-muted mt-1">
          Точно: <strong className="text-success">{counts.exact}</strong> ·{" "}
          Схоже: <strong className="text-warning">{counts.fuzzy}</strong> ·{" "}
          Нові: <strong>{counts.none}</strong>
          {counts.update > 0 && (
            <>
              {" "}· Оновляться:{" "}
              <strong className="text-warning">{counts.update}</strong>
            </>
          )}
          {preview.skippedEmpty > 0 && (
            <>
              {" "}· Порожніх пропущено:{" "}
              <strong>{preview.skippedEmpty}</strong>
            </>
          )}
        </div>
        {preview.newPublications.length > 0 && (
          <div className="text-xs text-fg-muted mt-1">
            Нові видання (створяться):{" "}
            {preview.newPublications
              .map((p) => `${p.code} — ${p.name}`)
              .join("; ")}
          </div>
        )}
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

      {preview.duplicateWarnings.length > 0 && (
        <details className="rounded border border-warning-border bg-warning-bg" open>
          <summary className="cursor-pointer px-3 py-2 text-sm text-warning">
            Можливі дублі / різне написання у файлі ({preview.duplicateWarnings.length})
          </summary>
          <div className="px-3 pb-3 text-xs text-warning space-y-2 max-h-60 overflow-y-auto">
            <p className="text-fg-muted">
              Схожі, але не тотожні ПІБ на одній адресі × виданні. Нічого не
              зливається автоматично — перевірте вручну. Якщо це одна людина,
              приберіть зайвий рядок у файлі або оберіть «Пропустити» нижче.
            </p>
            {preview.duplicateWarnings.map((w, i) => (
              <div key={i} className="rounded border border-warning-border/60 px-2 py-1">
                <div className="text-fg-muted">
                  {w.publicationName} ({w.publicationCode}) · {w.addressLabel}
                </div>
                <ul className="mt-0.5 space-y-0.5">
                  {w.names.map((n) => (
                    <li key={n.rowNumber}>
                      Рядок {n.rowNumber}: <strong>{n.fullName}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      {preview.removals.length > 0 && (
        <RemovalsSection
          removals={preview.removals}
          toRemove={toRemove}
          setToRemove={setToRemove}
          removeCount={removeCount}
          disabled={isPending || !!result}
        />
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
            Створено передплат:{" "}
            <strong className="text-success">{result.subscriptionsCreated}</strong> ·{" "}
            Оновлено:{" "}
            <strong className="text-warning">{result.subscriptionsUpdated}</strong>
            {result.subscriptionsRemoved > 0 && (
              <>
                {" "}· Знято:{" "}
                <strong className="text-danger">{result.subscriptionsRemoved}</strong>
              </>
            )}
            {result.subscribersCreated.length > 0 && (
              <>
                {" "}· Нових передплатників:{" "}
                <strong className="text-success">
                  {result.subscribersCreated.length}
                </strong>
              </>
            )}
            {result.publicationsCreated.length > 0 && (
              <>
                {" "}· Нових видань:{" "}
                <strong className="text-success">
                  {result.publicationsCreated.length}
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
          {result.subscribersCreated.length > 0 && (
            <details open className="rounded border border-border bg-elevated">
              <summary className="cursor-pointer px-3 py-2 text-sm">
                Створені передплатники ({result.subscribersCreated.length})
              </summary>
              <ul className="px-3 pb-3 text-xs space-y-1 max-h-60 overflow-y-auto">
                {result.subscribersCreated.map((s) => (
                  <li key={s.id}>
                    <a href={`/subscriptions/subscribers/${s.id}`} className="link">
                      {s.fullName}
                    </a>
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
            <details open className="rounded border border-danger-border bg-danger-bg">
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
              disabled={isPending}
              className="btn-primary"
            >
              {isPending
                ? "Імпорт…"
                : removeCount > 0
                  ? `Імпортувати (зняти ${removeCount})`
                  : "Імпортувати"}
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
        <button type="button" onClick={onClose} className="ml-auto btn-secondary">
          Закрити
        </button>
      </div>
    </div>
  );
}

function RemovalsSection({
  removals,
  toRemove,
  setToRemove,
  removeCount,
  disabled,
}: {
  removals: SubRemovalCandidate[];
  toRemove: Record<number, boolean>;
  setToRemove: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  removeCount: number;
  disabled: boolean;
}) {
  const setAll = (value: boolean) => {
    setToRemove(() => {
      const next: Record<number, boolean> = {};
      for (const r of removals) next[r.subscriptionId] = value;
      return next;
    });
  };

  return (
    <details className="rounded border border-danger-border bg-danger-bg" open>
      <summary className="cursor-pointer px-3 py-2 text-sm text-danger">
        У базі є, але немає у файлі ({removals.length})
        {removeCount > 0 && (
          <span className="ml-1">— познач. на зняття: {removeCount}</span>
        )}
      </summary>
      <div className="px-3 pb-3 text-xs space-y-2 max-h-72 overflow-y-auto">
        <p className="text-fg-muted">
          Ці підписки за цей рік є в базі, але файл їх не підтвердив точним матчем
          ПІБ + адреси. За замовчуванням <strong>лишаємо</strong> — увага, тут
          можуть бути підписки, ПІБ яких у файлі написано інакше. Позначте лише
          ті, які точно треба зняти.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAll(true)}
            disabled={disabled}
            className="btn-secondary text-xs py-1"
          >
            Зняти всі
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            disabled={disabled}
            className="btn-secondary text-xs py-1"
          >
            Лишити всі
          </button>
        </div>
        <ul className="space-y-1">
          {removals.map((r) => (
            <li key={r.subscriptionId}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!toRemove[r.subscriptionId]}
                  disabled={disabled}
                  onChange={(e) =>
                    setToRemove((prev) => ({
                      ...prev,
                      [r.subscriptionId]: e.target.checked,
                    }))
                  }
                />
                <span
                  className={toRemove[r.subscriptionId] ? "line-through text-danger" : ""}
                >
                  <strong>{r.subscriberName}</strong> — {r.publicationName} (
                  {r.publicationCode})
                  <span className="text-fg-subtle">
                    {" "}
                    · {r.addressLabel} · {monthsLabel(r.months)} (всього{" "}
                    {r.monthsTotal})
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function monthsLabel(months: number[]): string {
  const parts = months
    .map((v, i) => (v > 0 ? `${MONTHS_SHORT[i]}${v > 1 ? `×${v}` : ""}` : null))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function PreviewRowCard({
  row,
  decision,
  onChange,
  disabled,
}: {
  row: SubImportPreviewRow;
  decision: DecisionMap[number] | null;
  onChange: (d: DecisionMap[number]) => void;
  disabled: boolean;
}) {
  const status = row.subscriber;
  const addrError = rowHasAddressError(row);

  const statusBadge = (() => {
    if (addrError) return <span className="text-danger text-xs">● Немає адреси</span>;
    switch (status.kind) {
      case "exact":
        return <span className="text-success text-xs">● Точний матч</span>;
      case "fuzzy":
        return <span className="text-warning text-xs">● Схоже на наявного</span>;
      case "none":
        return <span className="text-xs">● Новий передплатник</span>;
    }
  })();

  const containerClass = (() => {
    if (addrError) return "border-danger-border bg-danger-bg";
    if (status.kind === "exact") return "border-success-border bg-success-bg";
    if (status.kind === "fuzzy") return "border-warning-border bg-warning-bg";
    return "border-border bg-elevated";
  })();

  return (
    <li className={`rounded border ${containerClass} px-3 py-2 text-sm space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            Рядок {row.rowNumber}: {row.fullName}
            {row.isOrganization && (
              <span className="text-fg-subtle text-xs"> (організація)</span>
            )}
          </div>
          <div className="text-xs text-fg-muted">
            {row.addressLabel}
            {row.phone ? ` · ${row.phone}` : ""}
          </div>
          <div className="text-xs text-fg-muted mt-0.5">
            {row.publication.kind === "existing" ? (
              <>
                {row.publication.name} ({row.publication.code})
              </>
            ) : (
              <span className="text-warning">
                Нове видання: {row.publication.name} ({row.publication.code})
              </span>
            )}{" "}
            · {row.year} · {monthsLabel(row.months)}{" "}
            <span className="text-fg-subtle">(всього {row.monthsTotal})</span>
          </div>
          {row.willUpdate && (
            <div className="text-xs text-warning mt-0.5">
              ⚠ Передплата на цей рік уже існує — кількості оновляться
            </div>
          )}
        </div>
        <div className="shrink-0">{statusBadge}</div>
      </div>

      {addrError && (
        <div className="text-danger text-xs">{row.addressError}</div>
      )}

      {!addrError && status.kind === "exact" ? (
        <div className="text-xs text-fg-muted">
          → передплата буде прив&apos;язана до <strong>{status.fullName}</strong>
        </div>
      ) : (
        <DecisionControls
          row={row}
          decision={decision}
          onChange={onChange}
          disabled={disabled}
          allowCreateNew={!addrError}
        />
      )}
    </li>
  );
}

function DecisionControls({
  row,
  decision,
  onChange,
  disabled,
  allowCreateNew,
}: {
  row: SubImportPreviewRow;
  decision: DecisionMap[number] | null;
  onChange: (d: DecisionMap[number]) => void;
  disabled: boolean;
  allowCreateNew: boolean;
}) {
  const rowKey = `sub-r${row.rowNumber}`;
  const status = row.subscriber;
  const isUseExisting = (id: number) =>
    decision?.action === "use_existing" && decision.subscriberId === id;
  const isCreateNew = decision?.action === "create_new";
  const isSkip = decision?.action === "skip";

  const fuzzyCandidates = status.kind === "fuzzy" ? status.candidates : [];
  const fuzzyIds = new Set(fuzzyCandidates.map((c) => c.id));
  const extraSuggestions = row.nameSuggestions.filter((s) => !fuzzyIds.has(s.id));

  return (
    <div className="space-y-1 pl-1">
      {fuzzyCandidates.map((c) => (
        <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="radio"
            name={`${rowKey}-action`}
            checked={isUseExisting(c.id)}
            disabled={disabled}
            onChange={() => onChange({ action: "use_existing", subscriberId: c.id })}
          />
          <span>
            Прийняти наявного: <strong>{c.fullName}</strong>
            {c.distance > 0 && (
              <span className="text-fg-subtle"> (відстань {c.distance})</span>
            )}
          </span>
        </label>
      ))}

      {allowCreateNew && (
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="radio"
            name={`${rowKey}-action`}
            checked={isCreateNew}
            disabled={disabled}
            onChange={() => onChange({ action: "create_new" })}
          />
          <span>
            Створити нового: <strong>«{row.fullName}»</strong>
          </span>
        </label>
      )}

      {extraSuggestions.length > 0 && (
        <NameSuggestionRadios
          rowKey={rowKey}
          suggestions={extraSuggestions}
          isUseExisting={isUseExisting}
          onChange={onChange}
          disabled={disabled}
          label="Або обрати наявного за ПІБ"
        />
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

function NameSuggestionRadios({
  rowKey,
  suggestions,
  isUseExisting,
  onChange,
  disabled,
  label,
}: {
  rowKey: string;
  suggestions: SubImportNameSuggestion[];
  isUseExisting: (id: number) => boolean;
  onChange: (d: DecisionMap[number]) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-fg-muted">{label}:</div>
      {suggestions.map((s) => (
        <label
          key={s.id}
          className="flex items-center gap-2 text-xs cursor-pointer pl-3"
        >
          <input
            type="radio"
            name={`${rowKey}-action`}
            checked={isUseExisting(s.id)}
            disabled={disabled}
            onChange={() => onChange({ action: "use_existing", subscriberId: s.id })}
          />
          <span>
            <strong>{s.fullName}</strong>
            {s.address && <span className="text-fg-subtle"> — {s.address}</span>}
            {s.distance > 0 && (
              <span className="text-fg-subtle"> (відстань {s.distance})</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
