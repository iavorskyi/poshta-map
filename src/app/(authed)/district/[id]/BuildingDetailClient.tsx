"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addEntrance,
  deleteBuilding,
  deleteEntrance,
  updateBuilding,
  updateEntrance,
} from "../actions";
import { useToast } from "@/components/Toast";

type Building = {
  id: number;
  street: string;
  number: string;
  notes: string | null;
};

type Entrance = {
  id: number;
  number: number;
  aptFrom: number | null;
  aptTo: number | null;
  notes: string | null;
};

function formatRange(from: number | null, to: number | null): string {
  if (from == null && to == null) return "";
  if (from != null && to != null) return from === to ? String(from) : `${from}-${to}`;
  return String(from ?? to);
}

export function BuildingDetailClient({
  building,
  entrances,
}: {
  building: Building;
  entrances: Entrance[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [editMeta, setEditMeta] = useState(false);
  const [street, setStreet] = useState(building.street);
  const [number, setNumber] = useState(building.number);
  const [notes, setNotes] = useState(building.notes ?? "");

  const [showAdd, setShowAdd] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newRange, setNewRange] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editRange, setEditRange] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const saveMeta = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateBuilding(building.id, {
        street,
        number,
        notes: notes.trim() || null,
      });
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      setEditMeta(false);
      showToast("Будинок збережено", "success");
    });
  };

  const removeBuilding = () => {
    if (!confirm("Видалити будинок з усіма парадними?")) return;
    startTransition(async () => {
      const res = await deleteBuilding(building.id);
      if (res.error) {
        showToast(res.error, "error");
        return;
      }
      showToast("Будинок видалено", "success");
      router.push("/district");
    });
  };

  const submitNew = () => {
    setError(null);
    const num = Number(newNumber);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Введіть номер парадного");
      return;
    }
    startTransition(async () => {
      const res = await addEntrance(building.id, {
        number: num,
        aptRange: newRange,
        notes: newNotes,
      });
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      setNewNumber("");
      setNewRange("");
      setNewNotes("");
      setShowAdd(false);
      showToast("Парадне додано", "success");
    });
  };

  const startEdit = (e: Entrance) => {
    setEditingId(e.id);
    setEditNumber(String(e.number));
    setEditRange(formatRange(e.aptFrom, e.aptTo));
    setEditNotes(e.notes ?? "");
    setError(null);
  };

  const submitEdit = () => {
    if (editingId == null) return;
    setError(null);
    const num = Number(editNumber);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Введіть номер парадного");
      return;
    }
    startTransition(async () => {
      const res = await updateEntrance(editingId, building.id, {
        number: num,
        aptRange: editRange,
        notes: editNotes,
      });
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      setEditingId(null);
      showToast("Парадне збережено", "success");
    });
  };

  const removeEntrance = (id: number) => {
    if (!confirm("Видалити парадне?")) return;
    startTransition(async () => {
      const res = await deleteEntrance(id, building.id);
      if (res?.error) showToast(res.error, "error");
      else showToast("Парадне видалено", "success");
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-3 md:p-4">
        {editMeta ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-fg-muted">Вулиця</span>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-fg-muted">№ будинку</span>
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveMeta}
                disabled={isPending}
                className="btn-primary"
              >
                Зберегти
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMeta(false);
                  setStreet(building.street);
                  setNumber(building.number);
                  setNotes(building.notes ?? "");
                  setError(null);
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
              <h1 className="text-xl md:text-2xl font-semibold">
                {building.street}, № {building.number}
              </h1>
              {building.notes && (
                <div className="text-sm text-fg-muted mt-1">
                  Примітки: {building.notes}
                </div>
              )}
              <div className="text-sm text-fg-muted mt-1">
                Парадних: <strong>{entrances.length}</strong>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setEditMeta(true)}
                className="btn-secondary"
              >
                Редагувати
              </button>
              <button
                type="button"
                onClick={removeBuilding}
                className="btn-danger"
              >
                Видалити
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdd ? (
        <div className="card p-3 md:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Нове парадне</div>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setNewNumber("");
                setNewRange("");
                setNewNotes("");
                setError(null);
              }}
              className="text-fg-subtle hover:text-fg text-sm px-2 py-1"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-fg-muted">№ парадного *</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-fg-muted">Діапазон квартир (1-8)</span>
              <input
                value={newRange}
                onChange={(e) => setNewRange(e.target.value)}
                placeholder="1-8"
                className="input"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-fg-muted">Примітки</span>
            <input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="input"
            />
          </label>
          {error && <div className="text-sm text-danger">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setNewNumber("");
                setNewRange("");
                setNewNotes("");
                setError(null);
              }}
              className="btn-secondary"
            >
              Скасувати
            </button>
            <button
              type="button"
              onClick={submitNew}
              disabled={isPending}
              className="btn-primary"
            >
              {isPending ? "Збереження…" : "Додати"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm text-fg-muted hover:border-brand hover:text-fg transition-colors"
        >
          + Додати парадне
        </button>
      )}

      <div className="space-y-3">
        {entrances.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle text-sm">
            Парадних ще немає.
          </div>
        ) : (
          entrances.map((e) => {
            const isEditing = editingId === e.id;
            return (
              <div
                key={e.id}
                className="card p-3 md:p-4"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2">
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="text-xs text-fg-muted">№ парадного</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={editNumber}
                          onChange={(ev) => setEditNumber(ev.target.value)}
                          className="input"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="text-xs text-fg-muted">
                          Діапазон квартир
                        </span>
                        <input
                          value={editRange}
                          onChange={(ev) => setEditRange(ev.target.value)}
                          placeholder="1-8"
                          className="input"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs text-fg-muted">Примітки</span>
                      <input
                        value={editNotes}
                        onChange={(ev) => setEditNotes(ev.target.value)}
                        className="input"
                      />
                    </label>
                    {error && (
                      <div className="text-sm text-danger">{error}</div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={submitEdit}
                        disabled={isPending}
                        className="btn-primary"
                      >
                        Зберегти
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setError(null);
                        }}
                        className="btn-secondary"
                      >
                        Скасувати
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">Парадне № {e.number}</div>
                      {(e.aptFrom != null || e.aptTo != null) && (
                        <div className="text-sm text-fg-muted mt-1">
                          Квартири: {formatRange(e.aptFrom, e.aptTo)}
                        </div>
                      )}
                      {e.notes && (
                        <div className="text-sm text-fg-subtle mt-1">{e.notes}</div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(e)}
                        className="btn-secondary !px-3 !py-1.5"
                      >
                        Редагувати
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEntrance(e.id)}
                        className="btn-danger !px-3 !py-1.5"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
