"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { createAddressRound } from "../actions";
import { getNearbyBuildings, type NearbyBuilding } from "../nearby";
import { toDateInputValue } from "@/lib/format";
import { BuildingCombobox, type BuildingOption } from "@/components/BuildingCombobox";
import { useToast } from "@/components/Toast";
import type { MapBuilding } from "@/components/AddressMap";

const AddressMap = dynamic(() => import("@/components/AddressMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 md:h-96 rounded-lg border border-border bg-elevated/40 flex items-center justify-center text-sm text-fg-subtle">
      Завантаження карти…
    </div>
  ),
});

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
  const [suggestions, setSuggestions] = useState<NearbyBuilding[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const { showToast } = useToast();

  const buildingById = useMemo(
    () => Object.fromEntries(buildings.map((b) => [b.id, b] as const)),
    [buildings]
  );

  const remaining = useMemo(
    () => buildings.filter((b) => !selectedIds.includes(b.id)),
    [buildings, selectedIds]
  );

  const selectedMapBuildings: MapBuilding[] = useMemo(
    () =>
      selectedIds
        .map((id) => buildingById[id])
        .filter(Boolean)
        .map((b) => ({
          id: b.id,
          street: b.street,
          number: b.number,
          latitude: b.latitude ?? null,
          longitude: b.longitude ?? null,
        })),
    [selectedIds, buildingById]
  );

  const originId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
  const excludeIdsKey = selectedIds.slice(0, -1).join(",");

  // Підказки тягнемо при зміні останнього обраного будинку.
  useEffect(() => {
    if (originId === null) return;
    const exclude = excludeIdsKey ? excludeIdsKey.split(",").map(Number) : [];
    let cancelled = false;
    setLoadingSuggestions(true);
    getNearbyBuildings(originId, exclude)
      .then((list) => {
        if (!cancelled) setSuggestions(list);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSuggestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [originId, excludeIdsKey]);

  const visibleSuggestions = useMemo(
    () => suggestions.filter((s) => !selectedIds.includes(s.id)),
    [suggestions, selectedIds]
  );

  const addById = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

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
              <span className="text-xs text-fg-muted">Листоноша</span>
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
          <>
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

          <SuggestionsBlock
            loading={loadingSuggestions}
            items={visibleSuggestions}
            onAdd={addById}
          />

          <AddressMap
            selected={selectedMapBuildings}
            suggestions={visibleSuggestions.map((s) => ({
              id: s.id,
              street: s.street,
              number: s.number,
              latitude: s.latitude,
              longitude: s.longitude,
            }))}
            onAddBuilding={addById}
          />
          </>
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

function SuggestionsBlock({
  loading,
  items,
  onAdd,
}: {
  loading: boolean;
  items: NearbyBuilding[];
  onAdd: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-fg-subtle">
        Поруч {loading && <span className="ml-1">— оновлення…</span>}
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-fg-subtle">
          {loading ? "Шукаємо сусідів…" : "Немає підказок поряд."}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onAdd(s.id)}
                className="rounded-full border border-border bg-elevated hover:bg-surface px-3 py-1 text-xs flex items-center gap-1.5"
                title="Додати в обхід"
              >
                <span>+</span>
                <span>{s.street}, № {s.number}</span>
                <span className="text-fg-subtle">
                  {s.sameStreet
                    ? "та сама вулиця"
                    : s.distanceM !== null
                    ? `${s.distanceM} м`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
