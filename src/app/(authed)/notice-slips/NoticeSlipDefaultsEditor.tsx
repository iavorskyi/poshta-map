"use client";

import { useState, useTransition } from "react";
import { useGlobalPending } from "@/components/RouteProgress";
import { useToast } from "@/components/Toast";
import { setNoticeSlipDefaults, type NoticeSlipDefaults } from "./actions";

export function NoticeSlipDefaultsEditor({
  defaults,
  onSaved,
}: {
  defaults: NoticeSlipDefaults;
  onSaved: (next: NoticeSlipDefaults) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const { showToast } = useToast();

  const handleSave = (formData: FormData) => {
    startTransition(async () => {
      const res = await setNoticeSlipDefaults(formData);
      if ("error" in res) {
        showToast(res.error, "error");
        return;
      }
      onSaved({
        branchAddress: String(formData.get("branchAddress") ?? "").trim(),
        workingHours: String(formData.get("workingHours") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
      });
      showToast("Дефолти збережено", "success");
      setOpen(false);
    });
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary">
        {open ? "Сховати дефолти" : "Редагувати дефолти"}
      </button>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(new FormData(e.currentTarget));
          }}
          className="space-y-3 rounded-lg border border-border bg-elevated p-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-fg-muted">Адреса відділення</span>
            <input
              name="branchAddress"
              defaultValue={defaults.branchAddress}
              className="input"
              placeholder="напр. м. Київ, вул. Хрещатик, 1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-fg-muted">Режим роботи</span>
            <input
              name="workingHours"
              defaultValue={defaults.workingHours}
              className="input"
              placeholder="напр. з 8:00 до 18:00, перерва 13:00–14:00"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-fg-muted">Телефон</span>
            <input
              name="phone"
              defaultValue={defaults.phone}
              className="input"
              placeholder="напр. +380 44 123 45 67"
            />
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary" disabled={isPending}>
              Зберегти
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary"
              disabled={isPending}
            >
              Скасувати
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
