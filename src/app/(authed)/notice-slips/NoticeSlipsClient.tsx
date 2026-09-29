"use client";

import { useState } from "react";
import type { NoticeSlipPrintData } from "@/lib/noticeSlipShared";
import type { NoticeSlipDefaults } from "./actions";
import { NoticeSlipDefaultsEditor } from "./NoticeSlipDefaultsEditor";
import { NoticeSlipForm } from "./NoticeSlipForm";
import { ImportNoticeSlips } from "./ImportNoticeSlips";
import { NoticeSlipPrintCard } from "./NoticeSlipPrintCard";

export function NoticeSlipsClient({
  initialDefaults,
  canManageDefaults,
}: {
  initialDefaults: NoticeSlipDefaults;
  canManageDefaults: boolean;
}) {
  const [defaults, setDefaults] = useState(initialDefaults);
  const [manualSlip, setManualSlip] = useState<NoticeSlipPrintData | null>(null);
  const [batchRows, setBatchRows] = useState<NoticeSlipPrintData[]>([]);

  const printItems = [...(manualSlip ? [manualSlip] : []), ...batchRows];

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        {canManageDefaults && (
          <NoticeSlipDefaultsEditor defaults={defaults} onSaved={setDefaults} />
        )}
        <ImportNoticeSlips defaults={defaults} onRowsChange={setBatchRows} />
      </div>

      <div className="no-print">
        <NoticeSlipForm defaults={defaults} onChange={setManualSlip} />
      </div>

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
            printItems.map(({ key, ...item }) => <NoticeSlipPrintCard key={key} {...item} />)
          )}
        </div>
      </div>
    </div>
  );
}
