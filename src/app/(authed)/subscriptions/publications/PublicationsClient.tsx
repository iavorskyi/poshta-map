"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useGlobalPending } from "@/components/RouteProgress";
import { useToast } from "@/components/Toast";
import {
  createPublication,
  deletePublication,
  updatePublication,
} from "./actions";

type Publication = {
  id: number;
  code: string;
  name: string;
  issuesPerMonth: number | null;
  notes: string | null;
  activeCount: number;
};

export function PublicationsClient({
  publications,
  q,
  year,
  canManage,
}: {
  publications: Publication[];
  q: string;
  year: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const { showToast } = useToast();
  const [editId, setEditId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const setQuery = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/subscriptions/publications?${next.toString()}`);
  };

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const res = await createPublication(formData);
      if ("error" in res) {
        showToast(res.error, "error");
      } else {
        showToast("Видання додано", "success");
        setShowCreate(false);
        (
          document.getElementById("create-publication-form") as HTMLFormElement | null
        )?.reset();
      }
    });
  };

  const handleUpdate = (id: number, formData: FormData) => {
    startTransition(async () => {
      const res = await updatePublication(id, formData);
      if ("error" in res) showToast(res.error, "error");
      else {
        showToast("Збережено", "success");
        setEditId(null);
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Видалити видання «${name}»?`)) return;
    startTransition(async () => {
      const res = await deletePublication(id);
      if ("error" in res) showToast(res.error, "error");
      else showToast("Видалено", "success");
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          defaultValue={q}
          placeholder="Пошук по назві або коду…"
          onChange={(e) => setQuery("q", e.target.value)}
          className="input flex-1 min-w-[200px]"
        />
        <label className="flex items-center gap-1 text-sm">
          <span className="text-fg-muted">Рік:</span>
          <input
            type="number"
            min={2000}
            max={2100}
            defaultValue={year}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setQuery("year", String(v));
            }}
            className="input w-24"
          />
        </label>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="btn-primary"
          >
            {showCreate ? "Скасувати" : "+ Видання"}
          </button>
        )}
      </div>

      {canManage && showCreate && (
        <form
          id="create-publication-form"
          action={handleCreate}
          className="card p-4 grid gap-3 sm:grid-cols-4"
        >
          <div className="flex flex-col">
            <label className="text-xs text-fg-muted">Код *</label>
            <input name="code" required className="input" placeholder="UA-12345" />
          </div>
          <div className="flex flex-col sm:col-span-2">
            <label className="text-xs text-fg-muted">Назва *</label>
            <input name="name" required className="input" placeholder="Сільські вісті" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-fg-muted">Випусків/міс</label>
            <input
              type="number"
              min={0}
              name="issuesPerMonth"
              className="input"
              placeholder="4"
            />
          </div>
          <div className="flex flex-col sm:col-span-4">
            <label className="text-xs text-fg-muted">Нотатки</label>
            <input name="notes" className="input" placeholder="—" />
          </div>
          <div className="sm:col-span-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="btn-secondary"
            >
              Скасувати
            </button>
            <button type="submit" disabled={isPending} className="btn-primary">
              Додати
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-fg-muted">
            <tr>
              <th className="text-left px-3 py-2">Код</th>
              <th className="text-left px-3 py-2">Назва</th>
              <th className="text-right px-3 py-2">Вип/міс</th>
              <th className="text-right px-3 py-2">Підписок у {year}</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {publications.map((p) =>
              editId === p.id ? (
                <tr key={p.id} className="border-t border-border bg-elevated/50">
                  <td colSpan={5} className="px-3 py-3">
                    <EditForm
                      publication={p}
                      onCancel={() => setEditId(null)}
                      onSubmit={(fd) => handleUpdate(p.id, fd)}
                      isPending={isPending}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/subscriptions/publications/${p.id}?year=${year}`}
                      className="text-link hover:text-link-hover hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.notes && (
                      <div className="text-xs text-fg-subtle mt-0.5">
                        {p.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {p.issuesPerMonth ?? (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{p.activeCount}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditId(p.id)}
                          className="link text-xs"
                        >
                          Редагувати
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="text-danger hover:underline text-xs"
                        >
                          Видалити
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditForm({
  publication,
  onCancel,
  onSubmit,
  isPending,
}: {
  publication: Publication;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
  isPending: boolean;
}) {
  return (
    <form action={onSubmit} className="grid gap-3 sm:grid-cols-4">
      <div className="flex flex-col">
        <label className="text-xs text-fg-muted">Код *</label>
        <input
          name="code"
          required
          defaultValue={publication.code}
          className="input"
        />
      </div>
      <div className="flex flex-col sm:col-span-2">
        <label className="text-xs text-fg-muted">Назва *</label>
        <input
          name="name"
          required
          defaultValue={publication.name}
          className="input"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-fg-muted">Випусків/міс</label>
        <input
          type="number"
          min={0}
          name="issuesPerMonth"
          defaultValue={publication.issuesPerMonth ?? ""}
          className="input"
        />
      </div>
      <div className="flex flex-col sm:col-span-4">
        <label className="text-xs text-fg-muted">Нотатки</label>
        <input
          name="notes"
          defaultValue={publication.notes ?? ""}
          className="input"
        />
      </div>
      <div className="sm:col-span-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Скасувати
        </button>
        <button type="submit" disabled={isPending} className="btn-primary">
          Зберегти
        </button>
      </div>
    </form>
  );
}
