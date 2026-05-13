"use server";

import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/queries";

type PaymentDto = { id: number; name: string; code: string };
type CreateResult = { error: string } | { ok: true; payment: PaymentDto };
type UpdateResult = { error: string } | { ok: true; payment: PaymentDto };
type DeleteResult = { error: string } | { ok: true };

export async function createPayment(formData: FormData): Promise<CreateResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!name || !code) {
    return { error: "Назва і код обов'язкові" };
  }
  try {
    const payment = await prisma.payment.create({
      data: { name, code },
      select: { id: true, name: true, code: true },
    });
    updateTag(CACHE_TAGS.payments);
    return { ok: true, payment };
  } catch {
    return { error: "Код вже існує" };
  }
}

export async function updatePayment(
  id: number,
  formData: FormData
): Promise<UpdateResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!name || !code) return { error: "Назва і код обов'язкові" };
  try {
    const payment = await prisma.payment.update({
      where: { id },
      data: { name, code },
      select: { id: true, name: true, code: true },
    });
    updateTag(CACHE_TAGS.payments);
    return { ok: true, payment };
  } catch {
    return { error: "Не вдалося оновити (можливо, код не унікальний)" };
  }
}

export async function deletePayment(id: number): Promise<DeleteResult> {
  await requireAdmin();
  const usedCount = await prisma.currentPayment.count({ where: { paymentId: id } });
  if (usedCount > 0) {
    return {
      error: `Не можна видалити тип виплати: він використовується у ${usedCount} ${
        usedCount === 1 ? "виплаті" : usedCount < 5 ? "виплатах" : "виплатах"
      }. Спочатку видаліть або змініть ці виплати.`,
    };
  }
  try {
    await prisma.payment.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  updateTag(CACHE_TAGS.payments);
  return { ok: true };
}
