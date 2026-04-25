"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePensionersXlsx } from "@/lib/pensionerImport";

function parsePensionerForm(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const house = String(formData.get("house") ?? "").trim();
  const apartment = String(formData.get("apartment") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const passportNumber = String(formData.get("passportNumber") ?? "").trim() || null;
  const pensionPaymentDay = Number(formData.get("pensionPaymentDay") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  return { fullName, street, house, apartment, phone, passportNumber, pensionPaymentDay, notes };
}

function validate(data: ReturnType<typeof parsePensionerForm>) {
  if (!data.fullName) return "ФІО обов'язкове";
  if (!data.street || !data.house) return "Вулиця і номер будинку обов'язкові";
  if (!data.pensionPaymentDay || data.pensionPaymentDay < 1 || data.pensionPaymentDay > 31)
    return "День виплати пенсії має бути 1..31";
  return null;
}

export async function createPensioner(formData: FormData) {
  const data = parsePensionerForm(formData);
  const err = validate(data);
  if (err) return { error: err };

  const created = await prisma.pensioner.create({ data });
  revalidatePath("/pensioners");
  redirect(`/pensioners/${created.id}`);
}

export async function updatePensioner(id: number, formData: FormData) {
  const data = parsePensionerForm(formData);
  const err = validate(data);
  if (err) return { error: err };

  await prisma.pensioner.update({ where: { id }, data });

  revalidatePath("/pensioners");
  revalidatePath(`/pensioners/${id}`);
  return { ok: true };
}

export type ImportResult = {
  created: number;
  updated: number;
  errors: { rowNumber: number; message: string }[];
};

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function normalizeKey(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function importPensioners(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { created: 0, updated: 0, errors: [{ rowNumber: 0, message: "Файл не надіслано" }] };
  }
  if (file.size === 0) {
    return { created: 0, updated: 0, errors: [{ rowNumber: 0, message: "Файл порожній" }] };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      created: 0,
      updated: 0,
      errors: [{ rowNumber: 0, message: "Файл більше 10 МБ" }],
    };
  }

  let parsed;
  try {
    const buffer = await file.arrayBuffer();
    parsed = await parsePensionersXlsx(buffer);
  } catch (e) {
    return {
      created: 0,
      updated: 0,
      errors: [
        {
          rowNumber: 0,
          message: `Не вдалось прочитати файл: ${e instanceof Error ? e.message : "невідома помилка"}`,
        },
      ],
    };
  }

  if (parsed.errors.length && parsed.rows.length === 0) {
    return { created: 0, updated: 0, errors: parsed.errors };
  }

  let created = 0;
  let updated = 0;
  const errors = [...parsed.errors];

  // Pre-load existing pensioners to dedupe locally
  const existing = await prisma.pensioner.findMany({
    select: { id: true, fullName: true, street: true, house: true, apartment: true },
  });
  const existingByKey = new Map<string, number>();
  for (const e of existing) {
    const key = [e.fullName, e.street, e.house, e.apartment ?? ""].map(normalizeKey).join("|");
    existingByKey.set(key, e.id);
  }

  for (const r of parsed.rows) {
    const key = [r.fullName, r.street, r.house, r.apartment ?? ""].map(normalizeKey).join("|");
    const matchId = existingByKey.get(key);
    try {
      if (matchId) {
        await prisma.pensioner.update({
          where: { id: matchId },
          data: {
            fullName: r.fullName,
            street: r.street,
            house: r.house,
            apartment: r.apartment,
            phone: r.phone,
            passportNumber: r.passportNumber,
            pensionPaymentDay: r.pensionPaymentDay,
            notes: r.notes,
          },
        });
        updated++;
      } else {
        const newP = await prisma.pensioner.create({
          data: {
            fullName: r.fullName,
            street: r.street,
            house: r.house,
            apartment: r.apartment,
            phone: r.phone,
            passportNumber: r.passportNumber,
            pensionPaymentDay: r.pensionPaymentDay,
            notes: r.notes,
          },
        });
        existingByKey.set(key, newP.id);
        created++;
      }
    } catch (e) {
      errors.push({
        rowNumber: r.rowNumber,
        message: `БД: ${e instanceof Error ? e.message : "невідома помилка"}`,
      });
    }
  }

  if (created > 0 || updated > 0) {
    revalidatePath("/pensioners");
  }

  return { created, updated, errors };
}

export async function deletePensioner(id: number) {
  try {
    await prisma.pensioner.delete({ where: { id } });
  } catch {
    return { error: "Не вдалося видалити" };
  }
  revalidatePath("/pensioners");
  redirect("/pensioners");
}
