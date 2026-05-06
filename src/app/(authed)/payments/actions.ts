"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function createPayment(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!name || !code) {
    return { error: "Назва і код обов'язкові" };
  }
  try {
    await prisma.payment.create({ data: { name, code } });
  } catch {
    return { error: "Код вже існує" };
  }
  revalidatePath("/payments");
  return { ok: true };
}

export async function updatePayment(id: number, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!name || !code) return { error: "Назва і код обов'язкові" };
  try {
    await prisma.payment.update({ where: { id }, data: { name, code } });
  } catch {
    return { error: "Не вдалося оновити (можливо, код не унікальний)" };
  }
  revalidatePath("/payments");
  return { ok: true };
}

export async function deletePayment(id: number) {
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
  revalidatePath("/payments");
  return { ok: true };
}
