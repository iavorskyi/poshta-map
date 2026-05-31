"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useGlobalPending } from "@/components/RouteProgress";
import { useToast } from "@/components/Toast";
import {
  addSubscriptionRow,
  deleteSubscription,
  upsertSubscription,
} from "../actions";

const MONTH_LABELS = [
  "Січ",
  "Лют",
  "Бер",
  "Кві",
  "Тра",
  "Чер",
  "Лип",
  "Сер",
  "Вер",
  "Жов",
  "Лис",
  "Гру",
];

type Subscription = {
  id: number;
  publicationId: number;
  publicationCode: string;
  publicationName: string;
  activeMonths: boolean[];
  notes: string | null;
};

type Publication = {
  id: number;
  code: string;
  name: string;
  issuesPerMonth: number | null;
};

export function SubscriberDetailClient({
  subscriberId,
  year,
  canManage,
  subscriptions,
  availablePublications,
}: {
  subscriberId: number;
  year: number;
  canManage: boolean;
  subscriptions: Subscription[];
  availablePublications: Publication[];
}) {
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const { showToast } = useToast();
  const [publicationId, setPublicationId] = useState<number | "">("");
  const [optimistic, setOptimistic] = useOptimistic<
    Subscription[],
    { type: "toggle"; subId: number; monthIndex: number; value: boolean }
    | { type: "delete"; subId: number }
  >(subscriptions, (state, action) => {
    if (action.type === "toggle") {
      return state.map((s) =>
        s.id === action.subId
          ? {
              ...s,
              activeMonths: s.activeMonths.map((m, i) =>
                i === action.monthIndex ? action.value : m,
              ),
            }
          : s,
      );
    }
    return state.filter((s) => s.id !== action.subId);
  });

  const toggle = (sub: Subscription, monthIndex: number, value: boolean) => {
    startTransition(async () => {
      setOptimistic({ type: "toggle", subId: sub.id, monthIndex, value });
      const res = await upsertSubscription({
        subscriberId,
        publicationId: sub.publicationId,
        year,
        monthIndex,
        active: value,
      });
      if ("error" in res) showToast(res.error, "error");
    });
  };

  const removeSubscription = (sub: Subscription) => {
    if (!confirm(`Видалити підписку на «${sub.publicationName}» у ${year}?`))
      return;
    startTransition(async () => {
      setOptimistic({ type: "delete", subId: sub.id });
      const res = await deleteSubscription(sub.id);
      if ("error" in res) showToast(res.error, "error");
      else showToast("Підписку видалено", "success");
    });
  };

  const addRow = () => {
    if (publicationId === "") return;
    startTransition(async () => {
      const res = await addSubscriptionRow({
        subscriberId,
        publicationId: Number(publicationId),
        year,
      });
      if ("error" in res) showToast(res.error, "error");
      else {
        setPublicationId("");
        showToast("Видання додано", "success");
      }
    });
  };

  if (subscriptions.length === 0 && !canManage) {
    return null;
  }

  return (
    <div className="space-y-3">
      {optimistic.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-fg-muted">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-elevated z-10">
                  Видання
                </th>
                {MONTH_LABELS.map((m, i) => (
                  <th key={i} className="px-2 py-2 text-center w-10">
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">∑</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {optimistic.map((sub) => {
                const total = sub.activeMonths.filter(Boolean).length;
                return (
                  <tr key={sub.id} className="border-t border-border">
                    <td className="px-3 py-2 sticky left-0 bg-surface z-10">
                      <Link
                        href={`/subscriptions/publications/${sub.publicationId}?year=${year}`}
                        className="text-link hover:text-link-hover hover:underline"
                      >
                        {sub.publicationName}
                      </Link>
                      <div className="font-mono text-xs text-fg-subtle">
                        {sub.publicationCode}
                      </div>
                    </td>
                    {sub.activeMonths.map((active, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={active}
                          disabled={!canManage}
                          onChange={(e) => toggle(sub, i, e.target.checked)}
                          className="h-4 w-4 accent-brand"
                          aria-label={`${sub.publicationName} ${MONTH_LABELS[i]}`}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-medium">{total}</td>
                    <td className="px-3 py-2 text-right">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => removeSubscription(sub)}
                          className="text-danger hover:underline text-xs"
                        >
                          Видалити
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage && availablePublications.length > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-fg-muted">Додати видання:</span>
          <select
            value={publicationId}
            onChange={(e) =>
              setPublicationId(e.target.value ? Number(e.target.value) : "")
            }
            className="input flex-1 min-w-[200px]"
          >
            <option value="">— оберіть видання —</option>
            {availablePublications.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addRow}
            disabled={publicationId === "" || isPending}
            className="btn-primary"
          >
            Додати
          </button>
        </div>
      )}
    </div>
  );
}
