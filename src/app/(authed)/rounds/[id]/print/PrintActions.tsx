"use client";

import { useParams } from "next/navigation";
import { BackLink } from "@/components/BackLink";

export function PrintActions({ roundDate }: { roundDate: string }) {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  return (
    <div className="no-print mb-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        {id && (
          <BackLink fallbackHref={`/rounds/${id}`} fallbackLabel="До обходу" />
        )}
        <span className="text-sm text-slate-600">
          Бігунки · обхід {roundDate}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
        >
          Друкувати / Зберегти PDF
        </button>
      </div>
    </div>
  );
}
