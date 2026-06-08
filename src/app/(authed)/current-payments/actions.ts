"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/format";
import { parseCurrentPaymentsXlsx } from "@/lib/currentPaymentImport";
import { requireAdmin, requireUser } from "@/lib/auth";
import { canEditCurrentPayment, canEditPensioner } from "@/lib/permissions";
import { findBuildingByAddress } from "@/lib/streetMatch";
import {
  findPensionerInBuilding,
  findClosestPensionersByName,
  type NameMatchCandidate,
} from "@/lib/nameMatch";

// Скільки топ-кандидатів по ФІО показуємо в UI, коли пенсіонера не знайдено
// в очікуваному будинку або коли будинок не зрезолвлено.
const NAME_SUGGESTION_LIMIT = 3;

export type CpNameSuggestion = {
  id: number;
  fullName: string;
  distance: number;
  street: string;
  number: string;
  apartment: string | null;
};

// Нормалізація номера квартири для порівняння: викидаємо пробіли, lowercase.
// Дозволяє матчити "12А" з "12а" і "12 А". Розділювачі типу "/" та "-"
// зберігаємо — "12/1" і "12-1" це різні квартири.
function normalizeApartment(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).toLowerCase().replace(/\s+/g, "").trim();
}

export async function createCurrentPayment(data: {
  pensionerId: number;
  paymentId: number;
  date: string;
  amount: number;
  isPaid?: boolean;
}) {
  const me = await requireUser();
  if (!data.pensionerId) return { error: "Оберіть пенсіонера" };
  if (!data.paymentId) return { error: "Оберіть тип виплати" };
  if (!data.date) return { error: "Вкажіть дату" };
  if (data.amount == null || Number.isNaN(data.amount) || data.amount < 0)
    return { error: "Сума має бути невід'ємною" };

  const pensioner = await prisma.pensioner.findUnique({
    where: { id: data.pensionerId },
    select: { postmanId: true },
  });
  if (!pensioner) return { error: "Пенсіонера не знайдено" };
  if (!canEditPensioner(me, pensioner)) {
    return { error: "Можна додавати виплати лише своїм пенсіонерам" };
  }

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
  const me = await requireUser();
  const existing = await prisma.currentPayment.findUnique({
    where: { id },
    select: {
      roundId: true,
      round: { select: { postmanId: true } },
      pensioner: { select: { postmanId: true } },
    },
  });
  if (!existing) return { error: "Виплату не знайдено" };
  if (!canEditCurrentPayment(me, existing)) {
    return { error: "Недостатньо прав" };
  }

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

// Двокроковий імпорт: preview + apply.
//
// Раніше імпорт «тихо» створював нового пенсіонера, якщо точний матч за
// ФІО+будинком не знайдено. На практиці Excel-файли містять одруківки
// («Петренкo» з латинською o), і це призводило до дублів. Тепер сервер
// повертає preview зі статусом кожного рядка та fuzzy-кандидатами в межах
// будинку; користувач у UI вирішує, до кого прив'язати виплату або
// створити нового; apply записує підтверджені рішення.

export type CpPreviewBuildingError =
  | { kind: "ambiguous"; candidates: { id: number; street: string; number: string }[] }
  | { kind: "none" }
  | { kind: "row_invalid"; message: string };

export type CpPreviewPensionerStatus =
  | { kind: "exact"; id: number; fullName: string }
  | { kind: "fuzzy"; candidates: NameMatchCandidate[] }
  | { kind: "ambiguous"; candidates: NameMatchCandidate[] }
  | { kind: "none" };

export type CpPreviewRow = {
  rowNumber: number;
  fullName: string;
  street: string;
  house: string;
  apartment: string | null;
  day: number;
  amount: number;
  isPaid: boolean;
  // Якщо building не вдалось резолвити, pensioner-резолв не виконуємо.
  building:
    | { kind: "ok"; id: number; street: string; number: string; matchedStreet?: string }
    | { kind: "error"; error: CpPreviewBuildingError };
  pensioner: CpPreviewPensionerStatus | null;
  // Всі пенсіонери знайденого будинку — для ручного вибору в UI.
  // Залишається порожнім для рядків з building-error.
  buildingOptions: { id: number; fullName: string; apartment: string | null }[];
  // Топ-N найближчих ФІО серед УСІХ пенсіонерів дільниці. Заповнюємо для
  // рядків, де пенсіонера в очікуваному будинку не знайдено
  // (`pensioner.kind === "none"`), або де сам будинок не зрезолвлено
  // (building.kind === "error"). UI пропонує ці варіанти як можливі «справжні»
  // отримувачі, коли у файлі помилка адреси.
  nameSuggestions: CpNameSuggestion[];
  // Бейдж: у цьому місяці для розпізнаного пенсіонера вже є виплата на цей день.
  dupInMonth: boolean;
};

export type CpPreview = {
  paymentId: number;
  paymentName: string;
  paymentCode: string;
  year: number;
  month: number;
  rows: CpPreviewRow[];
  parseErrors: { rowNumber: number; message: string }[];
};

export type CpPreviewResponse =
  | { ok: true; preview: CpPreview }
  | { ok: false; error: string; parseErrors?: { rowNumber: number; message: string }[] };

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function previewCurrentPaymentsImport(
  formData: FormData
): Promise<CpPreviewResponse> {
  await requireAdmin();
  const file = formData.get("file");
  const paymentIdRaw = String(formData.get("paymentId") ?? "");
  const yearRaw = String(formData.get("year") ?? "");
  const monthRaw = String(formData.get("month") ?? "");

  if (!(file instanceof File)) return { ok: false, error: "Файл не надіслано" };
  if (file.size === 0) return { ok: false, error: "Файл порожній" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Файл більше 10 МБ" };

  const paymentId = Number(paymentIdRaw);
  if (!paymentId) return { ok: false, error: "Оберіть тип виплати" };
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { ok: false, error: "Тип виплати не знайдено" };

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
    return { ok: false, error: "Некоректний місяць/рік" };
  }
  const daysInMonth = new Date(year, month, 0).getDate();

  let parsed;
  try {
    const buffer = await file.arrayBuffer();
    parsed = await parseCurrentPaymentsXlsx(buffer);
  } catch (e) {
    return {
      ok: false,
      error: `Не вдалось прочитати файл: ${e instanceof Error ? e.message : "невідома помилка"}`,
    };
  }

  if (parsed.errors.length && parsed.rows.length === 0) {
    return { ok: false, error: "Файл містить лише помилки", parseErrors: parsed.errors };
  }

  const buildings = await prisma.building.findMany({
    select: { id: true, street: true, number: true },
  });
  const pensioners = await prisma.pensioner.findMany({
    select: { id: true, fullName: true, buildingId: true, apartment: true },
  });
  const pensionersByBuilding = new Map<
    number,
    { id: number; fullName: string; apartment: string | null }[]
  >();
  for (const p of pensioners) {
    const list = pensionersByBuilding.get(p.buildingId) ?? [];
    list.push({ id: p.id, fullName: p.fullName, apartment: p.apartment });
    pensionersByBuilding.set(p.buildingId, list);
  }
  // Плоский список для broad name-search (для випадку "пенсіонера в цьому
  // будинку не знайдено" — підкажемо найближчі ФІО з інших будинків).
  const allPensionersForBroadMatch = pensioners.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    buildingId: p.buildingId,
  }));
  const apartmentById = new Map<number, string | null>();
  for (const p of pensioners) apartmentById.set(p.id, p.apartment);
  const buildingById = new Map<number, { street: string; number: string }>();
  for (const b of buildings) {
    buildingById.set(b.id, { street: b.street, number: b.number });
  }
  const toNameSuggestions = (fullName: string): CpNameSuggestion[] => {
    const top = findClosestPensionersByName(
      allPensionersForBroadMatch,
      fullName,
      NAME_SUGGESTION_LIMIT
    );
    return top.map((c) => {
      const b = buildingById.get(c.buildingId);
      return {
        id: c.id,
        fullName: c.fullName,
        distance: c.distance,
        street: b?.street ?? "",
        number: b?.number ?? "",
        apartment: apartmentById.get(c.id) ?? null,
      };
    });
  };

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const existing = await prisma.currentPayment.findMany({
    where: { paymentId, date: { gte: monthStart, lt: monthEnd } },
    select: { pensionerId: true, date: true },
  });
  const existingKey = new Set<string>();
  for (const e of existing) existingKey.add(`${e.pensionerId}|${e.date.getDate()}`);

  const rows: CpPreviewRow[] = [];
  for (const r of parsed.rows) {
    // День у межах місяця — критична помилка рядка, без pensioner-резолву.
    if (r.day > daysInMonth) {
      rows.push({
        rowNumber: r.rowNumber,
        fullName: r.fullName,
        street: r.street,
        house: r.house,
        apartment: r.apartment,
        day: r.day,
        amount: r.amount,
        isPaid: r.isPaid,
        building: {
          kind: "error",
          error: {
            kind: "row_invalid",
            message: `День ${r.day} не існує в ${month}/${year} (днів: ${daysInMonth})`,
          },
        },
        pensioner: null,
        buildingOptions: [],
        // День невалідний — навіть якщо вгадати пенсіонера, дату не виправити;
        // підказки тут не допоможуть.
        nameSuggestions: [],
        dupInMonth: false,
      });
      continue;
    }

    const match = findBuildingByAddress(buildings, r.street, r.house);
    if (match.kind === "ambiguous") {
      rows.push({
        rowNumber: r.rowNumber,
        fullName: r.fullName,
        street: r.street,
        house: r.house,
        apartment: r.apartment,
        day: r.day,
        amount: r.amount,
        isPaid: r.isPaid,
        building: {
          kind: "error",
          error: { kind: "ambiguous", candidates: match.candidates },
        },
        pensioner: null,
        buildingOptions: [],
        nameSuggestions: toNameSuggestions(r.fullName),
        dupInMonth: false,
      });
      continue;
    }
    if (match.kind === "none") {
      rows.push({
        rowNumber: r.rowNumber,
        fullName: r.fullName,
        street: r.street,
        house: r.house,
        apartment: r.apartment,
        day: r.day,
        amount: r.amount,
        isPaid: r.isPaid,
        building: { kind: "error", error: { kind: "none" } },
        pensioner: null,
        buildingOptions: [],
        nameSuggestions: toNameSuggestions(r.fullName),
        dupInMonth: false,
      });
      continue;
    }

    const buildingId = match.id;
    const buildingRow = buildings.find((b) => b.id === buildingId);
    const buildingOptions = pensionersByBuilding.get(buildingId) ?? [];
    // Якщо у файлі вказана квартира, спочатку шукаємо лише серед жителів цієї
    // квартири — це різко зменшує шанс плутанини в багатоквартирних будинках.
    // Fallback на весь будинок: коли у БД ще нікому не виставлено квартиру
    // (стара база) або номер не збігається — все одно показуємо матч,
    // користувач підтвердить вручну.
    const aptN = normalizeApartment(r.apartment);
    const aptFiltered = aptN
      ? buildingOptions.filter((p) => normalizeApartment(p.apartment) === aptN)
      : buildingOptions;
    const candidatesForMatch =
      aptFiltered.length > 0 ? aptFiltered : buildingOptions;
    const matchResult = findPensionerInBuilding(candidatesForMatch, r.fullName);

    // dupInMonth — лише для exact/fuzzy/ambiguous-вибору з першим кандидатом.
    let dupCandidatePid: number | null = null;
    if (matchResult.kind === "exact") dupCandidatePid = matchResult.id;
    else if (matchResult.kind === "fuzzy" || matchResult.kind === "ambiguous") {
      dupCandidatePid = matchResult.candidates[0]?.id ?? null;
    }
    const dupInMonth =
      dupCandidatePid != null && existingKey.has(`${dupCandidatePid}|${r.day}`);

    rows.push({
      rowNumber: r.rowNumber,
      fullName: r.fullName,
      street: r.street,
      house: r.house,
      apartment: r.apartment,
      day: r.day,
      amount: r.amount,
      isPaid: r.isPaid,
      building: {
        kind: "ok",
        id: buildingId,
        street: buildingRow?.street ?? r.street,
        number: buildingRow?.number ?? r.house,
        matchedStreet:
          match.kind === "loose" ? match.matchedStreet : undefined,
      },
      pensioner: matchResult,
      buildingOptions,
      // Підказки за ФІО потрібні лише коли в очікуваному будинку ніхто не
      // нагадує імпортоване імʼя — на випадок помилки адреси у файлі.
      nameSuggestions:
        matchResult.kind === "none" ? toNameSuggestions(r.fullName) : [],
      dupInMonth,
    });
  }

  return {
    ok: true,
    preview: {
      paymentId,
      paymentName: payment.name,
      paymentCode: payment.code,
      year,
      month,
      rows,
      parseErrors: parsed.errors,
    },
  };
}

export type CpRowPayload = {
  rowNumber: number;
  fullName: string;
  street: string;
  house: string;
  apartment: string | null;
  day: number;
  amount: number;
  isPaid: boolean;
};

export type CpDecision =
  | { rowNumber: number; action: "use_existing"; pensionerId: number }
  | { rowNumber: number; action: "create_new" }
  | { rowNumber: number; action: "skip" };

export type CpApplyInput = {
  paymentId: number;
  year: number;
  month: number;
  rows: CpRowPayload[];
  decisions: CpDecision[];
};

export type CpApplyResult = {
  created: number;
  createdPensioners: {
    id: number;
    fullName: string;
    street: string;
    house: string;
  }[];
  errors: { rowNumber: number; message: string }[];
  warnings: { rowNumber: number; message: string }[];
};

export async function applyCurrentPaymentsImport(
  input: CpApplyInput
): Promise<CpApplyResult> {
  await requireAdmin();

  const result: CpApplyResult = {
    created: 0,
    createdPensioners: [],
    errors: [],
    warnings: [],
  };

  const { paymentId, year, month, rows, decisions } = input;
  if (!paymentId || !Number.isInteger(paymentId)) {
    result.errors.push({ rowNumber: 0, message: "Невірний paymentId" });
    return result;
  }
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    result.errors.push({ rowNumber: 0, message: "Некоректний місяць/рік" });
    return result;
  }
  const daysInMonth = new Date(year, month, 0).getDate();

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    result.errors.push({ rowNumber: 0, message: "Тип виплати не знайдено" });
    return result;
  }

  const decisionByRow = new Map<number, CpDecision>();
  for (const d of decisions) decisionByRow.set(d.rowNumber, d);

  // Свіжий стан: захист від races (інший адмін паралельно імпортує / є manual CP).
  const buildings = await prisma.building.findMany({
    select: { id: true, street: true, number: true },
  });
  const pensioners = await prisma.pensioner.findMany({
    select: { id: true, fullName: true, buildingId: true },
  });
  const pensionersById = new Map<number, { id: number; fullName: string; buildingId: number }>();
  for (const p of pensioners) pensionersById.set(p.id, p);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const existing = await prisma.currentPayment.findMany({
    where: { paymentId, date: { gte: monthStart, lt: monthEnd } },
    select: { pensionerId: true, date: true },
  });
  const existingKey = new Set<string>();
  for (const e of existing) existingKey.add(`${e.pensionerId}|${e.date.getDate()}`);

  const touched = new Set<number>();

  for (const r of rows) {
    const decision = decisionByRow.get(r.rowNumber);
    if (!decision) {
      result.errors.push({
        rowNumber: r.rowNumber,
        message: "Немає рішення для рядка",
      });
      continue;
    }
    if (decision.action === "skip") {
      result.warnings.push({ rowNumber: r.rowNumber, message: "Пропущено вручну" });
      continue;
    }
    if (r.day < 1 || r.day > daysInMonth) {
      result.errors.push({
        rowNumber: r.rowNumber,
        message: `День ${r.day} не існує в ${month}/${year} (днів: ${daysInMonth})`,
      });
      continue;
    }

    let pensionerId: number;
    if (decision.action === "use_existing") {
      // Користувач явно обрав пенсіонера — довіряємо вибору, навіть якщо
      // адреса у файлі не зрезолвилась або відрізняється від адреси цього
      // пенсіонера в БД. Імовірно, у файлі помилка адреси, а ФІО правильне.
      // Будинок не перевіряємо: запис CurrentPayment зберігає лише pensionerId.
      const p = pensionersById.get(decision.pensionerId);
      if (!p) {
        result.errors.push({
          rowNumber: r.rowNumber,
          message: `Обраного пенсіонера #${decision.pensionerId} не знайдено`,
        });
        continue;
      }
      pensionerId = p.id;
    } else {
      // create_new — без розпізнаного будинку створювати нового не можемо.
      const match = findBuildingByAddress(buildings, r.street, r.house);
      if (match.kind === "ambiguous") {
        result.errors.push({
          rowNumber: r.rowNumber,
          message: `Кілька будинків можуть відповідати "${r.street}, ${r.house}" — уточніть у файлі або оберіть існуючого пенсіонера`,
        });
        continue;
      }
      if (match.kind === "none") {
        result.errors.push({
          rowNumber: r.rowNumber,
          message: `Будинок не знайдено в дільниці: ${r.street}, ${r.house} — виправте у файлі або оберіть існуючого пенсіонера`,
        });
        continue;
      }
      const buildingId = match.id;
      const apartment = r.apartment?.trim() || null;
      try {
        const newP = await prisma.pensioner.create({
          data: {
            fullName: r.fullName.trim(),
            buildingId,
            apartment,
            pensionPaymentDay: r.day,
            notes: "Створено при імпорті виплат (підтверджено)",
          },
        });
        pensionerId = newP.id;
        pensionersById.set(newP.id, {
          id: newP.id,
          fullName: newP.fullName,
          buildingId,
        });
        result.createdPensioners.push({
          id: newP.id,
          fullName: newP.fullName,
          street: r.street,
          house: r.house,
        });
      } catch (e) {
        result.errors.push({
          rowNumber: r.rowNumber,
          message: `Не вдалось створити пенсіонера "${r.fullName}, ${r.street}, ${r.house}": ${
            e instanceof Error ? e.message : "невідома помилка"
          }`,
        });
        continue;
      }
    }

    const dupKey = `${pensionerId}|${r.day}`;
    if (existingKey.has(dupKey)) {
      result.warnings.push({
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
      touched.add(pensionerId);
      result.created++;
    } catch (e) {
      result.errors.push({
        rowNumber: r.rowNumber,
        message: `БД: ${e instanceof Error ? e.message : "невідома помилка"}`,
      });
    }
  }

  if (result.created > 0 || result.createdPensioners.length > 0) {
    revalidatePath("/current-payments");
    if (result.createdPensioners.length > 0) revalidatePath("/pensioners");
    for (const pid of touched) revalidatePath(`/pensioners/${pid}`);
  }

  return result;
}

// Перенесення виплати на іншого пенсіонера. Сценарій: випадково створили
// дубль пенсіонера (через одруківку), на нього записались виплати — треба
// злити в існуючого. Адресу/будинок не перевіряємо: запис CurrentPayment
// тримає лише `pensionerId`. `roundId` лишаємо як є — якщо новий пенсіонер
// під іншим листоношею, ніж round, користувач сам розбереться (видалить з
// обходу або переприсвоїть). Дубль-перевірку (вже є виплата на цю дату для
// нового пенсіонера) не робимо: ручне перенесення — це вже усвідомлена дія.
export async function moveCurrentPaymentToPensioner(
  id: number,
  newPensionerId: number
) {
  const me = await requireUser();
  if (!Number.isInteger(id) || id <= 0) return { error: "Невірний id виплати" };
  if (!Number.isInteger(newPensionerId) || newPensionerId <= 0) {
    return { error: "Оберіть пенсіонера" };
  }

  const existing = await prisma.currentPayment.findUnique({
    where: { id },
    select: {
      pensionerId: true,
      roundId: true,
      round: { select: { postmanId: true } },
      pensioner: { select: { postmanId: true } },
    },
  });
  if (!existing) return { error: "Виплату не знайдено" };
  if (!canEditCurrentPayment(me, existing)) {
    return { error: "Недостатньо прав" };
  }
  if (existing.pensionerId === newPensionerId) {
    return { error: "Це той самий пенсіонер" };
  }

  const target = await prisma.pensioner.findUnique({
    where: { id: newPensionerId },
    select: { id: true, postmanId: true },
  });
  if (!target) return { error: "Цільового пенсіонера не знайдено" };
  // Не даємо «віддати» виплату пенсіонерові, на якого користувач не має
  // прав. Адміни проходять цю перевірку автоматично.
  if (!canEditPensioner(me, target)) {
    return { error: "Не можна перенести на цього пенсіонера" };
  }

  const updated = await prisma.currentPayment.update({
    where: { id },
    data: { pensionerId: newPensionerId },
  });

  revalidatePath("/current-payments");
  revalidatePath(`/pensioners/${existing.pensionerId}`);
  revalidatePath(`/pensioners/${newPensionerId}`);
  if (updated.roundId) revalidatePath(`/rounds/${updated.roundId}`);
  return { ok: true };
}

export async function deleteCurrentPayment(id: number) {
  const me = await requireUser();
  const existing = await prisma.currentPayment.findUnique({
    where: { id },
    select: {
      roundId: true,
      round: { select: { postmanId: true } },
      pensioner: { select: { postmanId: true } },
    },
  });
  if (!existing) return { error: "Виплату не знайдено" };
  if (!canEditCurrentPayment(me, existing)) {
    return { error: "Недостатньо прав" };
  }
  try {
    const payment = await prisma.currentPayment.delete({ where: { id } });
    revalidatePath("/current-payments");
    revalidatePath(`/pensioners/${payment.pensionerId}`);
    if (payment.roundId) revalidatePath(`/rounds/${payment.roundId}`);
    return { ok: true };
  } catch (e) {
    return {
      error: `Не вдалося видалити виплату: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
}
