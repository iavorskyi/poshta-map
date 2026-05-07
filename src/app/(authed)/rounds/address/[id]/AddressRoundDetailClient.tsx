"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  addBuildingToAddressRound,
  deleteAddressRound,
  removeBuildingFromAddressRound,
  setAddressRoundClosed,
  toggleAddressRoundItemDone,
  updateAddressRoundItemNotes,
  updateAddressRoundMeta,
} from "../actions";
import { getNearbyBuildings, type NearbyBuilding } from "../nearby";
import { formatDate, toDateInputValue } from "@/lib/format";
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

type Round = {
  id: number;
  date: string;
  postmanId: number | null;
  notes: string | null;
  closedAt: string | null;
};

type Item = {
  id: number;
  buildingId: number;
  buildingStreet: string;
  buildingNumber: string;
  buildingLatitude: number | null;
  buildingLongitude: number | null;
  done: boolean;
  notes: string | null;
};

type Postman = { id: number; name: string };

export function AddressRoundDetailClient({
  round,
  items,
  buildings,
  postmen,
  isAdmin,
  canEdit,
}: {
  round: Round;
  items: Item[];
  buildings: BuildingOption[];
  postmen: Postman[];
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [editMeta, setEditMeta] = useState(false);
  const [date, setDate] = useState(toDateInputValue(round.date));
  const [postmanId, setPostmanId] = useState<number | "">(round.postmanId ?? "");
  const [notes, setNotes] = useState(round.notes ?? "");

  const [pickerValue, setPickerValue] = useState<number | "">("");
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [suggestions, setSuggestions] = useState<NearbyBuilding[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [isPending, startTransition] = useTransition();

  const remaining = useMemo(
    () => buildings.filter((b) => !items.some((it) => it.buildingId === b.id)),
    [buildings, items]
  );

  const selectedMapBuildings: MapBuilding[] = useMemo(
    () =>
      items.map((it) => ({
        id: it.buildingId,
        street: it.buildingStreet,
        number: it.buildingNumber,
        latitude: it.buildingLatitude,
        longitude: it.buildingLongitude,
      })),
    [items]
  );

  const originId = items.length > 0 ? items[items.length - 1].buildingId : null;
  const excludeIdsKey = useMemo(
    () => items.slice(0, -1).map((it) => it.buildingId).join(","),
    [items]
  );

  // Тягнемо підказки з останнього доданого будинку.
  useEffect(() => {
    if (!canEdit || originId === null) return;
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
  }, [originId, excludeIdsKey, canEdit]);

  const visibleSuggestions = useMemo(
    () =>
      suggestions.filter(
        (s) => !items.some((it) => it.buildingId === s.id)
      ),
    [suggestions, items]
  );

  const totals = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.done).length;
    return { total, done };
  }, [items]);

  const todoItems = useMemo(() => items.filter((i) => !i.done), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.done), [items]);

  const saveMeta = () => {
    startTransition(async () => {
      const res = await updateAddressRoundMeta(round.id, {
        date,
        postmanId: postmanId === "" ? null : Number(postmanId),
        notes: notes.trim() || null,
      });
      if (res?.error) {
        showToast(res.error, "error");
        return;
      }
      setEditMeta(false);
      showToast("Збережено", "success");
    });
  };

  const removeRound = () => {
    if (!confirm("Видалити цей обхід?")) return;
    startTransition(async () => {
      const res = await deleteAddressRound(round.id);
      if (res?.error) {
        showToast(res.error, "error");
        return;
      }
      showToast("Обхід видалено", "success");
      router.push("/rounds?tab=address");
    });
  };

  const isClosed = !!round.closedAt;
  const toggleClosed = () => {
    const next = !isClosed;
    if (next) {
      const left = items.filter((i) => !i.done).length;
      const msg = left
        ? `Закрити обхід? Залишилося непройдених будинків: ${left}.`
        : "Закрити обхід?";
      if (!confirm(msg)) return;
    }
    startTransition(async () => {
      const res = await setAddressRoundClosed(round.id, next);
      if (res?.error) {
        showToast(res.error, "error");
        return;
      }
      showToast(next ? "Обхід закрито" : "Обхід відкрито", "success");
    });
  };

  const addBuilding = () => {
    if (pickerValue === "") return;
    const id = Number(pickerValue);
    setPickerValue("");
    addById(id);
  };

  const addById = (id: number) => {
    startTransition(async () => {
      const res = await addBuildingToAddressRound(round.id, id);
      if (res?.error) showToast(res.error, "error");
      else showToast("Будинок додано", "success");
    });
  };

  const removeItem = (itemId: number) => {
    if (!confirm("Прибрати будинок з обходу?")) return;
    startTransition(async () => {
      const res = await removeBuildingFromAddressRound(round.id, itemId);
      if (res?.error) showToast(res.error, "error");
    });
  };

  const toggleDone = (itemId: number, next: boolean) => {
    startTransition(async () => {
      const res = await toggleAddressRoundItemDone(round.id, itemId, next);
      if (res?.error) showToast(res.error, "error");
    });
  };

  const startEditNotes = (item: Item) => {
    setEditingNotesId(item.id);
    setDraftNotes(item.notes ?? "");
  };

  const saveNotes = (itemId: number) => {
    const value = draftNotes.trim();
    startTransition(async () => {
      const res = await updateAddressRoundItemNotes(
        round.id,
        itemId,
        value || null
      );
      if (res?.error) {
        showToast(res.error, "error");
        return;
      }
      setEditingNotesId(null);
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="card p-3 md:p-4">
        {editMeta ? (
          <div className="space-y-3">
            <div className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3`}>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-fg-muted">Дата</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
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
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveMeta}
                disabled={isPending}
                className="btn-primary"
              >
                Зберегти
              </button>
              <button
                onClick={() => {
                  setEditMeta(false);
                  setDate(toDateInputValue(round.date));
                  setPostmanId(round.postmanId ?? "");
                  setNotes(round.notes ?? "");
                }}
                className="btn-secondary"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-semibold">
                  По-адресний обхід · {formatDate(round.date)}
                </h1>
                {isClosed && (
                  <span className="rounded-full bg-elevated text-fg-muted px-2 py-0.5 text-xs">
                    Закритий
                  </span>
                )}
              </div>
              <div className="text-sm text-fg-muted mt-1">
                Листоноша: {postmen.find((pm) => pm.id === round.postmanId)?.name ?? "—"}
              </div>
              {round.notes && (
                <div className="text-sm text-fg-muted mt-1">Примітки: {round.notes}</div>
              )}
              <div className="text-sm text-fg-muted mt-1">
                Пройдено: <strong>{totals.done}</strong> / {totals.total}
              </div>
              {isClosed && round.closedAt && (
                <div className="text-xs text-fg-subtle mt-1">
                  Закритий {formatDate(round.closedAt)}
                </div>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setEditMeta(true)}
                  className="btn-secondary"
                >
                  Редагувати
                </button>
                <button
                  onClick={toggleClosed}
                  disabled={isPending}
                  className="btn-secondary"
                >
                  {isClosed ? "Відкрити обхід" : "Закрити обхід"}
                </button>
                <button
                  onClick={removeRound}
                  className="btn-danger"
                >
                  Видалити
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="card p-3 md:p-4 space-y-3">
          <div className="font-medium">Додати будинок</div>
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
              onClick={addBuilding}
              disabled={pickerValue === "" || isPending}
              className="btn-secondary"
            >
              Додати
            </button>
          </div>

          {items.length > 0 && (
            <NearbySuggestions
              loading={loadingSuggestions}
              items={visibleSuggestions}
              onAdd={addById}
            />
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="card p-2 md:p-3">
          <AddressMap
            selected={selectedMapBuildings}
            suggestions={
              canEdit
                ? visibleSuggestions.map((s) => ({
                    id: s.id,
                    street: s.street,
                    number: s.number,
                    latitude: s.latitude,
                    longitude: s.longitude,
                  }))
                : []
            }
            onAddBuilding={addById}
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle">
          У цьому обході поки немає будинків.
        </div>
      ) : (
        <div className="space-y-2">
          {todoItems.map((it, idx) => (
            <AddressItemCard
              key={it.id}
              item={it}
              index={idx + 1}
              isEditingNotes={editingNotesId === it.id}
              draftNotes={draftNotes}
              isPending={isPending}
              onDraftNotesChange={setDraftNotes}
              onStartEditNotes={startEditNotes}
              onCancelEditNotes={() => setEditingNotesId(null)}
              onSaveNotes={saveNotes}
              onToggleDone={toggleDone}
              onRemove={removeItem}
              canEdit={canEdit}
            />
          ))}

          {doneItems.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center gap-3 text-xs text-fg-subtle uppercase tracking-wide mb-2">
                <span>Пройдені ({doneItems.length})</span>
                <span className="flex-1 border-t border-border" />
              </div>
              <div className="space-y-2 opacity-80">
                {doneItems.map((it, idx) => (
                  <AddressItemCard
                    key={it.id}
                    item={it}
                    index={todoItems.length + idx + 1}
                    isEditingNotes={editingNotesId === it.id}
                    draftNotes={draftNotes}
                    isPending={isPending}
                    onDraftNotesChange={setDraftNotes}
                    onStartEditNotes={startEditNotes}
                    onCancelEditNotes={() => setEditingNotesId(null)}
                    onSaveNotes={saveNotes}
                    onToggleDone={toggleDone}
                    onRemove={removeItem}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddressItemCard({
  item: it,
  index,
  isEditingNotes,
  draftNotes,
  isPending,
  onDraftNotesChange,
  onStartEditNotes,
  onCancelEditNotes,
  onSaveNotes,
  onToggleDone,
  onRemove,
  canEdit,
}: {
  item: Item;
  index: number;
  isEditingNotes: boolean;
  draftNotes: string;
  isPending: boolean;
  onDraftNotesChange: (v: string) => void;
  onStartEditNotes: (item: Item) => void;
  onCancelEditNotes: () => void;
  onSaveNotes: (id: number) => void;
  onToggleDone: (id: number, next: boolean) => void;
  onRemove: (id: number) => void;
  canEdit: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 md:p-4 ${
        it.done ? "border-success-border bg-success-bg/30" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        <label className="flex items-center pt-1">
          <input
            type="checkbox"
            checked={it.done}
            disabled={!canEdit}
            onChange={(e) => onToggleDone(it.id, e.target.checked)}
            className="h-5 w-5 accent-brand disabled:opacity-50"
            aria-label="Пройдено"
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-subtle">{index}.</span>
            <Link
              href={`/district/${it.buildingId}`}
              className={`font-medium ${
                it.done ? "text-success" : "text-link hover:text-link-hover hover:underline"
              }`}
            >
              {it.buildingStreet}, № {it.buildingNumber}
            </Link>
          </div>
          {!canEdit ? (
            it.notes ? (
              <div className="text-sm text-fg-muted mt-1">{it.notes}</div>
            ) : null
          ) : isEditingNotes ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={draftNotes}
                onChange={(e) => onDraftNotesChange(e.target.value)}
                rows={2}
                className="input"
                placeholder="Примітка для цього будинку"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSaveNotes(it.id)}
                  disabled={isPending}
                  className="btn-primary !px-3 !py-1.5"
                >
                  Зберегти
                </button>
                <button
                  type="button"
                  onClick={onCancelEditNotes}
                  className="btn-secondary !px-3 !py-1.5"
                >
                  Скасувати
                </button>
              </div>
            </div>
          ) : it.notes ? (
            <button
              type="button"
              onClick={() => onStartEditNotes(it)}
              className="text-sm text-fg-muted mt-1 text-left hover:text-fg cursor-text"
            >
              {it.notes}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStartEditNotes(it)}
              className="text-xs text-fg-subtle mt-1 hover:text-link"
            >
              + Додати примітку
            </button>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => onRemove(it.id)}
            className="text-danger text-sm px-2 py-1 shrink-0"
            aria-label="Прибрати"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function NearbySuggestions({
  loading,
  items,
  onAdd,
}: {
  loading: boolean;
  items: NearbyBuilding[];
  onAdd: (id: number) => void;
}) {
  return (
    <div className="space-y-2 pt-1">
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
