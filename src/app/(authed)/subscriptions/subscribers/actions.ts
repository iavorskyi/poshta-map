"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assert, canManageSubscriptions } from "@/lib/permissions";
import { SubscriptionDeliveryMode } from "@/generated/prisma";

type Result = { error: string } | { ok: true };
type CreateResult = { error: string } | { ok: true; id: number };

function parseDeliveryMode(raw: FormDataEntryValue | null): SubscriptionDeliveryMode {
  const s = String(raw ?? "");
  return s === "PICKUP" ? "PICKUP" : "ADDRESS";
}

function parseBuildingId(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function createSubscriber(
  formData: FormData,
): Promise<CreateResult> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) return { error: "Назва/ПІБ обов'язкові" };
  const isOrganization = formData.get("isOrganization") === "on";
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const buildingId = parseBuildingId(formData.get("buildingId"));
  const corpus = String(formData.get("corpus") ?? "").trim() || null;
  const apartment = String(formData.get("apartment") ?? "").trim() || null;
  const deliveryMode = parseDeliveryMode(formData.get("deliveryMode"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (deliveryMode === "ADDRESS" && !buildingId) {
    return { error: "Для доставки на адресу оберіть будинок" };
  }
  const sub = await prisma.subscriber.create({
    data: {
      fullName,
      isOrganization,
      phone,
      buildingId,
      corpus,
      apartment,
      deliveryMode,
      notes,
    },
    select: { id: true },
  });
  return { ok: true, id: sub.id };
}

export async function updateSubscriber(
  id: number,
  formData: FormData,
): Promise<Result> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) return { error: "Назва/ПІБ обов'язкові" };
  const isOrganization = formData.get("isOrganization") === "on";
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const buildingId = parseBuildingId(formData.get("buildingId"));
  const corpus = String(formData.get("corpus") ?? "").trim() || null;
  const apartment = String(formData.get("apartment") ?? "").trim() || null;
  const deliveryMode = parseDeliveryMode(formData.get("deliveryMode"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (deliveryMode === "ADDRESS" && !buildingId) {
    return { error: "Для доставки на адресу оберіть будинок" };
  }
  await prisma.subscriber.update({
    where: { id },
    data: {
      fullName,
      isOrganization,
      phone,
      buildingId,
      corpus,
      apartment,
      deliveryMode,
      notes,
    },
  });
  return { ok: true };
}

export async function deleteSubscriber(id: number): Promise<Result> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));
  try {
    await prisma.subscriber.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  return { ok: true };
}

export async function upsertSubscription(input: {
  subscriberId: number;
  publicationId: number;
  year: number;
  monthIndex: number;
  active: boolean;
}): Promise<Result> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));
  const { subscriberId, publicationId, year, monthIndex, active } = input;
  if (monthIndex < 0 || monthIndex > 11) return { error: "Невірний місяць" };
  const existing = await prisma.subscription.findUnique({
    where: {
      subscriberId_publicationId_year: {
        subscriberId,
        publicationId,
        year,
      },
    },
  });
  if (!existing) {
    const months = Array.from({ length: 12 }, (_, i) =>
      i === monthIndex ? active : false,
    );
    await prisma.subscription.create({
      data: {
        subscriberId,
        publicationId,
        year,
        activeMonths: months,
      },
    });
    return { ok: true };
  }
  const months = Array.from({ length: 12 }, (_, i) =>
    Boolean(existing.activeMonths[i]),
  );
  months[monthIndex] = active;
  await prisma.subscription.update({
    where: { id: existing.id },
    data: { activeMonths: months },
  });
  return { ok: true };
}

export async function deleteSubscription(id: number): Promise<Result> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));
  await prisma.subscription.delete({ where: { id } });
  return { ok: true };
}

export async function addSubscriptionRow(input: {
  subscriberId: number;
  publicationId: number;
  year: number;
}): Promise<Result> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));
  const { subscriberId, publicationId, year } = input;
  const months = Array.from({ length: 12 }, () => false);
  try {
    await prisma.subscription.create({
      data: { subscriberId, publicationId, year, activeMonths: months },
    });
    return { ok: true };
  } catch {
    return { error: "Підписка на це видання у цьому році вже існує" };
  }
}
