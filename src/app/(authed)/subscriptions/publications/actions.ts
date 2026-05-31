"use server";

import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/queries";
import { assert, canManageSubscriptions } from "@/lib/permissions";

type Result = { error: string } | { ok: true };

function parseIssues(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export async function createPublication(formData: FormData): Promise<Result> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const issuesPerMonth = parseIssues(formData.get("issuesPerMonth"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name || !code) return { error: "Назва і код обов'язкові" };
  try {
    await prisma.publication.create({
      data: { name, code, issuesPerMonth, notes },
    });
    updateTag(CACHE_TAGS.publications);
    return { ok: true };
  } catch {
    return { error: "Код вже існує" };
  }
}

export async function updatePublication(
  id: number,
  formData: FormData,
): Promise<Result> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const issuesPerMonth = parseIssues(formData.get("issuesPerMonth"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name || !code) return { error: "Назва і код обов'язкові" };
  try {
    await prisma.publication.update({
      where: { id },
      data: { name, code, issuesPerMonth, notes },
    });
    updateTag(CACHE_TAGS.publications);
    return { ok: true };
  } catch {
    return { error: "Не вдалося оновити (можливо, код не унікальний)" };
  }
}

export async function deletePublication(id: number): Promise<Result> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));
  const used = await prisma.subscription.count({ where: { publicationId: id } });
  if (used > 0) {
    return {
      error: `Не можна видалити: видання використовується у ${used} підписках.`,
    };
  }
  try {
    await prisma.publication.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  updateTag(CACHE_TAGS.publications);
  return { ok: true };
}
