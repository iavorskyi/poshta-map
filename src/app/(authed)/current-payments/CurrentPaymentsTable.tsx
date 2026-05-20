"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { deleteCurrentPayment, updateCurrentPaymentFields } from "./actions";
import { formatDate, formatUAH } from "@/lib/format";
import { useGlobalPending } from "@/components/RouteProgress";

export type SortKey =
  | "date"
  | "pensioner"
  | "payment"
  | "amount"
  | "postman"
  | "paid";

type Item = {
  id: number;
  date: string;
  pensionerId: number;
  pensionerName: string;
  paymentName: string;
  paymentCode: string;
  amount: number;
  isPaid: boolean;
  roundId: number | null;
  postmanName?: string | null;
  canEdit: boolean;
};

export function CurrentPaymentsTable({
  items,
  sort = "date",
  dir = "asc",
}: {
  items: Item[];
  sort?: SortKey;
  dir?: "asc" | "desc";
}) {
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const pathname = usePathname();
  const sp = useSearchParams();

  if (items.length === 0) return null;

  const togglePaid = (id: number, next: boolean) => {
    startTransition(async () => {
      await updateCurrentPaymentFields(id, { isPaid: next });
    });
  };

  const changeAmount = (id: number, amount: number) => {
    startTransition(async () => {
      await updateCurrentPaymentFields(id, { amount });
    });
  };

  const removeItem = (id: number) => {
    if (!confirm("Видалити цю виплату?")) return;
    startTransition(async () => {
      await deleteCurrentPayment(id);
    });
  };

  return (
    <>
      {/* Mobile: card list */}
      <ul className="md:hidden space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className={`rounded-lg border bg-surface p-3 ${
              it.isPaid ? "border-success-border" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/pensioners/${it.pensionerId}`}
                  className="font-medium text-link hover:text-link-hover hover:underline block truncate"
                >
                  {it.pensionerName}
                </Link>
                <div className="text-sm text-fg-muted mt-0.5">
                  {it.paymentName}{" "}
                  <span className="font-mono text-xs text-fg-subtle">({it.paymentCode})</span>
                </div>
                <div className="text-xs text-fg-subtle mt-0.5">
                  {formatDate(it.date)}
                  {it.postmanName && <> · {it.postmanName}</>}
                  {it.roundId && (
                    <>
                      {" · "}
                      <Link
                        href={`/rounds/${it.roundId}`}
                        className="link"
                      >
                        обхід #{it.roundId}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{formatUAH(it.amount)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm flex-1">
                <input
                  type="checkbox"
                  checked={it.isPaid}
                  disabled={isPending || !it.canEdit}
                  onChange={(e) => togglePaid(it.id, e.target.checked)}
                  className="h-5 w-5 accent-brand disabled:opacity-50"
                />
                <span className={it.isPaid ? "text-success font-medium" : "text-fg-muted"}>
                  {it.isPaid ? "Виплачено" : "Відмітити виплаченою"}
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                defaultValue={it.amount}
                disabled={isPending || !it.canEdit}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v) && v !== it.amount) changeAmount(it.id, v);
                }}
                className="input !w-28 text-right disabled:bg-elevated"
                aria-label="Сума"
              />
              {it.canEdit && (
                <button
                  onClick={() => removeItem(it.id)}
                  className="text-danger text-sm px-2 py-1"
                  aria-label="Видалити"
                >
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-fg-muted">
            <tr>
              <SortHeader
                label="Дата"
                sortKey="date"
                sort={sort}
                dir={dir}
                pathname={pathname}
                sp={sp}
              />
              <SortHeader
                label="Пенсіонер"
                sortKey="pensioner"
                sort={sort}
                dir={dir}
                pathname={pathname}
                sp={sp}
              />
              <SortHeader
                label="Тип"
                sortKey="payment"
                sort={sort}
                dir={dir}
                pathname={pathname}
                sp={sp}
              />
              <SortHeader
                label="Сума"
                sortKey="amount"
                sort={sort}
                dir={dir}
                pathname={pathname}
                sp={sp}
                align="right"
              />
              <SortHeader
                label="Виплачено"
                sortKey="paid"
                sort={sort}
                dir={dir}
                pathname={pathname}
                sp={sp}
                align="center"
                className="w-28"
              />
              <SortHeader
                label="Листоноша"
                sortKey="postman"
                sort={sort}
                dir={dir}
                pathname={pathname}
                sp={sp}
              />
              <th className="text-left px-3 py-2">Обхід</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-3 py-2">{formatDate(it.date)}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/pensioners/${it.pensionerId}`}
                    className="text-link hover:text-link-hover hover:underline"
                  >
                    {it.pensionerName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {it.paymentName}{" "}
                  <span className="font-mono text-xs text-fg-subtle">({it.paymentCode})</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={it.amount}
                    disabled={isPending || !it.canEdit}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v !== it.amount) changeAmount(it.id, v);
                    }}
                    className="input w-28 text-right disabled:bg-elevated"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={it.isPaid}
                    disabled={isPending || !it.canEdit}
                    onChange={(e) => togglePaid(it.id, e.target.checked)}
                    className="h-4 w-4 accent-brand disabled:opacity-50"
                  />
                </td>
                <td className="px-3 py-2">
                  {it.postmanName ?? <span className="text-fg-subtle">—</span>}
                </td>
                <td className="px-3 py-2">
                  {it.roundId ? (
                    <Link href={`/rounds/${it.roundId}`} className="link">
                      #{it.roundId}
                    </Link>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {it.canEdit && (
                    <button
                      onClick={() => removeItem(it.id)}
                      className="text-danger hover:underline text-sm"
                    >
                      Видалити
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  dir,
  pathname,
  sp,
  align = "left",
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  pathname: string;
  sp: ReturnType<typeof useSearchParams>;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const active = sort === sortKey;
  const nextDir: "asc" | "desc" = active && dir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams(sp.toString());
  params.set("sort", sortKey);
  params.set("dir", nextDir);
  const arrow = active ? (dir === "asc" ? "↑" : "↓") : "";
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const inlineJustify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "";
  return (
    <th className={`${alignClass} px-3 py-2 ${className}`}>
      <Link
        href={`${pathname}?${params.toString()}`}
        className={`inline-flex items-center gap-1 hover:text-fg ${inlineJustify} ${active ? "text-fg" : ""}`}
      >
        {label}
        {arrow && <span className="text-xs">{arrow}</span>}
      </Link>
    </th>
  );
}
