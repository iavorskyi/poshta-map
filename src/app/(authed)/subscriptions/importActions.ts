"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assert, canManageSubscriptions } from "@/lib/permissions";
import { CACHE_TAGS } from "@/lib/queries";
import {
  findBuildingByAddress,
  normalizeNumber,
  normalizeStreet,
} from "@/lib/streetMatch";
import {
  findClosestPensionersByName,
  tokenizeName,
  type NameMatchCandidate,
} from "@/lib/nameMatch";
import { parseSubscriptionsXlsx, type ParsedSubRow } from "@/lib/subscriptionImport";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const NAME_SUGGESTION_LIMIT = 5;
const FUZZY_MAX_DISTANCE = 4;

// Резолв адреси рядка (спільний для preview і apply).
type ResolvedAddress =
  | { kind: "building"; id: number; street: string; number: string; matchedStreet?: string }
  | { kind: "text"; street: string; number: string }
  | { kind: "pickup" }
  | { kind: "none" };

type BuildingRow = { id: number; street: string; number: string };

function resolveAddress(buildings: BuildingRow[], row: ParsedSubRow): ResolvedAddress {
  if (row.deliveryMode === "PICKUP") return { kind: "pickup" };
  const street = row.street?.trim() ?? "";
  const number = row.number?.trim() ?? "";
  if (!street || !number) return { kind: "none" };
  const match = findBuildingByAddress(buildings, street, number);
  if (match.kind === "exact") {
    const b = buildings.find((x) => x.id === match.id);
    return { kind: "building", id: match.id, street: b?.street ?? street, number: b?.number ?? number };
  }
  if (match.kind === "loose") {
    const b = buildings.find((x) => x.id === match.id);
    return {
      kind: "building",
      id: match.id,
      street: b?.street ?? street,
      number: b?.number ?? number,
      matchedStreet: match.matchedStreet,
    };
  }
  // none / ambiguous → зберігаємо як текст (off-district — валідно для передплатника).
  return { kind: "text", street, number };
}

type SubscriberRow = {
  id: number;
  fullName: string;
  isOrganization: boolean;
  buildingId: number | null;
  streetText: string | null;
  numberText: string | null;
  deliveryMode: "ADDRESS" | "PICKUP";
};

function addressMatches(s: SubscriberRow, addr: ResolvedAddress): boolean {
  switch (addr.kind) {
    case "building":
      return s.buildingId === addr.id;
    case "text":
      return (
        !!s.streetText &&
        !!s.numberText &&
        normalizeStreet(s.streetText) === normalizeStreet(addr.street) &&
        normalizeNumber(s.numberText) === normalizeNumber(addr.number)
      );
    case "pickup":
      return s.deliveryMode === "PICKUP";
    case "none":
      return true; // адреса невідома — матч лише за ПІБ
  }
}

function tokensEqual(a: string[], b: string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((t, i) => t === b[i]);
}

export type SubImportSubscriberStatus =
  | { kind: "exact"; id: number; fullName: string }
  | { kind: "fuzzy"; candidates: NameMatchCandidate[] }
  | { kind: "none" };

export type SubImportPublicationStatus =
  | { kind: "existing"; id: number; code: string; name: string }
  | { kind: "new"; code: string; name: string };

export type SubImportNameSuggestion = {
  id: number;
  fullName: string;
  distance: number;
  address: string;
};

export type SubImportPreviewRow = {
  rowNumber: number;
  year: number;
  publicationCode: string;
  fullName: string;
  isOrganization: boolean;
  phone: string | null;
  // Сирі поля адреси (для формування payload на кроці apply).
  street: string | null;
  number: string | null;
  corpus: string | null;
  apartment: string | null;
  addressLabel: string;
  deliveryMode: "ADDRESS" | "PICKUP";
  addressKind: ResolvedAddress["kind"];
  addressError: string | null; // напр. ADDRESS без вулиці/будинку
  months: number[];
  monthsTotal: number;
  publication: SubImportPublicationStatus;
  subscriber: SubImportSubscriberStatus;
  nameSuggestions: SubImportNameSuggestion[];
  // Для exact-передплатника: чи вже існує підписка (subscriber, publication, year) → оновимо.
  willUpdate: boolean;
};

export type SubImportPreview = {
  year: number;
  rows: SubImportPreviewRow[];
  parseErrors: { rowNumber: number; message: string }[];
  skippedEmpty: number;
  newPublications: { code: string; name: string }[];
};

export type SubImportPreviewResponse =
  | { ok: true; preview: SubImportPreview }
  | { ok: false; error: string; parseErrors?: { rowNumber: number; message: string }[] };

function addrLabel(addr: ResolvedAddress, row: ParsedSubRow): string {
  const extra = [row.corpus ? `кор. ${row.corpus}` : "", row.apartment ? `кв. ${row.apartment}` : ""]
    .filter(Boolean)
    .join(", ");
  switch (addr.kind) {
    case "building":
      return `${addr.street}, ${addr.number}${extra ? `, ${extra}` : ""}`;
    case "text":
      return `${addr.street}, ${addr.number}${extra ? `, ${extra}` : ""} (поза дільницею)`;
    case "pickup":
      return "Самовивіз";
    case "none":
      return "—";
  }
}

export async function previewSubscriptionsImport(
  formData: FormData,
): Promise<SubImportPreviewResponse> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Файл не надіслано" };
  if (file.size === 0) return { ok: false, error: "Файл порожній" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Файл більше 10 МБ" };

  let parsed;
  try {
    const buffer = await file.arrayBuffer();
    parsed = await parseSubscriptionsXlsx(buffer);
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
  const publications = await prisma.publication.findMany({
    select: { id: true, code: true, name: true },
  });
  const pubByCode = new Map(publications.map((p) => [p.code, p]));
  const subscribers = await prisma.subscriber.findMany({
    select: {
      id: true,
      fullName: true,
      isOrganization: true,
      buildingId: true,
      streetText: true,
      numberText: true,
      deliveryMode: true,
      corpus: true,
      apartment: true,
    },
  });
  const subRows: SubscriberRow[] = subscribers.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    isOrganization: s.isOrganization,
    buildingId: s.buildingId,
    streetText: s.streetText,
    numberText: s.numberText,
    deliveryMode: s.deliveryMode,
  }));
  const subForBroad = subscribers.map((s) => ({ id: s.id, fullName: s.fullName, buildingId: s.buildingId ?? 0 }));
  const subById = new Map(subscribers.map((s) => [s.id, s]));

  // Наявні підписки для перевірки "оновимо наявну".
  const years = [...new Set(parsed.rows.map((r) => r.year))];
  const existingSubs = await prisma.subscription.findMany({
    where: { year: { in: years.length ? years : [0] } },
    select: { subscriberId: true, publicationId: true, year: true },
  });
  const existingKey = new Set(existingSubs.map((e) => `${e.subscriberId}|${e.publicationId}|${e.year}`));

  const subAddressLabel = (id: number): string => {
    const s = subById.get(id);
    if (!s) return "";
    if (s.buildingId) {
      const b = buildings.find((x) => x.id === s.buildingId);
      return b ? `${b.street}, ${b.number}` : "";
    }
    if (s.streetText && s.numberText) return `${s.streetText}, ${s.numberText}`;
    if (s.deliveryMode === "PICKUP") return "самовивіз";
    return "";
  };

  const toSuggestions = (fullName: string): SubImportNameSuggestion[] =>
    findClosestPensionersByName(subForBroad, fullName, NAME_SUGGESTION_LIMIT)
      .filter((c) => c.distance <= FUZZY_MAX_DISTANCE)
      .map((c) => ({
        id: c.id,
        fullName: c.fullName,
        distance: c.distance,
        address: subAddressLabel(c.id),
      }));

  const newPubCodes = new Map<string, string>();
  const rows: SubImportPreviewRow[] = [];

  for (const r of parsed.rows) {
    const addr = resolveAddress(buildings, r);
    const addressError =
      addr.kind === "none"
        ? "Для доставки на адресу вкажіть вулицю і будинок або оберіть Самовивіз"
        : null;

    // Видання за кодом.
    const existingPub = pubByCode.get(r.publicationCode);
    let publication: SubImportPublicationStatus;
    if (existingPub) {
      publication = { kind: "existing", id: existingPub.id, code: existingPub.code, name: existingPub.name };
    } else {
      const name = parsed.publicationNames[r.publicationCode] ?? r.publicationCode;
      publication = { kind: "new", code: r.publicationCode, name };
      newPubCodes.set(r.publicationCode, name);
    }

    // Передплатник: exact за ПІБ+адресою, інакше fuzzy за ПІБ, інакше none.
    const target = tokenizeName(r.fullName);
    const sameAddr = subRows.filter((s) => addressMatches(s, addr));
    const exact = sameAddr.find((s) => tokensEqual(tokenizeName(s.fullName), target));

    let subscriber: SubImportSubscriberStatus;
    let nameSuggestions: SubImportNameSuggestion[] = [];
    let willUpdate = false;
    if (exact) {
      subscriber = { kind: "exact", id: exact.id, fullName: exact.fullName };
      if (publication.kind === "existing") {
        willUpdate = existingKey.has(`${exact.id}|${publication.id}|${r.year}`);
      }
    } else {
      const close = findClosestPensionersByName(subForBroad, r.fullName, NAME_SUGGESTION_LIMIT).filter(
        (c) => c.distance <= FUZZY_MAX_DISTANCE,
      );
      if (close.length > 0) {
        subscriber = {
          kind: "fuzzy",
          candidates: close.map((c) => ({ id: c.id, fullName: c.fullName, distance: c.distance })),
        };
        nameSuggestions = toSuggestions(r.fullName);
      } else {
        subscriber = { kind: "none" };
      }
    }

    rows.push({
      rowNumber: r.rowNumber,
      year: r.year,
      publicationCode: r.publicationCode,
      fullName: r.fullName,
      isOrganization: r.isOrganization,
      phone: r.phone,
      street: r.street,
      number: r.number,
      corpus: r.corpus,
      apartment: r.apartment,
      addressLabel: addrLabel(addr, r),
      deliveryMode: r.deliveryMode,
      addressKind: addr.kind,
      addressError,
      months: r.months,
      monthsTotal: r.months.reduce((a, b) => a + b, 0),
      publication,
      subscriber,
      nameSuggestions,
      willUpdate,
    });
  }

  const year = rows[0]?.year ?? new Date().getFullYear();
  return {
    ok: true,
    preview: {
      year,
      rows,
      parseErrors: parsed.errors,
      skippedEmpty: parsed.skippedEmpty,
      newPublications: [...newPubCodes.entries()].map(([code, name]) => ({ code, name })),
    },
  };
}

// ── Apply ───────────────────────────────────────────────────────────────

export type SubRowPayload = {
  rowNumber: number;
  year: number;
  publicationCode: string;
  publicationName: string;
  fullName: string;
  isOrganization: boolean;
  phone: string | null;
  street: string | null;
  number: string | null;
  corpus: string | null;
  apartment: string | null;
  deliveryMode: "ADDRESS" | "PICKUP";
  months: number[];
};

export type SubDecision =
  | { rowNumber: number; action: "use_existing"; subscriberId: number }
  | { rowNumber: number; action: "create_new" }
  | { rowNumber: number; action: "skip" };

export type SubApplyInput = {
  rows: SubRowPayload[];
  decisions: SubDecision[];
};

export type SubApplyResult = {
  subscriptionsCreated: number;
  subscriptionsUpdated: number;
  subscribersCreated: { id: number; fullName: string }[];
  publicationsCreated: { code: string; name: string }[];
  warnings: { rowNumber: number; message: string }[];
  errors: { rowNumber: number; message: string }[];
};

export async function applySubscriptionsImport(input: SubApplyInput): Promise<SubApplyResult> {
  const me = await requireUser();
  assert(canManageSubscriptions(me));

  const result: SubApplyResult = {
    subscriptionsCreated: 0,
    subscriptionsUpdated: 0,
    subscribersCreated: [],
    publicationsCreated: [],
    warnings: [],
    errors: [],
  };

  const decisionByRow = new Map<number, SubDecision>();
  for (const d of input.decisions) decisionByRow.set(d.rowNumber, d);

  const buildings = await prisma.building.findMany({
    select: { id: true, street: true, number: true },
  });
  const pubByCode = new Map(
    (await prisma.publication.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id]),
  );

  let pubsCreated = false;
  let subsTouched = false;

  for (const r of input.rows) {
    const decision = decisionByRow.get(r.rowNumber);
    if (!decision) {
      result.errors.push({ rowNumber: r.rowNumber, message: "Немає рішення для рядка" });
      continue;
    }
    if (decision.action === "skip") {
      result.warnings.push({ rowNumber: r.rowNumber, message: "Пропущено вручну" });
      continue;
    }

    const months = normalizeMonths(r.months);
    if (months.reduce((a, b) => a + b, 0) === 0) {
      result.warnings.push({ rowNumber: r.rowNumber, message: "Усі місяці нульові — пропущено" });
      continue;
    }

    // 1) Видання (створюємо за кодом, якщо відсутнє).
    let publicationId = pubByCode.get(r.publicationCode);
    if (!publicationId) {
      try {
        const created = await prisma.publication.upsert({
          where: { code: r.publicationCode },
          create: { code: r.publicationCode, name: r.publicationName?.trim() || r.publicationCode },
          update: {},
          select: { id: true, code: true, name: true },
        });
        publicationId = created.id;
        pubByCode.set(r.publicationCode, created.id);
        result.publicationsCreated.push({ code: created.code, name: created.name });
        pubsCreated = true;
      } catch (e) {
        result.errors.push({
          rowNumber: r.rowNumber,
          message: `Не вдалось створити видання ${r.publicationCode}: ${e instanceof Error ? e.message : "помилка"}`,
        });
        continue;
      }
    }

    // 2) Передплатник.
    let subscriberId: number;
    if (decision.action === "use_existing") {
      const exists = await prisma.subscriber.findUnique({
        where: { id: decision.subscriberId },
        select: { id: true },
      });
      if (!exists) {
        result.errors.push({
          rowNumber: r.rowNumber,
          message: `Обраного передплатника #${decision.subscriberId} не знайдено`,
        });
        continue;
      }
      subscriberId = exists.id;
    } else {
      // create_new — визначаємо адресу.
      let buildingId: number | null = null;
      let streetText: string | null = null;
      let numberText: string | null = null;
      let deliveryMode: "ADDRESS" | "PICKUP" = r.deliveryMode;

      if (r.deliveryMode === "PICKUP") {
        deliveryMode = "PICKUP";
      } else {
        const street = r.street?.trim() ?? "";
        const number = r.number?.trim() ?? "";
        if (!street || !number) {
          result.errors.push({
            rowNumber: r.rowNumber,
            message: "Немає адреси для нового передплатника (вкажіть вулицю+будинок або Самовивіз)",
          });
          continue;
        }
        const match = findBuildingByAddress(buildings, street, number);
        if (match.kind === "exact" || match.kind === "loose") {
          buildingId = match.id;
        } else {
          streetText = street;
          numberText = number;
        }
      }

      try {
        const created = await prisma.subscriber.create({
          data: {
            fullName: r.fullName.trim(),
            isOrganization: r.isOrganization,
            phone: r.phone,
            buildingId,
            streetText,
            numberText,
            corpus: r.corpus,
            apartment: r.apartment,
            deliveryMode,
          },
          select: { id: true, fullName: true },
        });
        subscriberId = created.id;
        result.subscribersCreated.push({ id: created.id, fullName: created.fullName });
      } catch (e) {
        result.errors.push({
          rowNumber: r.rowNumber,
          message: `Не вдалось створити передплатника "${r.fullName}": ${e instanceof Error ? e.message : "помилка"}`,
        });
        continue;
      }
    }

    // 3) Підписка (upsert за унікальним ключем).
    try {
      const existing = await prisma.subscription.findUnique({
        where: {
          subscriberId_publicationId_year: {
            subscriberId,
            publicationId,
            year: r.year,
          },
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.subscription.update({
          where: { id: existing.id },
          data: { activeMonths: months },
        });
        result.subscriptionsUpdated++;
      } else {
        await prisma.subscription.create({
          data: { subscriberId, publicationId, year: r.year, activeMonths: months },
        });
        result.subscriptionsCreated++;
      }
      subsTouched = true;
    } catch (e) {
      result.errors.push({
        rowNumber: r.rowNumber,
        message: `БД: ${e instanceof Error ? e.message : "невідома помилка"}`,
      });
    }
  }

  if (pubsCreated) updateTag(CACHE_TAGS.publications);
  if (subsTouched || result.subscribersCreated.length > 0) {
    revalidatePath("/subscriptions/publications");
    revalidatePath("/subscriptions/subscribers");
  }

  return result;
}

function normalizeMonths(months: number[]): number[] {
  const out = new Array<number>(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const v = months[i];
    out[i] = Number.isInteger(v) && v > 0 && v <= 999 ? v : 0;
  }
  return out;
}
