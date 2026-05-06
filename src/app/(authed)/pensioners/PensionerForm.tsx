"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createPensioner, updatePensioner, deletePensioner } from "./actions";
import { BuildingCombobox, type BuildingOption } from "@/components/BuildingCombobox";
import { useToast } from "@/components/Toast";

type Pensioner = {
  id: number;
  fullName: string;
  buildingId: number;
  apartment: string | null;
  phone: string | null;
  passportNumber: string | null;
  pensionPaymentDay: number;
  postmanId: number | null;
  notes: string | null;
};

export function PensionerForm({
  pensioner,
  buildings,
  postmen,
  isAdmin,
  canEdit = true,
}: {
  pensioner?: Pensioner;
  buildings: BuildingOption[];
  postmen: { id: number; name: string }[];
  isAdmin: boolean;
  canEdit?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState<number | "">(pensioner?.buildingId ?? "");
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const onSubmit = (formData: FormData) => {
    setError(null);
    if (!buildingId) {
      setError("Оберіть будинок з дільниці");
      showToast("Оберіть будинок з дільниці", "error");
      return;
    }
    formData.set("buildingId", String(buildingId));
    startTransition(async () => {
      if (pensioner) {
        const res = await updatePensioner(pensioner.id, formData);
        if (res?.error) {
          setError(res.error);
          showToast(res.error, "error");
        } else {
          showToast("Пенсіонера збережено", "success");
        }
      } else {
        const res = await createPensioner(formData);
        if (res && "error" in res && res.error) {
          setError(res.error);
          showToast(res.error, "error");
        }
      }
    });
  };

  const onDelete = () => {
    if (!pensioner) return;
    if (!confirm("Видалити пенсіонера? Його поточні виплати теж будуть видалені.")) return;
    startTransition(async () => {
      const res = await deletePensioner(pensioner.id);
      if (res?.error) {
        setError(res.error);
        showToast(res.error, "error");
      }
    });
  };

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="card p-4 space-y-4">
        <h2 className="font-medium">Особисті дані</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="ФІО" required>
            <input
              name="fullName"
              required
              defaultValue={pensioner?.fullName ?? ""}
              className="input"
            />
          </Field>
          <Field label="Телефон">
            <input name="phone" defaultValue={pensioner?.phone ?? ""} className="input" />
          </Field>
          <Field label="Будинок (з дільниці)" required>
            <BuildingCombobox
              buildings={buildings}
              value={buildingId}
              onChange={setBuildingId}
            />
          </Field>
          <Field label="Квартира">
            <input
              name="apartment"
              defaultValue={pensioner?.apartment ?? ""}
              className="input"
            />
          </Field>
          <Field label="№ паспорту">
            <input
              name="passportNumber"
              defaultValue={pensioner?.passportNumber ?? ""}
              className="input"
            />
          </Field>
          <Field label="День виплати пенсії (1..31)" required>
            <input
              name="pensionPaymentDay"
              type="number"
              min={1}
              max={31}
              required
              defaultValue={pensioner?.pensionPaymentDay ?? ""}
              className="input"
            />
          </Field>
          {isAdmin && (
            <Field label="Листоноша">
              <select
                name="postmanId"
                defaultValue={pensioner?.postmanId ?? ""}
                className="input"
              >
                <option value="">— не обрано —</option>
                {postmen.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="Примітки">
          <textarea
            name="notes"
            rows={3}
            defaultValue={pensioner?.notes ?? ""}
            className="input"
          />
        </Field>
      </div>

      {error && <div className="text-sm text-danger">{error}</div>}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="submit"
          disabled={isPending || !canEdit}
          className="btn-primary"
        >
          {pensioner ? "Зберегти" : "Створити"}
        </button>
        <Link
          href={pensioner ? `/pensioners/${pensioner.id}` : "/pensioners"}
          className="btn-secondary"
        >
          Скасувати
        </Link>
        {pensioner && canEdit && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="sm:ml-auto btn-danger"
          >
            Видалити пенсіонера
          </button>
        )}
      </div>
      {!canEdit && (
        <div className="text-sm text-fg-muted">
          Цей пенсіонер не закріплений за вами. Лише перегляд.
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-fg-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}
