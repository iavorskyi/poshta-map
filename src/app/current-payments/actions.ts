"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/format";
import { parseCurrentPaymentsXlsx } from "@/lib/currentPaymentImport";

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

export type CpImportResult = {
  created: number;
  errors: { rowNumber: number; message: string }[];
  warnings: { rowNumber: number; message: string }[];
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function normalizeKey(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function importCurrentPayments(formData: FormData): Promise<CpImportResult> {
  const file = formData.get("file");
  const paymentIdRaw = String(formData.get("paymentId") ?? "");
  const yearRaw = String(formData.get("year") ?? "");
  const monthRaw = String(formData.get("month") ?? ""); // 1..12

  if (!(file instanceof File)) {
    return {
      created: 0,
      warnings: [],
      errors: [{ rowNumber: 0, message: "Файл не надіслано" }],
    };
  }
  if (file.size === 0) {
    return { created: 0, warnings: [], errors: [{ rowNumber: 0, message: "Файл порожній" }] };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      created: 0,
      warnings: [],
      errors: [{ rowNumber: 0, message: "Файл більше 10 МБ" }],
    };
  }

  const paymentId = Number(paymentIdRaw);
  if (!paymentId) {
    return {
      created: 0,
      warnings: [],
      errors: [{ rowNumber: 0, message: "Оберіть тип виплати" }],
    };
  }
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return {
      created: 0,
      warnings: [],
      errors: [{ rowNumber: 0, message: "Тип виплати не знайдено" }],
    };
  }

  const now = new Date();
  const year = yearRaw ? Number(yearRaw) : now.getFullYear();
  const month = monthRaw ? Number(monthRaw) : now.getMonth() + 1;
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return {
      created: 0,
      warnings: [],
      errors: [{ rowNumber: 0, message: "Некоректний місяць/рік" }],
    };
  }
  const daysInMonth = new Date(year, month, 0).getDate();

  let parsed;
  try {
    const buffer = await file.arrayBuffer();
    parsed = await parseCurrentPaymentsXlsx(buffer);
  } catch (e) {
    return {
      created: 0,
      warnings: [],
      errors: [
        {
          rowNumber: 0,
          message: `Не вдалось прочитати файл: ${e instanceof Error ? e.message : "невідома помилка"}`,
        },
      ],
    };
  }

  if (parsed.errors.length && parsed.rows.length === 0) {
    return { created: 0, warnings: [], errors: parsed.errors };
  }

  // Pre-load pensioners for matching
  const pensioners = await prisma.pensioner.findMany({
    select: { id: true, fullName: true, street: true, house: true },
  });
  const pensIndex = new Map<string, number[]>();
  for (const p of pensioners) {
    const key = [p.fullName, p.street, p.house].map(normalizeKey).join("|");
    const list = pensIndex.get(key) ?? [];
    list.push(p.id);
    pensIndex.set(key, list);
  }

  // Pre-load existing payments in this month for this paymentId to detect dups
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const existing = await prisma.currentPayment.findMany({
    where: { paymentId, date: { gte: monthStart, lt: monthEnd } },
    select: { pensionerId: true, date: true },
  });
  const existingKey = new Set<string>();
  for (const e of existing) {
    existingKey.add(`${e.pensionerId}|${e.date.getDate()}`);
  }

  let created = 0;
  const errors = [...parsed.errors];
  const warnings: CpImportResult["warnings"] = [];
  const touchedPensionerIds = new Set<number>();

  for (const r of parsed.rows) {
    if (r.day > daysInMonth) {
      errors.push({
        rowNumber: r.rowNumber,
        message: `День ${r.day} не існує в ${month}/${year} (днів: ${daysInMonth})`,
      });
      continue;
    }
    const key = [r.fullName, r.street, r.house].map(normalizeKey).join("|");
    const matches = pensIndex.get(key);
    if (!matches || matches.length === 0) {
      errors.push({
        rowNumber: r.rowNumber,
        message: `Пенсіонера не знайдено: "${r.fullName}", ${r.street}, ${r.house}`,
      });
      continue;
    }
    if (matches.length > 1) {
      errors.push({
        rowNumber: r.rowNumber,
        message: `Знайдено кілька пенсіонерів за "${r.fullName}, ${r.street}, ${r.house}" — уточніть адресу`,
      });
      continue;
    }
    const pensionerId = matches[0];
    const dupKey = `${pensionerId}|${r.day}`;
    if (existingKey.has(dupKey)) {
      warnings.push({
        rowNumber: r.rowNumber,
        message: `Пропущено (вже існує): ${r.fullName}, ${r.day}.${String(month).padStart(2, "0")}.${year}`,
      });
      continue;
    }

    try {
      await prisma.currentPayment.create({
        data: {
          pensionerId,
          paymentId,
          date: new Date(year, month - 1, r.day),
          amount: r.amount,
          isPaid: r.isPaid,
        },
      });
      existingKey.add(dupKey);
      touchedPensionerIds.add(pensionerId);
      created++;
    } catch (e) {
      errors.push({
        rowNumber: r.rowNumber,
        message: `БД: ${e instanceof Error ? e.message : "невідома помилка"}`,
      });
    }
  }

  if (created > 0) {
    revalidatePath("/current-payments");
    for (const pid of touchedPensionerIds) {
      revalidatePath(`/pensioners/${pid}`);
    }
  }

  return { created, warnings, errors };
}

export async function deleteCurrentPayment(id: number) {
  const payment = await prisma.currentPayment.delete({ where: { id } });
  revalidatePath("/current-payments");
  revalidatePath(`/pensioners/${payment.pensionerId}`);
  if (payment.roundId) revalidatePath(`/rounds/${payment.roundId}`);
  return { ok: true };
}
