"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGlobalPending } from "@/components/RouteProgress";
import { useToast } from "@/components/Toast";
import { OrganizationForm } from "../OrganizationForm";
import {
  addContact,
  deleteContact,
  deleteOrganization,
  updateContact,
  updateOrganization,
} from "../actions";

type Contact = { id: number; name: string; phone: string | null; note: string | null };

type Org = {
  id: number;
  name: string;
  address: string | null;
  description: string | null;
  picksUpMail: boolean;
  contacts: Contact[];
};

export function OrganizationDetailClient({
  org,
  canManage,
}: {
  org: Org;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editContactId, setEditContactId] = useState<number | null>(null);

  const handleUpdate = (fd: FormData) => {
    startTransition(async () => {
      const res = await updateOrganization(org.id, fd);
      if ("error" in res) showToast(res.error, "error");
      else {
        showToast("Збережено", "success");
        setEditing(false);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Видалити «${org.name}» разом з усіма контактами?`)) return;
    startTransition(async () => {
      const res = await deleteOrganization(org.id);
      if ("error" in res) showToast(res.error, "error");
      else {
        showToast("Видалено", "success");
        router.push("/organizations");
      }
    });
  };

  const handleAddContact = (fd: FormData) => {
    startTransition(async () => {
      const res = await addContact(org.id, fd);
      if ("error" in res) showToast(res.error, "error");
      else {
        showToast("Контакт додано", "success");
        setShowAddContact(false);
      }
    });
  };

  const handleUpdateContact = (id: number, fd: FormData) => {
    startTransition(async () => {
      const res = await updateContact(id, fd);
      if ("error" in res) showToast(res.error, "error");
      else {
        showToast("Збережено", "success");
        setEditContactId(null);
      }
    });
  };

  const handleDeleteContact = (id: number, name: string) => {
    if (!confirm(`Видалити контакт «${name}»?`)) return;
    startTransition(async () => {
      const res = await deleteContact(id);
      if ("error" in res) showToast(res.error, "error");
      else showToast("Контакт видалено", "success");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/organizations" className="link text-sm">
            ← Усі організації
          </Link>
        </div>
        {canManage && !editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-secondary"
            >
              Редагувати
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="text-danger hover:underline text-sm"
              disabled={isPending}
            >
              Видалити
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <OrganizationForm
          defaultValues={{
            name: org.name,
            address: org.address,
            description: org.description,
            picksUpMail: org.picksUpMail,
          }}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
          submitLabel="Зберегти"
          isPending={isPending}
        />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">{org.name}</h1>
            {org.picksUpMail ? (
              <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-fg-muted">
                Самовивіз
              </span>
            ) : (
              <span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs">
                Носимо пошту
              </span>
            )}
          </div>
          {org.address && (
            <div className="text-sm text-fg-muted">
              <span className="text-fg-subtle">Адреса:</span> {org.address}
            </div>
          )}
          {org.description && (
            <div className="text-sm whitespace-pre-wrap">{org.description}</div>
          )}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Контакти</h2>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowAddContact((v) => !v)}
              className="btn-primary"
            >
              {showAddContact ? "Скасувати" : "+ Контакт"}
            </button>
          )}
        </div>

        {canManage && showAddContact && (
          <ContactForm
            onSubmit={handleAddContact}
            onCancel={() => setShowAddContact(false)}
            submitLabel="Додати"
            isPending={isPending}
          />
        )}

        {org.contacts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-fg-subtle text-sm">
            Контактів ще немає.
          </div>
        ) : (
          <ul className="space-y-2">
            {org.contacts.map((c) =>
              editContactId === c.id ? (
                <li
                  key={c.id}
                  className="rounded-lg border border-border bg-elevated p-3"
                >
                  <ContactForm
                    defaultValues={c}
                    onSubmit={(fd) => handleUpdateContact(c.id, fd)}
                    onCancel={() => setEditContactId(null)}
                    submitLabel="Зберегти"
                    isPending={isPending}
                  />
                </li>
              ) : (
                <li
                  key={c.id}
                  className="rounded-lg border border-border bg-surface p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.name}</div>
                    {c.phone && (
                      <div className="text-sm">
                        <a href={`tel:${c.phone}`} className="link">
                          {c.phone}
                        </a>
                      </div>
                    )}
                    {c.note && (
                      <div className="text-xs text-fg-subtle mt-0.5 whitespace-pre-wrap">
                        {c.note}
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditContactId(c.id)}
                        className="link text-xs"
                      >
                        Редагувати
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(c.id, c.name)}
                        className="text-danger hover:underline text-xs"
                      >
                        Видалити
                      </button>
                    </div>
                  )}
                </li>
              )
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

function ContactForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: {
  defaultValues?: Partial<Contact>;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-2 rounded-lg border border-border bg-elevated p-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-fg-muted mb-1">Імʼя *</label>
          <input
            name="name"
            required
            defaultValue={defaultValues?.name ?? ""}
            className="input w-full"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">Телефон</label>
          <input
            name="phone"
            type="tel"
            defaultValue={defaultValues?.phone ?? ""}
            className="input w-full"
            placeholder="+380…"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-fg-muted mb-1">Примітка</label>
        <textarea
          name="note"
          defaultValue={defaultValues?.note ?? ""}
          className="input w-full"
          rows={2}
          placeholder="Посада, графік, особливості"
        />
      </div>
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
