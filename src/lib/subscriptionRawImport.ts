import ExcelJS from "exceljs";
import type { ParsedSubRow, SubParseResult, SubRowError } from "./subscriptionImport";
import { normalizeName } from "./nameMatch";
import { normalizeStreet, normalizeNumber } from "./streetMatch";

// Імпорт передплат із «сирого» експорту Укрпошти (аркуш «Перелік
// передплатників»). Формат принципово інший за шаблон застосунку:
//   • дані згруповані блоками «Видання: <код> <назва>»;
//   • колонки: Вулиця | Буд. | Кор. | Кв. | ПІБ | 01…12; рядок «Всього»;
//   • рік — у заголовку «з MM.YYYY по MM.YYYY»;
//   • телефон дописаний прямо в клітинку ПІБ;
//   • один передплатник часто розбитий на кілька рядків по періодах місяців;
//   • самовивіз позначається адресою «ВІДДІЛЕННЯ ДО» / «Начальнику відділення».
//
// Парсер зводить усе це до того самого `ParsedSubRow[]`, що й шаблонний
// парсер, тож далі працює спільний конвеєр превʼю/застосування.

export type RawParseResult = SubParseResult & {
  year: number | null;
  // Кількість вихідних рядків, злитих у попередні при агрегації періодів.
  mergedPeriods: number;
};

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const obj = v as { text?: unknown; result?: unknown; richText?: { text?: string }[] };
    if (typeof obj.text === "string") return obj.text.trim();
    if (typeof obj.result === "string") return String(obj.result).trim();
    if (typeof obj.result === "number") return String(obj.result);
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text ?? "").join("").trim();
  }
  return String(v).trim();
}

function parseQty(s: string): number | null {
  const v = s.trim();
  if (!v) return 0;
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

// Відрізати хвостовий телефон, дописаний у ПІБ: +?380…, 0…, 9–15 цифр.
function stripPhone(name: string): { name: string; phone: string | null } {
  const m = name.match(/[\s,;]*(\+?\d[\d\s\-()]{7,})$/);
  if (!m) return { name: name.trim(), phone: null };
  const phone = m[1].replace(/[\s\-()]/g, "");
  return { name: name.slice(0, m.index).trim(), phone };
}

// Автовизначення сирого формату: наявність блоків «Видання:» або титулу.
export function isRawSubscriptionsFormat(ws: ExcelJS.Worksheet): boolean {
  const limit = Math.min(ws.rowCount, 40);
  for (let i = 1; i <= limit; i++) {
    const row = ws.getRow(i);
    let hit = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const s = cellToString(cell.value).toLowerCase();
      if (s.startsWith("видання:") || s.startsWith("перелік передплатн")) hit = true;
    });
    if (hit) return true;
  }
  return false;
}

function detectYear(ws: ExcelJS.Worksheet): number | null {
  const limit = Math.min(ws.rowCount, 12);
  const years: number[] = [];
  for (let i = 1; i <= limit; i++) {
    const row = ws.getRow(i);
    row.eachCell({ includeEmpty: false }, (cell) => {
      const s = cellToString(cell.value);
      const re = /\b\d{2}\.(\d{4})\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) {
        const y = Number(m[1]);
        if (y >= 2000 && y <= 2100) years.push(y);
      }
    });
    if (years.length) break;
  }
  return years.length ? Math.max(...years) : null;
}

// Якщо будинок/квартира не рознесені по колонках, а «сидять» у клітинці
// вулиці (напр. «вул. Шевченко 19», «пр. Миру 15-б/7») — спробувати рознести.
function splitStreetCell(cell: string): { street: string; number: string; apartment: string } {
  const m = cell.match(/^(.*?)[\s,]+(\d+[A-Za-zА-Яа-яІЇЄҐіїєґ\-]*)(?:\s*\/\s*(\d+\w*))?\s*$/);
  if (!m) return { street: cell.trim(), number: "", apartment: "" };
  return { street: m[1].trim(), number: m[2].trim(), apartment: (m[3] ?? "").trim() };
}

function isPickupAddress(street: string, house: string): boolean {
  const s = `${street} ${house}`.toLowerCase();
  return /відділенн|начальник|самовив/.test(s);
}

const HEADER_NAME = "піб";
const norm = (s: string) => s.trim().toLowerCase();

type ColMap = {
  street: number;
  house: number;
  corpus: number;
  apartment: number;
  name: number;
  months: Record<number, number>; // monthIndex 0..11 → column
};

function readHeader(row: ExcelJS.Row): ColMap | null {
  const map: ColMap = { street: 0, house: 0, corpus: 0, apartment: 0, name: 0, months: {} };
  let sawName = false;
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const s = norm(cellToString(cell.value));
    if (s === "вулиця") map.street = col;
    else if (s === "буд" || s === "буд." || s === "будинок") map.house = col;
    else if (s === "кор" || s === "кор." || s === "корпус") map.corpus = col;
    else if (s === "кв" || s === "кв." || s === "квартира") map.apartment = col;
    else if (s === HEADER_NAME) { map.name = col; sawName = true; }
    else if (/^\d{1,2}$/.test(s)) {
      const n = Number(s);
      if (n >= 1 && n <= 12) map.months[n - 1] = col;
    }
  });
  if (!sawName || Object.keys(map.months).length < 12) return null;
  return map;
}

const SKIP_COL1 = new Set(["всього", "разом"]);
function isTitleCell(c1: string): boolean {
  const l = c1.toLowerCase();
  return (
    l.includes("перелік передплатн") ||
    l.startsWith("з 0") ||
    l.startsWith("доставна") ||
    l.startsWith("індекс") ||
    /^\d{4,}\.\s/.test(c1)
  );
}

export async function parseRawSubscriptionsXlsx(buffer: ArrayBuffer): Promise<RawParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ rowNumber: 0, message: "Файл не містить аркушів" }], publicationNames: {}, skippedEmpty: 0, year: null, mergedPeriods: 0 };
  }

  const year = detectYear(ws);
  const errors: SubRowError[] = [];
  if (year == null) {
    errors.push({ rowNumber: 0, message: "Не вдалося визначити рік із заголовка (очікується «з MM.YYYY по MM.YYYY»)" });
  }

  const publicationNames: Record<string, string> = {};
  let col: ColMap | null = null;
  let curCode = "";
  let skippedEmpty = 0;

  // Проміжна агрегація періодів: ключ (ПІБ+адреса+видання) → накопичена підписка.
  const agg = new Map<string, ParsedSubRow>();
  let mergedPeriods = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const c1 = cellToString(row.getCell(1).value);

    if (c1.toLowerCase().startsWith("видання:")) {
      const rest = c1.slice(c1.indexOf(":") + 1).trim();
      const m = rest.match(/^(\S+)\s*(.*)$/);
      curCode = m ? m[1] : rest;
      const name = m ? m[2].trim() : "";
      if (curCode) publicationNames[curCode] = name;
      return;
    }

    // Рядок заголовків блоку (Вулиця…ПІБ…01..12).
    const maybeHeader = readHeader(row);
    if (maybeHeader) { col = maybeHeader; return; }

    if (!c1 && !row.getCell(col?.name ?? 5).value) return;
    if (SKIP_COL1.has(norm(c1)) || isTitleCell(c1)) return;
    if (!col || !curCode) return;

    const rawName = cellToString(row.getCell(col.name).value);
    if (!rawName) return;

    // Місяці.
    const months = new Array<number>(12).fill(0);
    let monthErr = false;
    for (let m = 0; m < 12; m++) {
      const q = parseQty(cellToString(row.getCell(col.months[m]).value));
      if (q == null) { monthErr = true; break; }
      months[m] = q;
    }
    if (monthErr) {
      errors.push({ rowNumber, message: "Некоректна кількість примірників" });
      return;
    }
    if (months.reduce((a, b) => a + b, 0) === 0) { skippedEmpty++; return; }

    const { name: fullName, phone } = stripPhone(rawName);
    if (!fullName) { errors.push({ rowNumber, message: "Порожнє ПІБ" }); return; }

    let street = cellToString(row.getCell(col.street).value);
    let house = cellToString(row.getCell(col.house).value);
    const corpus = cellToString(row.getCell(col.corpus).value) || null;
    let apartment = cellToString(row.getCell(col.apartment).value) || null;

    const pickup = isPickupAddress(street, house);
    if (!pickup && street && !house) {
      const sp = splitStreetCell(street);
      street = sp.street;
      house = sp.number;
      if (!apartment && sp.apartment) apartment = sp.apartment;
    }

    const parsed: ParsedSubRow = {
      rowNumber,
      year: year ?? 0,
      publicationCode: curCode,
      fullName,
      isOrganization: /\b(тов|дп|кп|пп|фоп|прат|пат|ат|управлінн|відділ|порт)\b/i.test(fullName),
      phone,
      street: pickup ? null : street || null,
      number: pickup ? null : house || null,
      corpus,
      apartment,
      deliveryMode: pickup ? "PICKUP" : "ADDRESS",
      months,
    };

    // Агрегація періодів: однаковий нормалізований ПІБ + адреса + видання.
    const key = [
      normalizeName(fullName),
      pickup ? "pickup" : `${normalizeStreet(street)}|${normalizeNumber(house)}|${apartment ?? ""}`,
      curCode,
    ].join("::");
    const prev = agg.get(key);
    if (prev) {
      for (let m = 0; m < 12; m++) prev.months[m] += parsed.months[m];
      if (!prev.phone && parsed.phone) prev.phone = parsed.phone;
      mergedPeriods++;
    } else {
      agg.set(key, parsed);
    }
  });

  return {
    rows: [...agg.values()],
    errors,
    publicationNames,
    skippedEmpty,
    year,
    mergedPeriods,
  };
}
