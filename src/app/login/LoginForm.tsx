"use client";

import { useState, useTransition } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await login(formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
      }
    });
  };

  return (
    <form action={onSubmit} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-fg-muted">Логін</span>
        <input
          name="username"
          autoComplete="username"
          className="input"
          required
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-fg-muted">Пароль</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="input"
          required
        />
      </label>
      {error && <div className="text-sm text-danger">{error}</div>}
      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full"
      >
        {isPending ? "Вхід…" : "Увійти"}
      </button>
    </form>
  );
}
