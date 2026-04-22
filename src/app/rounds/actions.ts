"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/format";

type InitialPaymentInput = {
  pensionerId: number;
  paymentId: number;
  amount: number;
};

export async function createRound(formData: FormData) {
  const dateStr = String(formData.get("date") ?? "").trim();
  const postmanIdRaw = String(formData.get("postmanId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const initialRaw = String(formData.get("initialPayments") ?? "[]");

  if (!dateStr) return { error: "Оберіть дату обходу" };
  const date = fromDateInputValue(dateStr);
  const postmanId = postmanIdRaw ? Number(postmanIdRaw) : null;

  let initial: InitialPaymentInput[] = [];
  try {
    initial = JSON.parse(initialRaw);
  } catch {
    initial = [];
  }

  const round = await prisma.round.create({
    data: {
      date,
      postmanId,
      notes,
      currentPayments: {
        create: initial.map((p) => ({
          pensionerId: p.pensionerId,
          paymentId: p.paymentId,
          amount: p.amount,
          date,
        })),
      },
    },
  });

  revalidatePath("/rounds");
  redirect(`/rounds/${round.id}`);
}

export async function deleteRound(id: number) {
  await prisma.round.delete({ where: { id } });
  revalidatePath("/rounds");
  redirect("/rounds");
}

export async function updateRoundMeta(
  id: number,
  data: { date?: string; postmanId?: number | null; notes?: string | null }
) {
  const patch: { date?: Date; postmanId?: number | null; notes?: string | null } = {};
  if (data.date) patch.date = fromDateInputValue(data.date);
  if (data.postmanId !== undefined) patch.postmanId = data.postmanId;
  if (data.notes !== undefined) patch.notes = data.notes;
  await prisma.round.update({ where: { id }, data: patch });
  revalidatePath(`/rounds/${id}`);
  revalidatePath("/rounds");
  return { ok: true };
}

export async function addCurrentPayment(
  roundId: number,
  data: { pensionerId: number; paymentId: number; amount: number; date?: string }
) {
  if (!data.pensionerId || !data.paymentId) return { error: "Оберіть пенсіонера і тип виплати" };
  if (data.amount == null || Number.isNaN(data.amount) || data.amount < 0)
    return { error: "Сума має бути невід'ємною" };

  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) return { error: "Обхід не знайдено" };

  await prisma.currentPayment.create({
    data: {
      roundId,
      pensionerId: data.pensionerId,
      paymentId: data.paymentId,
      amount: data.amount,
      date: data.date ? fromDateInputValue(data.date) : round.date,
    },
  });
  revalidatePath(`/rounds/${roundId}`);
  return { ok: true };
}

export async function updateCurrentPayment(
  id: number,
  roundId: number,
  data: { amount?: number; isPaid?: boolean }
) {
  await prisma.currentPayment.update({
    where: { id },
    data: {
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.isPaid !== undefined ? { isPaid: data.isPaid } : {}),
    },
  });
  revalidatePath(`/rounds/${roundId}`);
  return { ok: true };
}

export async function deleteCurrentPayment(id: number, roundId: number) {
  await prisma.currentPayment.delete({ where: { id } });
  revalidatePath(`/rounds/${roundId}`);
  return { ok: true };
}
