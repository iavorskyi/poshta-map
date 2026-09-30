"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import type { NoticeSlipPrintData } from "@/lib/noticeSlipShared";
import type { NoticeSlipDefaults } from "./actions";
import { NoticeSlipDefaultsEditor } from "./NoticeSlipDefaultsEditor";
import { NoticeSlipForm } from "./NoticeSlipForm";
import { ImportNoticeSlips } from "./ImportNoticeSlips";
import { NoticeSlipPrintCard } from "./NoticeSlipPrintCard";

const MAX_SLIPS = 100;

export function NoticeSlipsClient({
  initialDefaults,
  canManageDefaults,
}: {
  initialDefaults: NoticeSlipDefaults;
  canManageDefaults: boolean;
}) {
  const [defaults, setDefaults] = useState(initialDefaults);
  const [manualSlips, setManualSlips] = useState<NoticeSlipPrintData[]>([]);
  const [batchRows, setBatchRows] = useState<NoticeSlipPrintData[]>([]);
  const manualKeyRef = useRef(0);
  const { showToast } = useToast();

  const printItems = [...manualSlips, ...batchRows];
  const totalCount = printItems.length;

  const handleAddManual = (slip: Omit<NoticeSlipPrintData, "key">) => {
    if (totalCount >= MAX_SLIPS) {
      showToast(`Досягнуто ліміту ${MAX_SLIPS} бланків для одного друку`, "error");
      return;
    }
    manualKeyRef.current += 1;
    setManualSlips((prev) => [...prev, { ...slip, key: `manual-${manualKeyRef.current}` }]);
  };

  const handleRemoveManual = (key: string) => {
    setManualSlips((prev) => prev.filter((s) => s.key !== key));
  };

  const handleBatchRowsChange = (rows: NoticeSlipPrintData[]) => {
    const capacity = Math.max(0, MAX_SLIPS - manualSlips.length);
    if (rows.length > capacity) {
      showToast(
        `Імпортовано більше ${MAX_SLIPS} бланків для одного друку — залишено перші ${capacity}`,
        "error"
      );
      setBatchRows(rows.slice(0, capacity));
      return;
    }
    setBatchRows(rows);
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        {canManageDefaults && (
          <NoticeSlipDefaultsEditor defaults={defaults} onSaved={setDefaults} />
        )}
        <ImportNoticeSlips defaults={defaults} onRowsChange={handleBatchRowsChange} />
      </div>

      <div className="no-print">
        <NoticeSlipForm
          defaults={defaults}
          onAdd={handleAddManual}
          disabledReason={
            totalCount >= MAX_SLIPS ? `Досягнуто ліміту ${MAX_SLIPS} бланків для одного друку` : null
          }
        />
      </div>

      {manualSlips.length > 0 && (
        <div className="no-print card p-3 md:p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              Додано вручну: {manualSlips.length}
            </div>
            <button
              type="button"
              onClick={() => setManualSlips([])}
              className="text-danger text-sm hover:underline"
            >
              Очистити список
            </button>
          </div>
          <ul className="text-sm divide-y divide-border">
            {manualSlips.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate">
                  {s.name} <span className="text-fg-subtle">— {s.address}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveManual(s.key)}
                  className="text-fg-subtle hover:text-danger px-1 shrink-0"
                  aria-label="Прибрати"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="no-print">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={printItems.length === 0}
          className="btn-primary disabled:opacity-50"
        >
          Друкувати / Зберегти PDF{printItems.length > 1 ? ` (${printItems.length})` : ""}
        </button>
      </div>

      <div className="print-area">
        <div className="notice-slip-grid">
          {printItems.length === 0 ? (
            <div className="text-sm text-fg-muted p-4">
              Заповніть бланк вище або імпортуйте список — тут з&apos;явиться прев&apos;ю
              для друку.
            </div>
          ) : (
            printItems.map(({ key, ...item }) => (
              <div className="notice-slip-cell" key={key}>
                <NoticeSlipPrintCard {...item} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
