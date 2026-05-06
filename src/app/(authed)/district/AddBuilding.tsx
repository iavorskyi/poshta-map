"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBuilding } from "./actions";
import { useToast } from "@/components/Toast";

export function AddBuilding({ streets }: { streets: string[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setStreet("");
    setNumber("");
    setNotes("");
    setError(null);
  };

  const submit = () => {
    setError(null);
    const fd = new FormData();
    fd.set("street", street);
    fd.set("number", number);
    fd.set("notes", notes);
    startTransition(async () => {
      const res = await createBuilding(fd);
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      reset();
      setOpen(false);
      showToast("Будинок додано", "success");
      if (res.id) router.push(`/district/${res.id}`);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm text-fg-muted hover:border-brand hover:text-fg transition-colors"
      >
        + Додати будинок
      </button>
    );
  }

  return (
    <div className="card p-3 md:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Новий будинок</div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="text-fg-subtle hover:text-fg text-sm px-2 py-1"
          aria-label="Закрити"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">Вулиця *</span>
          <input
            list="district-streets"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="напр. Соборна"
            className="input"
          />
          <datalist id="district-streets">
            {streets.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">№ будинку *</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="12А"
            className="input"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-fg-muted">Примітки</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input"
        />
      </label>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="btn-secondary"
        >
          Скасувати
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="btn-primary"
        >
          {isPending ? "Збереження…" : "Додати"}
        </button>
      </div>
    </div>
  );
}
