"use client";

import { Fragment, useState, useTransition } from "react";
import {
  clearPostmanCredentials,
  createPostman,
  deletePostman,
  setPostmanAdmin,
  setPostmanCredentials,
  updatePostmanName,
  updatePostmanPhone,
} from "./actions";
import { useToast } from "@/components/Toast";

type Postman = {
  id: number;
  name: string;
  phone: string | null;
  username: string | null;
  isAdmin: boolean;
  hasPassword: boolean;
  roundsCount: number;
};

export function PostmenClient({
  postmen,
  selfId,
}: {
  postmen: Postman[];
  selfId: number;
}) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const [credsFor, setCredsFor] = useState<number | null>(null);

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const res = await createPostman(formData);
      if (res?.error) {
        showToast(res.error, "error");
      } else {
        (document.getElementById("create-postman-form") as HTMLFormElement)?.reset();
        showToast("Листоношу додано", "success");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Видалити листоношу?")) return;
    startTransition(async () => {
      const res = await deletePostman(id);
      if (res?.error) showToast(res.error, "error");
      else showToast("Листоношу видалено", "success");
    });
  };

  const handleRename = (id: number, currentName: string) => {
    const next = prompt("Нове ПІБ", currentName);
    if (next == null) return;
    if (!next.trim()) {
      showToast("Ім'я не може бути порожнім", "error");
      return;
    }
    startTransition(async () => {
      const res = await updatePostmanName(id, next);
      if (res?.error) showToast(res.error, "error");
      else showToast("Збережено", "success");
    });
  };

  const handleEditPhone = (id: number, currentPhone: string | null) => {
    const next = prompt("Телефон листоноші (порожньо — прибрати)", currentPhone ?? "");
    if (next == null) return;
    startTransition(async () => {
      const res = await updatePostmanPhone(id, next);
      if (res?.error) showToast(res.error, "error");
      else showToast("Збережено", "success");
    });
  };

  const handleToggleAdmin = (p: Postman) => {
    if (p.id === selfId && p.isAdmin) {
      showToast("Не можна забрати в себе адмінські права", "error");
      return;
    }
    const next = !p.isAdmin;
    if (
      !confirm(
        next
          ? `Зробити "${p.name}" адміном?`
          : `Забрати в "${p.name}" адмінські права?`
      )
    )
      return;
    startTransition(async () => {
      const res = await setPostmanAdmin(p.id, next);
      if (res?.error) showToast(res.error, "error");
      else showToast("Збережено", "success");
    });
  };

  const handleClearCreds = (p: Postman) => {
    if (!confirm(`Скинути логін і пароль "${p.name}"? Він не зможе увійти.`))
      return;
    startTransition(async () => {
      const res = await clearPostmanCredentials(p.id);
      if (res?.error) showToast(res.error, "error");
      else showToast("Доступ скинуто", "success");
    });
  };

  return (
    <div className="space-y-4">
      <form
        id="create-postman-form"
        action={handleCreate}
        className="card p-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex flex-col">
          <label className="text-xs text-fg-muted">ПІБ листоноші</label>
          <input
            name="name"
            required
            className="input"
            placeholder="Іваненко І. І."
          />
        </div>
        <button type="submit" disabled={isPending} className="btn-primary">
          Додати
        </button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-fg-muted">
            <tr>
              <th className="text-left px-3 py-2">ПІБ</th>
              <th className="text-left px-3 py-2">Телефон</th>
              <th className="text-left px-3 py-2">Логін</th>
              <th className="text-left px-3 py-2">Роль</th>
              <th className="text-left px-3 py-2">Обходів</th>
              <th className="text-right px-3 py-2">Дії</th>
            </tr>
          </thead>
          <tbody>
            {postmen.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-fg-subtle">
                  Ще немає листонош
                </td>
              </tr>
            )}
            {postmen.map((p) => (
              <Fragment key={p.id}>
              <tr className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{p.name}</span>
                    {p.id === selfId && (
                      <span className="text-xs text-fg-subtle">(ви)</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {p.phone ? (
                    <span className="text-xs">{p.phone}</span>
                  ) : (
                    <span className="text-fg-subtle text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {p.username ? (
                    <span className="font-mono text-xs">{p.username}</span>
                  ) : (
                    <span className="text-fg-subtle text-xs">— немає —</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {p.isAdmin ? (
                    <span className="rounded-full bg-brand text-brand-fg px-2 py-0.5 text-xs font-medium">
                      Адмін
                    </span>
                  ) : (
                    <span className="text-fg-subtle text-xs">Листоноша</span>
                  )}
                </td>
                <td className="px-3 py-2">{p.roundsCount}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                  <button
                    onClick={() => handleRename(p.id, p.name)}
                    className="link text-xs"
                  >
                    Перейменувати
                  </button>
                  <button
                    onClick={() => handleEditPhone(p.id, p.phone)}
                    className="link text-xs"
                  >
                    Телефон
                  </button>
                  <button
                    onClick={() =>
                      setCredsFor(credsFor === p.id ? null : p.id)
                    }
                    className="link text-xs"
                  >
                    {p.hasPassword ? "Змінити пароль" : "Задати пароль"}
                  </button>
                  {p.hasPassword && (
                    <button
                      onClick={() => handleClearCreds(p)}
                      className="link text-xs"
                    >
                      Скинути доступ
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleAdmin(p)}
                    className="link text-xs"
                  >
                    {p.isAdmin ? "Зняти адміна" : "Зробити адміном"}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-danger hover:underline text-xs"
                  >
                    Видалити
                  </button>
                </td>
              </tr>
              {credsFor === p.id && (
                <tr className="border-t border-border bg-elevated/50">
                  <td colSpan={6} className="px-3 py-3">
                    <CredsForm
                      postman={p}
                      onDone={() => setCredsFor(null)}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CredsForm({
  postman,
  onDone,
}: {
  postman: Postman;
  onDone: () => void;
}) {
  const [username, setUsername] = useState(postman.username ?? "");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const submit = () => {
    if (!username.trim()) {
      showToast("Введіть логін", "error");
      return;
    }
    if (password.length < 6) {
      showToast("Пароль має бути не менше 6 символів", "error");
      return;
    }
    startTransition(async () => {
      const res = await setPostmanCredentials(postman.id, username, password);
      if (res?.error) showToast(res.error, "error");
      else {
        showToast("Доступ збережено", "success");
        onDone();
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 text-left card p-3 w-full max-w-sm">
      <label className="text-xs text-fg-muted">Логін</label>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="input"
        placeholder="ivanenko"
      />
      <label className="text-xs text-fg-muted">Пароль (мін. 6)</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="input"
        placeholder="••••••••"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onDone}
          className="btn-secondary !px-3 !py-1.5"
        >
          Скасувати
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="btn-primary !px-3 !py-1.5"
        >
          Зберегти
        </button>
      </div>
    </div>
  );
}
