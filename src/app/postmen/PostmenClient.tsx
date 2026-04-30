"use client";

import { useTransition } from "react";
import { createPostman, deletePostman } from "./actions";
import { useToast } from "@/components/Toast";

type Postman = { id: number; name: string; roundsCount: number };

export function PostmenClient({ postmen }: { postmen: Postman[] }) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const res = await createPostman(formData);
      if (res?.error) {
        showToast(res.error, "error");
      } else {
        (document.getElementById("create-postman-form") as HTMLFormElement)?.reset();
        showToast("Поштаря додано", "success");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Видалити поштаря?")) return;
    startTransition(async () => {
      const res = await deletePostman(id);
      if (res?.error) showToast(res.error, "error");
      else showToast("Поштаря видалено", "success");
    });
  };

  return (
    <div className="space-y-4">
      <form
        id="create-postman-form"
        action={handleCreate}
        className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">ПІБ поштаря</label>
          <input
            name="name"
            required
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Іваненко І. І."
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
              <th className="text-left px-3 py-2">ПІБ</th>
              <th className="text-left px-3 py-2">Обходів</th>
              <th className="text-right px-3 py-2">Дії</th>
            </tr>
          </thead>
          <tbody>
            {postmen.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                  Ще немає поштарів
                </td>
              </tr>
            )}
            {postmen.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.roundsCount}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-600 hover:underline"
                  >
                    Видалити
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
