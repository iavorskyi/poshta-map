"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function parseAptRange(input: string): { from: number | null; to: number | null } | null {
  const s = input.trim();
  if (!s) return { from: null, to: null };
  // Accept "1-8", "1—8", "1 - 8", "5"
  const m = s.match(/^(\d+)\s*[-—–]\s*(\d+)$/);
  if (m) {
    const from = Number(m[1]);
    const to = Number(m[2]);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    if (to < from) return null;
    return { from, to };
  }
  const single = s.match(/^(\d+)$/);
  if (single) {
    const n = Number(single[1]);
    return { from: n, to: n };
  }
  return null;
}

export async function createBuilding(formData: FormData) {
  const street = String(formData.get("street") ?? "").trim();
  const number = String(formData.get("number") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!street) return { error: "Вкажіть вулицю" };
  if (!number) return { error: "Вкажіть номер будинку" };
  try {
    const created = await prisma.building.create({
      data: { street, number, notes },
    });
    revalidatePath("/district");
    return { ok: true, id: created.id };
  } catch {
    return { error: "Такий будинок вже існує" };
  }
}

export async function updateBuilding(
  id: number,
  data: { street?: string; number?: string; notes?: string | null }
) {
  const street = data.street?.trim();
  const number = data.number?.trim();
  if (street !== undefined && !street) return { error: "Вкажіть вулицю" };
  if (number !== undefined && !number) return { error: "Вкажіть номер будинку" };
  try {
    await prisma.building.update({
      where: { id },
      data: {
        ...(street !== undefined ? { street } : {}),
        ...(number !== undefined ? { number } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      },
    });
  } catch {
    return { error: "Не вдалося зберегти" };
  }
  revalidatePath("/district");
  revalidatePath(`/district/${id}`);
  return { ok: true };
}

export async function deleteBuilding(id: number) {
  const pensionersCount = await prisma.pensioner.count({ where: { buildingId: id } });
  if (pensionersCount > 0) {
    return {
      error: `Не можна видалити будинок: до нього прив'язано ${pensionersCount} ${
        pensionersCount === 1 ? "пенсіонер" : pensionersCount < 5 ? "пенсіонери" : "пенсіонерів"
      }. Спочатку перепрівяжіть або видаліть пенсіонерів.`,
    };
  }
  try {
    await prisma.building.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити будинок: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath("/district");
  return { ok: true };
}

export async function addEntrance(
  buildingId: number,
  input: { number: number; aptRange?: string; notes?: string | null }
) {
  if (!Number.isFinite(input.number) || input.number <= 0) {
    return { error: "Номер парадного має бути додатнім числом" };
  }
  const range = parseAptRange(input.aptRange ?? "");
  if (range === null) {
    return { error: "Невірний діапазон квартир (наприклад 1-8)" };
  }
  try {
    await prisma.entrance.create({
      data: {
        buildingId,
        number: input.number,
        aptFrom: range.from,
        aptTo: range.to,
        notes: input.notes?.trim() || null,
      },
    });
  } catch {
    return { error: "Парадне з таким номером вже існує" };
  }
  revalidatePath(`/district/${buildingId}`);
  return { ok: true };
}

export async function updateEntrance(
  id: number,
  buildingId: number,
  input: { number?: number; aptRange?: string; notes?: string | null }
) {
  const data: {
    number?: number;
    aptFrom?: number | null;
    aptTo?: number | null;
    notes?: string | null;
  } = {};
  if (input.number !== undefined) {
    if (!Number.isFinite(input.number) || input.number <= 0) {
      return { error: "Номер парадного має бути додатнім числом" };
    }
    data.number = input.number;
  }
  if (input.aptRange !== undefined) {
    const range = parseAptRange(input.aptRange);
    if (range === null) {
      return { error: "Невірний діапазон квартир (наприклад 1-8)" };
    }
    data.aptFrom = range.from;
    data.aptTo = range.to;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes?.trim() || null;
  }
  try {
    await prisma.entrance.update({ where: { id }, data });
  } catch {
    return { error: "Не вдалося зберегти" };
  }
  revalidatePath(`/district/${buildingId}`);
  return { ok: true };
}

export async function deleteEntrance(id: number, buildingId: number) {
  try {
    await prisma.entrance.delete({ where: { id } });
  } catch {
    return { error: "Не вдалося видалити" };
  }
  revalidatePath(`/district/${buildingId}`);
  return { ok: true };
}
