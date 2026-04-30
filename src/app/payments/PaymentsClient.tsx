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
        className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Назва</label>
          <input
            name="name"
            required
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Пенсія"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Код</label>
          <input
            name="code"
            required
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="PENSION"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-60"
        >
          Додати
        </button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Назва</th>
              <th className="text-left px-3 py-2">Код</th>
              <th className="text-right px-3 py-2">Дії</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                  Ще немає типів виплат
                </td>
              </tr>
            )}
            {payments.map((p) =>
              editingId === p.id ? (
                <tr key={p.id} className="border-t border-slate-100 bg-blue-50/50">
                  <td colSpan={3} className="px-3 py-2">
                    <form
                      action={(fd) => handleUpdate(p.id, fd)}
                      className="flex flex-wrap gap-2 items-end"
                    >
                      <input
                        name="name"
                        defaultValue={p.name}
                        required
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <input
                        name="code"
                        defaultValue={p.code}
                        required
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded bg-blue-600 text-white px-3 py-1 text-sm"
                      >
                        Зберегти
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded border border-slate-300 px-3 py-1 text-sm"
                      >
                        Скасувати
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => setEditingId(p.id)}
                      className="text-blue-600 hover:underline"
                    >
                      Редагувати
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-600 hover:underline"
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
