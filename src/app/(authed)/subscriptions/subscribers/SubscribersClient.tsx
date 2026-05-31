"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useGlobalPending } from "@/components/RouteProgress";
import { useToast } from "@/components/Toast";
import { BuildingCombobox, type BuildingOption } from "@/components/BuildingCombobox";
import {
  createSubscriber,
  deleteSubscriber,
  updateSubscriber,
} from "./actions";

type DeliveryMode = "ADDRESS" | "PICKUP";

type Subscriber = {
  id: number;
  fullName: string;
  isOrganization: boolean;
  phone: string | null;
  buildingId: number | null;
  building: string | null;
  streetText: string | null;
  numberText: string | null;
  corpus: string | null;
  apartment: string | null;
  deliveryMode: DeliveryMode;
  notes: string | null;
  activeCount: number;
};

export function SubscribersClient({
  subscribers,
  buildings,
  q,
  year,
  canManage,
}: {
  subscribers: Subscriber[];
  buildings: BuildingOption[];
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
    router.replace(`/subscriptions/subscribers?${next.toString()}`);
  };

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const res = await createSubscriber(formData);
      if ("error" in res) {
        showToast(res.error, "error");
      } else {
        showToast("Передплатника додано", "success");
        setShowCreate(false);
        router.push(`/subscriptions/subscribers/${res.id}?year=${year}`);
      }
    });
  };

  const handleUpdate = (id: number, formData: FormData) => {
    startTransition(async () => {
      const res = await updateSubscriber(id, formData);
      if ("error" in res) showToast(res.error, "error");
      else {
        showToast("Збережено", "success");
        setEditId(null);
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Видалити «${name}» з усіма його підписками?`)) return;
    startTransition(async () => {
      const res = await deleteSubscriber(id);
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
          placeholder="Пошук по ПІБ або телефону…"
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
            {showCreate ? "Скасувати" : "+ Передплатник"}
          </button>
        )}
      </div>

      {canManage && showCreate && (
        <SubscriberForm
          buildings={buildings}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          submitLabel="Додати"
          isPending={isPending}
        />
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-fg-muted">
            <tr>
              <th className="text-left px-3 py-2">ПІБ / Організація</th>
              <th className="text-left px-3 py-2">Адреса</th>
              <th className="text-left px-3 py-2">Телефон</th>
              <th className="text-left px-3 py-2">Доставка</th>
              <th className="text-right px-3 py-2">Підписок у {year}</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) =>
              editId === s.id ? (
                <tr key={s.id} className="border-t border-border bg-elevated/50">
                  <td colSpan={6} className="px-3 py-3">
                    <SubscriberForm
                      buildings={buildings}
                      defaultValues={s}
                      onSubmit={(fd) => handleUpdate(s.id, fd)}
                      onCancel={() => setEditId(null)}
                      submitLabel="Зберегти"
                      isPending={isPending}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link
                      href={`/subscriptions/subscribers/${s.id}?year=${year}`}
                      className="text-link hover:text-link-hover hover:underline font-medium"
                    >
                      {s.fullName}
                    </Link>
                    {s.isOrganization && (
                      <span className="ml-2 rounded-full bg-elevated px-2 py-0.5 text-xs text-fg-muted">
                        організація
                      </span>
                    )}
                    {s.notes && (
                      <div className="text-xs text-fg-subtle mt-0.5">
                        {s.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.building ? (
                      <>
                        {s.building}
                        {s.corpus && `, корп. ${s.corpus}`}
                        {s.apartment && `, кв. ${s.apartment}`}
                      </>
                    ) : s.streetText && s.numberText ? (
                      <span
                        className="text-fg-subtle italic"
                        title="Адреса поза дільницею"
                      >
                        {s.streetText}, {s.numberText}
                        {s.corpus && `, корп. ${s.corpus}`}
                        {s.apartment && `, кв. ${s.apartment}`}
                      </span>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {s.phone ?? <span className="text-fg-subtle">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {s.deliveryMode === "ADDRESS" ? (
                      <span className="rounded-full bg-elevated px-2 py-0.5 text-xs">
                        На адресу
                      </span>
                    ) : (
                      <span className="rounded-full bg-elevated px-2 py-0.5 text-xs">
                        Самовивіз
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{s.activeCount}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditId(s.id)}
                          className="link text-xs"
                        >
                          Редагувати
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, s.fullName)}
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

function SubscriberForm({
  buildings,
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: {
  buildings: BuildingOption[];
  defaultValues?: Partial<Subscriber>;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
}) {
  const [buildingId, setBuildingId] = useState<number | "">(
    defaultValues?.buildingId ?? "",
  );
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(
    defaultValues?.deliveryMode ?? "ADDRESS",
  );
  const [isOrg, setIsOrg] = useState(defaultValues?.isOrganization ?? false);
  const initialOffDistrict =
    !defaultValues?.buildingId &&
    Boolean(defaultValues?.streetText || defaultValues?.numberText);
  const [offDistrict, setOffDistrict] = useState(initialOffDistrict);

  return (
    <form
      action={(fd) => {
        if (offDistrict) {
          fd.delete("buildingId");
        } else {
          if (buildingId !== "") fd.set("buildingId", String(buildingId));
          else fd.delete("buildingId");
          fd.delete("streetText");
          fd.delete("numberText");
        }
        fd.set("deliveryMode", deliveryMode);
        if (isOrg) fd.set("isOrganization", "on");
        else fd.delete("isOrganization");
        onSubmit(fd);
      }}
      className="card p-4 grid gap-3 sm:grid-cols-6"
    >
      <div className="flex flex-col sm:col-span-3">
        <label className="text-xs text-fg-muted">
          {isOrg ? "Назва організації *" : "ПІБ *"}
        </label>
        <input
          name="fullName"
          required
          defaultValue={defaultValues?.fullName ?? ""}
          className="input"
          placeholder={isOrg ? 'ТОВ "Промінь"' : "Іваненко Іван Іванович"}
        />
      </div>
      <div className="flex flex-col sm:col-span-2">
        <label className="text-xs text-fg-muted">Телефон</label>
        <input
          name="phone"
          defaultValue={defaultValues?.phone ?? ""}
          className="input"
          placeholder="+380…"
        />
      </div>
      <div className="flex items-end gap-2 sm:col-span-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isOrg}
            onChange={(e) => setIsOrg(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Організація
        </label>
      </div>

      <div className="sm:col-span-6 flex items-center justify-between gap-2">
        <span className="text-xs text-fg-muted">Адреса</span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={offDistrict}
            onChange={(e) => setOffDistrict(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Поза дільницею (без прив&apos;язки до будинку)
        </label>
      </div>

      {offDistrict ? (
        <>
          <div className="flex flex-col sm:col-span-2">
            <label className="text-xs text-fg-muted">Вулиця *</label>
            <input
              name="streetText"
              defaultValue={defaultValues?.streetText ?? ""}
              className="input"
              placeholder="вул. Шевченка"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-fg-muted">Номер *</label>
            <input
              name="numberText"
              defaultValue={defaultValues?.numberText ?? ""}
              className="input"
              placeholder="12А"
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col sm:col-span-3">
          <label className="text-xs text-fg-muted">Будинок з дільниці</label>
          <BuildingCombobox
            buildings={buildings}
            value={buildingId}
            onChange={setBuildingId}
            placeholder="Оберіть будинок з дільниці"
          />
        </div>
      )}
      <div className="flex flex-col">
        <label className="text-xs text-fg-muted">Корпус</label>
        <input
          name="corpus"
          defaultValue={defaultValues?.corpus ?? ""}
          className="input"
          placeholder="—"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-fg-muted">Квартира</label>
        <input
          name="apartment"
          defaultValue={defaultValues?.apartment ?? ""}
          className="input"
          placeholder="—"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-fg-muted">Доставка</label>
        <select
          value={deliveryMode}
          onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
          className="input"
        >
          <option value="ADDRESS">На адресу</option>
          <option value="PICKUP">Самовивіз</option>
        </select>
      </div>

      <div className="flex flex-col sm:col-span-6">
        <label className="text-xs text-fg-muted">Нотатки</label>
        <input
          name="notes"
          defaultValue={defaultValues?.notes ?? ""}
          className="input"
          placeholder="—"
        />
      </div>

      <div className="sm:col-span-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Скасувати
        </button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
