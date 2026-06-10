"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assert, canManageOrganizations } from "@/lib/permissions";

type Result = { error: string } | { ok: true };
type CreateResult = { error: string } | { ok: true; id: number };

function strOrNull(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? "").trim();
  return s || null;
}

export async function createOrganization(formData: FormData): Promise<CreateResult> {
  const me = await requireUser();
  assert(canManageOrganizations(me));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Назва обов'язкова" };
  const address = strOrNull(formData.get("address"));
  const description = strOrNull(formData.get("description"));
  const picksUpMail = formData.get("picksUpMail") === "on";

  const org = await prisma.organization.create({
    data: { name, address, description, picksUpMail },
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
  const picksUpMail = formData.get("picksUpMail") === "on";

  await prisma.organization.update({
    where: { id },
    data: { name, address, description, picksUpMail },
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
