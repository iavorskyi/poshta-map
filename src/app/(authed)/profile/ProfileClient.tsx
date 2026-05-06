"use client";

import { useState, useTransition } from "react";
import { changeOwnPassword } from "../postmen/actions";
import { useToast } from "@/components/Toast";

export function ProfileClient() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const submit = () => {
    if (newPassword.length < 6) {
      showToast("Новий пароль має бути не менше 6 символів", "error");
      return;
    }
    if (newPassword !== newPassword2) {
      showToast("Паролі не співпадають", "error");
      return;
    }
    startTransition(async () => {
      const res = await changeOwnPassword(oldPassword, newPassword);
      if (res?.error) {
        showToast(res.error, "error");
        return;
      }
      showToast("Пароль змінено", "success");
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");
    });
  };

  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-medium">Змінити пароль</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-fg-muted">Поточний пароль</span>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="input"
          autoComplete="current-password"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-fg-muted">Новий пароль (мін. 6)</span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="input"
          autoComplete="new-password"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-fg-muted">Повторіть новий пароль</span>
        <input
          type="password"
          value={newPassword2}
          onChange={(e) => setNewPassword2(e.target.value)}
          className="input"
          autoComplete="new-password"
        />
      </label>
      <div>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="btn-primary"
        >
          Змінити
        </button>
      </div>
    </div>
  );
}
