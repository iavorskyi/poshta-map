"use client";

import { useMemo, useState, useTransition } from "react";
import { createAddressRound } from "../actions";
import { toDateInputValue } from "@/lib/format";
import { BuildingCombobox, type BuildingOption } from "@/components/BuildingCombobox";
import { useToast } from "@/components/Toast";

type Postman = { id: number; name: string };

export function NewAddressRoundClient({
  buildings,
  postmen,
  isAdmin,
}: {
  buildings: BuildingOption[];
  postmen: Postman[];
  isAdmin: boolean;
}) {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [date, setDate] = useState(today);
  const [postmanId, setPostmanId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [pickerValue, setPickerValue] = useState<number | "">("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const buildingById = useMemo(
    () => Object.fromEntries(buildings.map((b) => [b.id, b] as const)),
    [buildings]
  );

  const remaining = useMemo(
    () => buildings.filter((b) => !selectedIds.includes(b.id)),
    [buildings, selectedIds]
  );

  const addPicked = () => {
    if (pickerValue === "") return;
    setSelectedIds((prev) => (prev.includes(pickerValue) ? prev : [...prev, pickerValue]));
    setPickerValue("");
  };

  const remove = (id: number) =>
    setSelectedIds((prev) => prev.filter((x) => x !== id));

  const move = (id: number, delta: -1 | 1) => {
    setSelectedIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = idx + delta;
      if (next < 0 || next >= prev.length) return prev;
      const copy = prev.slice();
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const onSubmit = (formData: FormData) => {
    setError(null);
    if (!date) {
      setError("Вкажіть дату");
      showToast("Вкажіть дату", "error");
      return;
    }
    formData.set("date", date);
    formData.set("postmanId", postmanId === "" ? "" : String(postmanId));
    formData.set("notes", notes);
    formData.set("buildingIds", JSON.stringify(selectedIds));
    startTransition(async () => {
      const res = await createAddressRound(formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
        showToast(res.error, "error");
      }
    });
  };

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3`}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-fg-muted">Дата *</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              required
            />
          </label>
          {isAdmin && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-fg-muted">Поштар</span>
              <select
                value={postmanId}
                onChange={(e) => setPostmanId(e.target.value ? Number(e.target.value) : "")}
                className="input"
              >
                <option value="">— не обрано —</option>
                {postmen.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-fg-muted">Примітки</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              placeholder="Необов'язково"
            />
          </label>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="font-medium">Будинки в обході</div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <BuildingCombobox
              buildings={remaining}
              value={pickerValue}
              onChange={setPickerValue}
              placeholder="Знайти і додати будинок"
            />
          </div>
          <button
            type="button"
            onClick={addPicked}
            disabled={pickerValue === ""}
            className="btn-secondary"
          >
            Додати
          </button>
        </div>

        {selectedIds.length === 0 ? (
          <div className="text-sm text-fg-subtle">Ще нічого не додано.</div>
        ) : (
          <ol className="space-y-2">
            {selectedIds.map((id, idx) => {
              const b = buildingById[id];
              if (!b) return null;
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-fg-subtle w-6 text-right">{idx + 1}.</span>
                    <span className="truncate">
                      {b.street}, № {b.number}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => move(id, -1)}
                      disabled={idx === 0}
                      className="px-2 py-1 text-fg-subtle hover:text-fg disabled:opacity-30"
                      aria-label="Вище"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(id, 1)}
                      disabled={idx === selectedIds.length - 1}
                      className="px-2 py-1 text-fg-subtle hover:text-fg disabled:opacity-30"
                      aria-label="Нижче"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(id)}
                      className="text-danger px-2 py-1 text-sm"
                      aria-label="Видалити"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {error && <div className="text-sm text-danger">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary"
        >
          Створити обхід
        </button>
      </div>
    </form>
  );
}
