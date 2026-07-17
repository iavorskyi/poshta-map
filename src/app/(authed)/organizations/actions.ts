"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assert, canManageOrganizations } from "@/lib/permissions";
import { DEFAULT_ORG_MESSAGE_TEMPLATE } from "@/lib/messengerLinks";

type Result = { error: string } | { ok: true };
type CreateResult = { error: string } | { ok: true; id: number };

const MSG_TEMPLATE_KEY = "orgMessageTemplateDefault";

function strOrNull(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? "").trim();
  return s || null;
}

// Глобальний дефолтний шаблон повідомлення для нових організацій.
// Зберігається в AppSetting; якщо ще не задано — хардкод-фолбек.
export async function getOrgMessageTemplateDefault(): Promise<string> {
  const row = await prisma.appSetting.findUnique({
    where: { key: MSG_TEMPLATE_KEY },
  });
  return row?.value ?? DEFAULT_ORG_MESSAGE_TEMPLATE;
}

export async function setOrgMessageTemplateDefault(
  formData: FormData
): Promise<Result> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  const value = String(formData.get("value") ?? "").trim();
  if (!value) return { error: "Шаблон не може бути порожнім" };
  await prisma.appSetting.upsert({
    where: { key: MSG_TEMPLATE_KEY },
    create: { key: MSG_TEMPLATE_KEY, value },
    update: { value },
  });
  revalidatePath("/organizations");
  return { ok: true };
}

export async function createOrganization(formData: FormData): Promise<CreateResult> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Назва обов'язкова" };
  const address = strOrNull(formData.get("address"));
  const description = strOrNull(formData.get("description"));
  const storageLocation = strOrNull(formData.get("storageLocation"));
  const picksUpMail = formData.get("picksUpMail") === "on";
  // Snapshot глобального дефолту в момент створення; якщо адмін ввів свій —
  // беремо його.
  const messageTemplate =
    strOrNull(formData.get("messageTemplate")) ??
    (await getOrgMessageTemplateDefault());

  const org = await prisma.organization.create({
    data: {
      name,
      address,
      description,
      picksUpMail,
      storageLocation,
      messageTemplate,
    },
    select: { id: true },
  });
  revalidatePath("/organizations");
  return { ok: true, id: org.id };
}

export async function updateOrganization(
  id: number,
  formData: FormData
): Promise<Result> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Назва обов'язкова" };
  const address = strOrNull(formData.get("address"));
  const description = strOrNull(formData.get("description"));
  const storageLocation = strOrNull(formData.get("storageLocation"));
  const picksUpMail = formData.get("picksUpMail") === "on";
  const messageTemplate = strOrNull(formData.get("messageTemplate"));

  await prisma.organization.update({
    where: { id },
    data: {
      name,
      address,
      description,
      picksUpMail,
      storageLocation,
      messageTemplate,
    },
  });
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${id}`);
  return { ok: true };
}

export async function deleteOrganization(id: number): Promise<Result> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  try {
    await prisma.organization.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath("/organizations");
  return { ok: true };
}

export async function addContact(
  organizationId: number,
  formData: FormData
): Promise<Result> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Імʼя контакту обовʼязкове" };
  const phone = strOrNull(formData.get("phone"));
  const note = strOrNull(formData.get("note"));
  await prisma.organizationContact.create({
    data: { organizationId, name, phone, note },
  });
  revalidatePath(`/organizations/${organizationId}`);
  revalidatePath("/organizations");
  return { ok: true };
}

export async function updateContact(
  id: number,
  formData: FormData
): Promise<Result> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Імʼя контакту обовʼязкове" };
  const phone = strOrNull(formData.get("phone"));
  const note = strOrNull(formData.get("note"));
  const c = await prisma.organizationContact.update({
    where: { id },
    data: { name, phone, note },
    select: { organizationId: true },
  });
  revalidatePath(`/organizations/${c.organizationId}`);
  revalidatePath("/organizations");
  return { ok: true };
}

export async function deleteContact(id: number): Promise<Result> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  const c = await prisma.organizationContact.delete({
    where: { id },
    select: { organizationId: true },
  });
  revalidatePath(`/organizations/${c.organizationId}`);
  revalidatePath("/organizations");
  return { ok: true };
}

// Звʼязки організацій. Інваріант: у БД зберігаємо пару впорядковано
// (aId < bId), щоб не дублювати симетричні рядки і unique-ключ працював
// в обидва боки.
function orderedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

export async function linkOrganization(
  fromId: number,
  toId: number,
  noteRaw?: FormDataEntryValue | null
): Promise<Result> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  if (fromId === toId) return { error: "Не можна звʼязати організацію саму з собою" };
  const [aId, bId] = orderedPair(fromId, toId);
  const note = strOrNull(noteRaw ?? null);
  try {
    await prisma.organizationRelation.upsert({
      where: { aId_bId: { aId, bId } },
      create: { aId, bId, note },
      update: note ? { note } : {},
    });
  } catch (e) {
    return {
      error: `Не вдалося звʼязати: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath(`/organizations/${fromId}`);
  revalidatePath(`/organizations/${toId}`);
  return { ok: true };
}

export async function unlinkOrganization(relationId: number): Promise<Result> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  const rel = await prisma.organizationRelation.delete({
    where: { id: relationId },
    select: { aId: true, bId: true },
  });
  revalidatePath(`/organizations/${rel.aId}`);
  revalidatePath(`/organizations/${rel.bId}`);
  return { ok: true };
}

export async function updateRelationNote(
  relationId: number,
  noteRaw: FormDataEntryValue | null
): Promise<Result> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  const note = strOrNull(noteRaw);
  const rel = await prisma.organizationRelation.update({
    where: { id: relationId },
    data: { note },
    select: { aId: true, bId: true },
  });
  revalidatePath(`/organizations/${rel.aId}`);
  revalidatePath(`/organizations/${rel.bId}`);
  return { ok: true };
}
