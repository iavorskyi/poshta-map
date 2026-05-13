"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createPayment,
  deletePayment,
  updatePayment,
} from "@/app/(authed)/payments/actions";
import { useToast } from "@/components/Toast";
import { useGlobalPending } from "@/components/RouteProgress";
import { Spinner } from "@/components/Spinner";

export type PaymentType = { id: number; name: string; code: string };

function sortPayments(list: PaymentType[]): PaymentType[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

export function PaymentTypeManager({
  open,
  initialMode = "list",
  payments,
  onChange,
  onCreated,
  onClose,
}: {
  open: boolean;
  initialMode?: "list" | "create";
  payments: PaymentType[];
  onChange: (list: PaymentType[]) => void;
  onCreated?: (p: PaymentType) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"list" | "create">(initialMode);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setName("");
    setCode("");
    setEditingId(null);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submitCreate = () => {
    if (!name.trim() || !code.trim()) {
      showToast("Назва і код обов'язкові", "error");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("code", code.trim());
      const res = await createPayment(fd);
      if ("error" in res) {
        showToast(res.error, "error");
        return;
      }
      onChange(sortPayments([...payments, res.payment]));
      onCreated?.(res.payment);
      setName("");
      setCode("");
      showToast("Тип додано", "success");
      setMode("list");
    });
  };

  const startEdit = (p: PaymentType) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditCode(p.code);
  };

  const submitEdit = (id: number) => {
    if (!editName.trim() || !editCode.trim()) {
      showToast("Назва і код обов'язкові", "error");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", editName.trim());
      fd.set("code", editCode.trim());
      const res = await updatePayment(id, fd);
      if ("error" in res) {
        showToast(res.error, "error");
        return;
      }
      onChange(
        sortPayments(payments.map((p) => (p.id === id ? res.payment : p)))
      );
      setEditingId(null);
      showToast("Збережено", "success");
    });
  };

  const submitDelete = (id: number) => {
    if (!confirm("Видалити цей тип виплати?")) return;
    startTransition(async () => {
      const res = await deletePayment(id);
      if ("error" in res) {
        showToast(res.error, "error");
        return;
      }
      onChange(payments.filter((p) => p.id !== id));
      showToast("Тип виплати видалено", "success");
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-xl p-4 md:p-5 space-y-4 mt-8 mb-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-lg">Типи виплат</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-subtle hover:text-fg text-sm px-2 py-1"
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        {mode === "create" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-fg-muted">Назва</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Пенсія"
                  className="input"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-fg-muted">Код</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="PENSION"
                  className="input"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submitCreate}
                disabled={isPending}
                aria-busy={isPending}
                className="btn-primary"
              >
                {isPending && <Spinner />}
                Створити
              </button>
              <button
                type="button"
                onClick={() => setMode("list")}
                className="btn-secondary"
              >
                До списку
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border overflow-hidden">
              {payments.length === 0 ? (
                <div className="px-3 py-6 text-center text-fg-subtle text-sm">
                  Ще немає типів виплат
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {payments.map((p) =>
                    editingId === p.id ? (
                      <li key={p.id} className="px-3 py-2 bg-elevated">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="input"
                            placeholder="Назва"
                          />
                          <input
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            className="input"
                            placeholder="Код"
                          />
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => submitEdit(p.id)}
                            disabled={isPending}
                            aria-busy={isPending}
                            className="btn-primary !px-3 !py-1.5"
                          >
                            {isPending && <Spinner />}
                            Зберегти
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="btn-secondary !px-3 !py-1.5"
                          >
                            Скасувати
                          </button>
                        </div>
                      </li>
                    ) : (
                      <li
                        key={p.id}
                        className="px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm truncate">{p.name}</div>
                          <div className="text-xs font-mono text-fg-subtle truncate">
                            {p.code}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="text-sm text-link hover:text-link-hover hover:underline"
                          >
                            Редагувати
                          </button>
                          <button
                            type="button"
                            onClick={() => submitDelete(p.id)}
                            className="text-sm text-danger hover:underline"
                          >
                            Видалити
                          </button>
                        </div>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMode("create")}
              className="w-full rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm text-fg-muted hover:border-brand hover:text-fg transition-colors"
            >
              + Створити новий тип
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
