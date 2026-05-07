"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePensionersXlsx } from "@/lib/pensionerImport";
import { requireAdmin, requireUser } from "@/lib/auth";
import { canEditPensioner } from "@/lib/permissions";
import { enqueueGeocodeForBuilding } from "@/lib/geocode";

function parsePensionerForm(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const buildingId = Number(formData.get("buildingId") ?? 0);
  const apartment = String(formData.get("apartment") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const passportNumber = String(formData.get("passportNumber") ?? "").trim() || null;
  const pensionPaymentDay = Number(formData.get("pensionPaymentDay") ?? 0);
  const postmanIdRaw = String(formData.get("postmanId") ?? "").trim();
  const postmanId = postmanIdRaw ? Number(postmanIdRaw) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  return {
    fullName,
    buildingId,
    apartment,
    phone,
    passportNumber,
    pensionPaymentDay,
    postmanId,
    notes,
  };
}

function validate(data: ReturnType<typeof parsePensionerForm>) {
  if (!data.fullName) return "ФІО обов'язкове";
  if (!data.buildingId) return "Оберіть будинок з дільниці";
  if (!data.pensionPaymentDay || data.pensionPaymentDay < 1 || data.pensionPaymentDay > 31)
    return "День виплати пенсії має бути 1..31";
  return null;
}

export async function createPensioner(formData: FormData) {
  const me = await requireUser();
  const data = parsePensionerForm(formData);
  const err = validate(data);
  if (err) return { error: err };

  // Не-адмін не може призначати чужого листоношу — пенсіонер автоматично йому
  if (!me.isAdmin) {
    data.postmanId = me.id;
  }

  const created = await prisma.pensioner.create({ data });
  revalidatePath("/pensioners");
  redirect(`/pensioners/${created.id}`);
}

export async function updatePensioner(id: number, formData: FormData) {
  const me = await requireUser();
  const data = parsePensionerForm(formData);
  const err = validate(data);
  if (err) return { error: err };

  const existing = await prisma.pensioner.findUnique({
    where: { id },
    select: { postmanId: true },
  });
  if (!existing) return { error: "Пенсіонера не знайдено" };
  if (!canEditPensioner(me, existing)) {
    return { error: "Недостатньо прав" };
  }

  // Не-адмін не може переназначити листоношу на іншого
  if (!me.isAdmin) {
    data.postmanId = existing.postmanId ?? me.id;
  }

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

function normalizeStreet(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/^вул\.?\s+/, "")
    .replace(/^вулиця\s+/, "")
    .replace(/^просп\.?\s+/, "")
    .replace(/^проспект\s+/, "")
    .replace(/^пров\.?\s+/, "")
    .replace(/^провулок\s+/, "")
    .replace(/^пл\.?\s+/, "")
    .replace(/^площа\s+/, "")
    .replace(/\s+/g, " ");
}

function normalizeNumber(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

export async function importPensioners(formData: FormData): Promise<ImportResult> {
  await requireAdmin();
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

  // Pre-load buildings for matching
  const buildings = await prisma.building.findMany();
  const buildingByKey = new Map<string, number>();
  for (const b of buildings) {
    buildingByKey.set(`${normalizeStreet(b.street)}::${normalizeNumber(b.number)}`, b.id);
  }

  // Pre-load existing pensioners to dedupe locally
  const existing = await prisma.pensioner.findMany({
    select: { id: true, fullName: true, buildingId: true, apartment: true },
  });
  const existingByKey = new Map<string, number>();
  for (const e of existing) {
    const key = `${normalizeKey(e.fullName)}|${e.buildingId}|${normalizeKey(e.apartment ?? "")}`;
    existingByKey.set(key, e.id);
  }

  for (const r of parsed.rows) {
    const bKey = `${normalizeStreet(r.street)}::${normalizeNumber(r.house)}`;
    let buildingId = buildingByKey.get(bKey);
    if (!buildingId) {
      // Auto-create building so we don't block import
      try {
        const b = await prisma.building.create({
          data: { street: r.street, number: r.house, notes: "Auto-created during import" },
        });
        buildingId = b.id;
        buildingByKey.set(bKey, b.id);
        enqueueGeocodeForBuilding({ id: b.id, street: r.street, number: r.house });
      } catch {
        errors.push({
          rowNumber: r.rowNumber,
          message: `Не вдалось створити будинок "${r.street}, ${r.house}"`,
        });
        continue;
      }
    }

    const dedupeKey = `${normalizeKey(r.fullName)}|${buildingId}|${normalizeKey(r.apartment ?? "")}`;
    const matchId = existingByKey.get(dedupeKey);
    try {
      if (matchId) {
        await prisma.pensioner.update({
          where: { id: matchId },
          data: {
            fullName: r.fullName,
            buildingId,
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
            buildingId,
            apartment: r.apartment,
            phone: r.phone,
            passportNumber: r.passportNumber,
            pensionPaymentDay: r.pensionPaymentDay,
            notes: r.notes,
          },
        });
        existingByKey.set(dedupeKey, newP.id);
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
  const me = await requireUser();
  const existing = await prisma.pensioner.findUnique({
    where: { id },
    select: { postmanId: true },
  });
  if (!existing) return { error: "Пенсіонера не знайдено" };
  if (!canEditPensioner(me, existing)) {
    return { error: "Недостатньо прав" };
  }
  try {
    await prisma.pensioner.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити пенсіонера: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath("/pensioners");
  redirect("/pensioners");
}
