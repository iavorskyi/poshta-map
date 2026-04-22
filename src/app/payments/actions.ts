"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createPayment(formData: FormData) {
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
  try {
    await prisma.payment.delete({ where: { id } });
  } catch {
    return { error: "Не можна видалити: виплата використовується" };
  }
  revalidatePath("/payments");
  return { ok: true };
}
