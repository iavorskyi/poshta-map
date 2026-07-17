"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useGlobalPending } from "@/components/RouteProgress";
import { useToast } from "@/components/Toast";
import { OrganizationForm } from "./OrganizationForm";
import {
  createOrganization,
  deleteOrganization,
  setOrgMessageTemplateDefault,
} from "./actions";
import { MessengerButtons } from "@/components/MessengerButtons";

type Contact = { id: number; name: string; phone: string | null; note: string | null };

type Org = {
  id: number;
  name: string;
  address: string | null;
  description: string | null;
  picksUpMail: boolean;
  storageLocation: string | null;
  contacts: Contact[];
  messageText: string;
  matchedOn: "name" | "address" | "contact" | "phone";
};

export function OrganizationsClient({
  orgs,
  q,
  canManage,
  globalTemplate,
}: {
  orgs: Org[];
  q: string;
  canManage: boolean;
  globalTemplate: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const { showToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  const handleSaveTemplate = (formData: FormData) => {
    startTransition(async () => {
      const res = await setOrgMessageTemplateDefault(formData);
      if ("error" in res) showToast(res.error, "error");
      else {
        showToast("Дефолтний шаблон збережено", "success");
        setShowTemplate(false);
      }
    });
  };

  const setQuery = (value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    router.replace(`/organizations?${next.toString()}`);
  };

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const res = await createOrganization(formData);
      if ("error" in res) {
        showToast(res.error, "error");
      } else {
        showToast("Організацію додано", "success");
        setShowCreate(false);
        router.push(`/organizations/${res.id}`);
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Видалити «${name}» разом з усіма контактами?`)) return;
    startTransition(async () => {
      const res = await deleteOrganization(id);
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
          placeholder="Пошук: назва, адреса, контакт, телефон…"
          onChange={(e) => setQuery(e.target.value)}
          className="input flex-1 min-w-[220px]"
        />
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="btn-primary"
          >
            {showCreate ? "Скасувати" : "+ Організація"}
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => setShowTemplate((v) => !v)}
            className="btn-secondary"
          >
            Шаблон повідомлення
          </button>
        )}
      </div>

      {canManage && showTemplate && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveTemplate(new FormData(e.currentTarget));
          }}
          className="space-y-2 rounded-lg border border-border bg-elevated p-3"
        >
          <label className="block text-sm font-medium">
            Дефолтний шаблон для нових організацій
          </label>
          <textarea
            name="value"
            defaultValue={globalTemplate}
            className="input w-full"
            rows={3}
          />
          <p className="text-xs text-fg-subtle">
            {"{організація}"} підставиться назвою організації. Застосовується до
            нових організацій; наявні мають власний шаблон.
          </p>
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary" disabled={isPending}>
              Зберегти
            </button>
            <button
              type="button"
              onClick={() => setShowTemplate(false)}
              className="btn-secondary"
              disabled={isPending}
            >
              Скасувати
            </button>
          </div>
        </form>
      )}

      {canManage && showCreate && (
        <OrganizationForm
          defaultValues={{ messageTemplate: globalTemplate }}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          submitLabel="Додати"
          isPending={isPending}
        />
      )}

      {orgs.length > 0 && (
        <ul className="space-y-2">
          {orgs.map((o) => (
            <li
              key={o.id}
              className="rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/organizations/${o.id}`}
                      className="text-link hover:text-link-hover hover:underline font-medium"
                    >
                      {o.name}
                    </Link>
                    {o.picksUpMail ? (
                      <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-fg-muted">
                        Самовивіз
                      </span>
                    ) : (
                      <span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs">
                        Носимо пошту
                      </span>
                    )}
                    {q && o.matchedOn !== "name" && (
                      <span className="text-xs text-fg-subtle">
                        збіг: {
                          o.matchedOn === "address"
                            ? "адреса/опис"
                            : o.matchedOn === "phone"
                              ? "телефон контакту"
                              : "контакт"
                        }
                      </span>
                    )}
                  </div>
                  {o.address && (
                    <div className="text-sm text-fg-muted mt-0.5">
                      {o.address}
                    </div>
                  )}
                  {o.storageLocation && (
                    <div className="text-xs mt-0.5">
                      <span className="text-fg-subtle">Комірка:</span>{" "}
                      <span className="font-medium">{o.storageLocation}</span>
                    </div>
                  )}
                  {o.description && (
                    <div className="text-xs text-fg-subtle mt-0.5 line-clamp-2">
                      {o.description}
                    </div>
                  )}
                  {o.contacts.length > 0 && (
                    <ul className="mt-2 text-xs text-fg-muted flex flex-wrap gap-x-3 gap-y-1">
                      {o.contacts.slice(0, 4).map((c) => (
                        <li key={c.id}>
                          <strong className="text-fg">{c.name}</strong>
                          {c.phone && (
                            <>
                              <a
                                href={`tel:${c.phone}`}
                                className="ml-1 link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {c.phone}
                              </a>
                              <MessengerButtons
                                phone={c.phone}
                                variant="compact"
                                stopPropagation
                                copyText={o.messageText}
                              />
                            </>
                          )}
                        </li>
                      ))}
                      {o.contacts.length > 4 && (
                        <li className="text-fg-subtle">
                          +{o.contacts.length - 4} ще
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                {canManage && (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Link
                      href={`/organizations/${o.id}`}
                      className="link text-xs"
                    >
                      Деталі →
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(o.id, o.name)}
                      className="text-danger hover:underline text-xs"
                    >
                      Видалити
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
