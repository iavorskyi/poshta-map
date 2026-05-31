"use client";

import { useState } from "react";
import { BuildingCombobox, type BuildingOption } from "@/components/BuildingCombobox";

export type SubscriberFormValues = {
  fullName?: string;
  isOrganization?: boolean;
  phone?: string | null;
  buildingId?: number | null;
  streetText?: string | null;
  numberText?: string | null;
  corpus?: string | null;
  apartment?: string | null;
  deliveryMode?: "ADDRESS" | "PICKUP";
  notes?: string | null;
};

export function SubscriberForm({
  buildings,
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: {
  buildings: BuildingOption[];
  defaultValues?: SubscriberFormValues;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
}) {
  const [buildingId, setBuildingId] = useState<number | "">(
    defaultValues?.buildingId ?? "",
  );
  const [deliveryMode, setDeliveryMode] = useState<"ADDRESS" | "PICKUP">(
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
          onChange={(e) => setDeliveryMode(e.target.value as "ADDRESS" | "PICKUP")}
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
