"use client";

import { useState, useTransition } from "react";
import { createPayment, deletePayment, updatePayment } from "./actions";
import { useToast } from "@/components/Toast";

type Payment = { id: number; name: string; code: string };

export function PaymentsClient({ payments }: { payments: Payment[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const res = await createPayment(formData);
      if (res?.error) {
        showToast(res.error, "error");
      } else {
        (document.getElementById("create-payment-form") as HTMLFormElement)?.reset();
        showToast("Тип виплати додано", "success");
      }
    });
  };

  const handleUpdate = (id: number, formData: FormData) => {
    startTransition(async () => {
      const res = await updatePayment(id, formData);
      if (res?.error) {
        showToast(res.error, "error");
      } else {
        setEditingId(null);
        showToast("Збережено", "success");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Видалити цей тип виплати?")) return;
    startTransition(async () => {
      const res = await deletePayment(id);
      if (res?.error) showToast(res.error, "error");
      else showToast("Тип виплати видалено", "success");
    });
  };

  return (
    <div className="space-y-4">
      <form
        id="create-payment-form"
        action={handleCreate}
        className="card p-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex flex-col">
          <label className="text-xs text-fg-muted">Назва</label>
          <input
            name="name"
            required
            className="rounded border border-border bg-surface text-fg px-2 py-1 text-sm"
            placeholder="Пенсія"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-fg-muted">Код</label>
          <input
            name="code"
            required
            className="rounded border border-border bg-surface text-fg px-2 py-1 text-sm"
            placeholder="PENSION"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary"
        >
          Додати
        </button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-fg-muted">
            <tr>
              <th className="text-left px-3 py-2">Назва</th>
              <th className="text-left px-3 py-2">Код</th>
              <th className="text-right px-3 py-2">Дії</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-fg-subtle">
                  Ще немає типів виплат
                </td>
              </tr>
            )}
            {payments.map((p) =>
              editingId === p.id ? (
                <tr key={p.id} className="border-t border-border bg-elevated">
                  <td colSpan={3} className="px-3 py-2">
                    <form
                      action={(fd) => handleUpdate(p.id, fd)}
                      className="flex flex-wrap gap-2 items-end"
                    >
                      <input
                        name="name"
                        defaultValue={p.name}
                        required
                        className="rounded border border-border bg-surface text-fg px-2 py-1 text-sm"
                      />
                      <input
                        name="code"
                        defaultValue={p.code}
                        required
                        className="rounded border border-border bg-surface text-fg px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={isPending}
                        className="btn-primary !px-3 !py-1"
                      >
                        Зберегти
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="btn-secondary !px-3 !py-1"
                      >
                        Скасувати
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => setEditingId(p.id)}
                      className="text-link hover:text-link-hover hover:underline"
                    >
                      Редагувати
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-danger hover:underline"
                    >
                      Видалити
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
