"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/format";

export async function createCurrentPayment(data: {
  pensionerId: number;
  paymentId: number;
  date: string;
  amount: number;
  isPaid?: boolean;
}) {
  if (!data.pensionerId) return { error: "Оберіть пенсіонера" };
  if (!data.paymentId) return { error: "Оберіть тип виплати" };
  if (!data.date) return { error: "Вкажіть дату" };
  if (data.amount == null || Number.isNaN(data.amount) || data.amount < 0)
    return { error: "Сума має бути невід'ємною" };

  await prisma.currentPayment.create({
    data: {
      pensionerId: data.pensionerId,
      paymentId: data.paymentId,
      date: fromDateInputValue(data.date),
      amount: data.amount,
      isPaid: data.isPaid ?? false,
    },
  });

  revalidatePath("/current-payments");
  revalidatePath(`/pensioners/${data.pensionerId}`);
  return { ok: true };
}

export async function updateCurrentPaymentFields(
  id: number,
  data: { amount?: number; isPaid?: boolean; date?: string }
) {
  const payment = await prisma.currentPayment.update({
    where: { id },
    data: {
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.isPaid !== undefined ? { isPaid: data.isPaid } : {}),
      ...(data.date ? { date: fromDateInputValue(data.date) } : {}),
    },
  });

  revalidatePath("/current-payments");
  revalidatePath(`/pensioners/${payment.pensionerId}`);
  if (payment.roundId) revalidatePath(`/rounds/${payment.roundId}`);
  return { ok: true };
}

export async function deleteCurrentPayment(id: number) {
  const payment = await prisma.currentPayment.delete({ where: { id } });
  revalidatePath("/current-payments");
  revalidatePath(`/pensioners/${payment.pensionerId}`);
  if (payment.roundId) revalidatePath(`/rounds/${payment.roundId}`);
  return { ok: true };
}
