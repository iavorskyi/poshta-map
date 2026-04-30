"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addBuildingToAddressRound,
  deleteAddressRound,
  removeBuildingFromAddressRound,
  toggleAddressRoundItemDone,
  updateAddressRoundItemNotes,
  updateAddressRoundMeta,
} from "../actions";
import { formatDate, toDateInputValue } from "@/lib/format";
import { BuildingCombobox, type BuildingOption } from "@/components/BuildingCombobox";
import { useToast } from "@/components/Toast";

type Round = {
  id: number;
  date: string;
  postmanId: number | null;
  notes: string | null;
};

type Item = {
  id: number;
  buildingId: number;
  buildingStreet: string;
  buildingNumber: string;
  done: boolean;
  notes: string | null;
};

type Postman = { id: number; name: string };

export function AddressRoundDetailClient({
  round,
  items,
  buildings,
  postmen,
}: {
  round: Round;
  items: Item[];
  buildings: BuildingOption[];
  postmen: Postman[];
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

  const [isPending, startTransition] = useTransition();

  const remaining = useMemo(
    () => buildings.filter((b) => !items.some((it) => it.buildingId === b.id)),
    [buildings, items]
  );

  const totals = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.done).length;
    return { total, done };
  }, [items]);

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

  const addBuilding = () => {
    if (pickerValue === "") return;
    const id = Number(pickerValue);
    setPickerValue("");
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
      <div className="rounded-lg border border-slate-200 bg-white p-3 md:p-4">
        {editMeta ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-slate-600">Дата</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-slate-600">Поштар</span>
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
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-slate-600">Примітки</span>
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
                className="rounded bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-60"
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
                className="rounded border border-slate-300 px-4 py-2 text-sm"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">
                По-адресний обхід · {formatDate(round.date)}
              </h1>
              <div className="text-sm text-slate-600 mt-1">
                Поштар: {postmen.find((pm) => pm.id === round.postmanId)?.name ?? "—"}
              </div>
              {round.notes && (
                <div className="text-sm text-slate-600 mt-1">Примітки: {round.notes}</div>
              )}
              <div className="text-sm text-slate-600 mt-1">
                Пройдено: <strong>{totals.done}</strong> / {totals.total}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEditMeta(true)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                Редагувати
              </button>
              <button
                onClick={removeRound}
                className="rounded border border-red-300 text-red-700 px-3 py-2 text-sm hover:bg-red-50"
              >
                Видалити
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 md:p-4 space-y-3">
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
            className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          >
            Додати
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
            У цьому обході поки немає будинків.
          </div>
        ) : (
          items.map((it, idx) => {
            const isEditingNotes = editingNotesId === it.id;
            return (
              <div
                key={it.id}
                className={`rounded-lg border p-3 md:p-4 ${
                  it.done ? "border-green-200 bg-green-50/30" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <label className="flex items-center pt-1">
                    <input
                      type="checkbox"
                      checked={it.done}
                      onChange={(e) => toggleDone(it.id, e.target.checked)}
                      className="h-5 w-5 accent-blue-600"
                      aria-label="Пройдено"
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{idx + 1}.</span>
                      <Link
                        href={`/district/${it.buildingId}`}
                        className={`font-medium ${
                          it.done ? "text-green-800" : "text-blue-700 hover:underline"
                        }`}
                      >
                        {it.buildingStreet}, № {it.buildingNumber}
                      </Link>
                    </div>
                    {isEditingNotes ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={draftNotes}
                          onChange={(e) => setDraftNotes(e.target.value)}
                          rows={2}
                          className="input"
                          placeholder="Примітка для цього будинку"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveNotes(it.id)}
                            disabled={isPending}
                            className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:opacity-60"
                          >
                            Зберегти
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNotesId(null)}
                            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                          >
                            Скасувати
                          </button>
                        </div>
                      </div>
                    ) : it.notes ? (
                      <button
                        type="button"
                        onClick={() => startEditNotes(it)}
                        className="text-sm text-slate-600 mt-1 text-left hover:text-slate-900 cursor-text"
                      >
                        {it.notes}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditNotes(it)}
                        className="text-xs text-slate-400 mt-1 hover:text-blue-600"
                      >
                        + Додати примітку
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="text-red-600 text-sm px-2 py-1 shrink-0"
                    aria-label="Прибрати"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
