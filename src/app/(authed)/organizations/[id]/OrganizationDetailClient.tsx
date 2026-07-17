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
  linkOrganization,
  unlinkOrganization,
  updateContact,
  updateOrganization,
  updateRelationNote,
} from "../actions";
import { searchOrganizations } from "@/lib/orgSearch";
import { MessengerButtons } from "@/components/MessengerButtons";

type Contact = { id: number; name: string; phone: string | null; note: string | null };

type Org = {
  id: number;
  name: string;
  address: string | null;
  description: string | null;
  picksUpMail: boolean;
  storageLocation: string | null;
  messageTemplate: string | null;
  messageText: string;
  contacts: Contact[];
};

type RelatedOrg = {
  id: number;
  name: string;
  address: string | null;
  picksUpMail: boolean;
  messageText: string;
  contacts: { id: number; name: string; phone: string | null }[];
};

type Relation = {
  relationId: number;
  note: string | null;
  other: RelatedOrg;
};

type Candidate = {
  id: number;
  name: string;
  address: string | null;
  description: string | null;
  storageLocation: string | null;
  contacts: { name: string; phone: string | null; note: string | null }[];
};

export function OrganizationDetailClient({
  org,
  relations,
  candidates,
  canManage,
}: {
  org: Org;
  relations: Relation[];
  candidates: Candidate[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editContactId, setEditContactId] = useState<number | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [editRelationId, setEditRelationId] = useState<number | null>(null);

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

  const handleLink = (otherId: number) => {
    startTransition(async () => {
      const res = await linkOrganization(org.id, otherId);
      if ("error" in res) showToast(res.error, "error");
      else {
        showToast("Звʼязано", "success");
        setLinkQuery("");
      }
    });
  };

  const handleUnlink = (relationId: number, otherName: string) => {
    if (!confirm(`Прибрати звʼязок з «${otherName}»?`)) return;
    startTransition(async () => {
      const res = await unlinkOrganization(relationId);
      if ("error" in res) showToast(res.error, "error");
      else showToast("Звʼязок прибрано", "success");
    });
  };

  const handleUpdateRelationNote = (relationId: number, note: string) => {
    const fd = new FormData();
    fd.set("note", note);
    startTransition(async () => {
      const res = await updateRelationNote(relationId, fd.get("note"));
      if ("error" in res) showToast(res.error, "error");
      else {
        showToast("Збережено", "success");
        setEditRelationId(null);
      }
    });
  };

  // Кандидати фільтруються тим самим fuzzy-пошуком, що й список організацій,
  // тож «адміністарція» знайде «адміністрація».
  const filteredCandidates = searchOrganizations(candidates, linkQuery).slice(0, 8);

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
            storageLocation: org.storageLocation,
            messageTemplate: org.messageTemplate,
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
          {org.storageLocation && (
            <div className="text-sm">
              <span className="text-fg-subtle">Локація комірки:</span>{" "}
              <span className="font-medium">{org.storageLocation}</span>
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
                        <MessengerButtons
                          phone={c.phone}
                          variant="card"
                          copyText={org.messageText}
                        />
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

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Повʼязані організації</h2>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowLink((v) => !v)}
              className="btn-primary"
            >
              {showLink ? "Скасувати" : "+ Звʼязати"}
            </button>
          )}
        </div>

        {canManage && showLink && (
          <div className="rounded-lg border border-border bg-elevated p-3 space-y-2">
            <input
              type="search"
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="Пошук організації: назва, адреса, контакт, телефон…"
              className="input w-full"
              autoFocus
            />
            {candidates.length === 0 ? (
              <div className="text-xs text-fg-subtle">
                Більше немає організацій для звʼязку.
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="text-xs text-fg-subtle">Нічого не знайдено.</div>
            ) : (
              <ul className="space-y-1">
                {filteredCandidates.map((hit) => (
                  <li
                    key={hit.org.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{hit.org.name}</div>
                      {hit.org.address && (
                        <div className="text-xs text-fg-subtle truncate">
                          {hit.org.address}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLink(hit.org.id)}
                      className="btn-secondary shrink-0"
                      disabled={isPending}
                    >
                      Звʼязати
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {relations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-fg-subtle text-sm">
            Звʼязків ще немає. Додайте, щоб мати запасні контакти, коли
            недоступна основна організація.
          </div>
        ) : (
          <ul className="space-y-2">
            {relations.map((r) => (
              <li
                key={r.relationId}
                className="rounded-lg border border-border bg-surface p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/organizations/${r.other.id}`}
                        className="text-link hover:text-link-hover hover:underline font-medium"
                      >
                        {r.other.name}
                      </Link>
                      {r.other.picksUpMail ? (
                        <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-fg-muted">
                          Самовивіз
                        </span>
                      ) : (
                        <span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs">
                          Носимо пошту
                        </span>
                      )}
                    </div>
                    {r.other.address && (
                      <div className="text-xs text-fg-muted mt-0.5">
                        {r.other.address}
                      </div>
                    )}
                    {r.other.contacts.length > 0 && (
                      <ul className="mt-1 text-xs text-fg-muted flex flex-wrap gap-x-3 gap-y-1">
                        {r.other.contacts.slice(0, 4).map((c) => (
                          <li key={c.id}>
                            <strong className="text-fg">{c.name}</strong>
                            {c.phone && (
                              <>
                                <a href={`tel:${c.phone}`} className="ml-1 link">
                                  {c.phone}
                                </a>
                                <MessengerButtons
                                  phone={c.phone}
                                  variant="compact"
                                  copyText={r.other.messageText}
                                />
                              </>
                            )}
                          </li>
                        ))}
                        {r.other.contacts.length > 4 && (
                          <li className="text-fg-subtle">
                            +{r.other.contacts.length - 4} ще
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditRelationId(
                            editRelationId === r.relationId ? null : r.relationId
                          )
                        }
                        className="link text-xs"
                      >
                        {editRelationId === r.relationId
                          ? "Скасувати"
                          : r.note
                            ? "Примітка"
                            : "+ Примітка"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnlink(r.relationId, r.other.name)}
                        className="text-danger hover:underline text-xs"
                      >
                        Прибрати
                      </button>
                    </div>
                  )}
                </div>
                {editRelationId === r.relationId && canManage ? (
                  <RelationNoteForm
                    defaultValue={r.note}
                    onSubmit={(note) =>
                      handleUpdateRelationNote(r.relationId, note)
                    }
                    onCancel={() => setEditRelationId(null)}
                    isPending={isPending}
                  />
                ) : (
                  r.note && (
                    <div className="text-xs text-fg-subtle whitespace-pre-wrap border-t border-border pt-2">
                      {r.note}
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RelationNoteForm({
  defaultValue,
  onSubmit,
  onCancel,
  isPending,
}: {
  defaultValue: string | null;
  onSubmit: (note: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      className="space-y-2 border-t border-border pt-2"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input w-full"
        rows={2}
        placeholder="Чим звʼязані: спільний керівник, філія, тощо"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary" disabled={isPending}>
          Зберегти
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
