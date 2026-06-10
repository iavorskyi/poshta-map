"use client";

import { useState } from "react";

export type OrganizationFormValues = {
  name: string;
  address: string | null;
  description: string | null;
  picksUpMail: boolean;
  storageLocation: string | null;
};

// Інлайн-форма (без модалок) — використовується і для створення, і для
// редагування існуючої організації. Сабмітимо через FormData, як інші форми
// в цьому застосунку.
export function OrganizationForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: {
  defaultValues?: Partial<OrganizationFormValues>;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
}) {
  const [picksUpMail, setPicksUpMail] = useState<boolean>(
    defaultValues?.picksUpMail ?? false
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (picksUpMail) fd.set("picksUpMail", "on");
        else fd.delete("picksUpMail");
        onSubmit(fd);
      }}
      className="space-y-3 rounded-lg border border-border bg-elevated p-3"
    >
      <div>
        <label className="block text-xs text-fg-muted mb-1">Назва *</label>
        <input
          name="name"
          required
          defaultValue={defaultValues?.name ?? ""}
          className="input w-full"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs text-fg-muted mb-1">Адреса</label>
        <input
          name="address"
          defaultValue={defaultValues?.address ?? ""}
          className="input w-full"
          placeholder="вул. Шевченка, 12, оф. 5"
        />
      </div>
      <div>
        <label className="block text-xs text-fg-muted mb-1">Опис</label>
        <textarea
          name="description"
          defaultValue={defaultValues?.description ?? ""}
          className="input w-full"
          rows={2}
          placeholder="Чим займаються, особливості доставки тощо"
        />
      </div>
      <div>
        <label className="block text-xs text-fg-muted mb-1">Локація комірки</label>
        <input
          name="storageLocation"
          defaultValue={defaultValues?.storageLocation ?? ""}
          className="input w-full"
          placeholder="Коробка №3, шухляда зліва, а/с 17…"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={picksUpMail}
          onChange={(e) => setPicksUpMail(e.target.checked)}
          className="h-4 w-4 accent-brand"
        />
        <span>Забирають пошту самі (не носимо)</span>
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" className="btn-primary" disabled={isPending}>
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={isPending}
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}
