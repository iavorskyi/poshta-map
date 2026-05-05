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
        className="card p-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex flex-col">
          <label className="text-xs text-fg-muted">ПІБ поштаря</label>
          <input
            name="name"
            required
            className="rounded border border-border bg-surface text-fg px-2 py-1 text-sm"
            placeholder="Іваненко І. І."
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
              <th className="text-left px-3 py-2">ПІБ</th>
              <th className="text-left px-3 py-2">Обходів</th>
              <th className="text-right px-3 py-2">Дії</th>
            </tr>
          </thead>
          <tbody>
            {postmen.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-fg-subtle">
                  Ще немає поштарів
                </td>
              </tr>
            )}
            {postmen.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.roundsCount}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-danger hover:underline"
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
