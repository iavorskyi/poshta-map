import ExcelJS from "exceljs";
import { extractAddressFromName, type NoticeSlipItemType } from "@/lib/noticeSlipShared";

export type NoticeSlipRow = {
  rowNumber: number;
  name: string;
  address: string;
  trackingNumber: string | null;
  itemType: NoticeSlipItemType;
};

export type RowError = { rowNumber: number; message: string };

export const COLUMN_HEADERS = ["ФІО", "Адреса", "ШКІ", "Тип"] as const;

const HEADER_ALIASES: Record<string, string> = {
  "фіо": "ФІО",
  "піб": "ФІО",
  "ім'я": "ФІО",
  "імя": "ФІО",
  "адреса": "Адреса",
  "адреса проживання": "Адреса",
  "шкі": "ШКІ",
  "шкі відправлення": "ШКІ",
  "трек": "ШКІ",
  "трек-номер": "ШКІ",
  "номер": "ШКІ",
  "тип": "Тип",
  "вид": "Тип",
  "тип відправлення": "Тип",
};

function normalizeHeader(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  return HEADER_ALIASES[s] ?? null;
}

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
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => r.text ?? "").join("").trim();
    }
  }
  return String(v).trim();
}

function parseItemType(raw: string): NoticeSlipItemType | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("прост")) return "PLAIN";
  if (s.startsWith("рек")) return "REGISTERED";
  return null;
}

export type ParseResult = {
  rows: NoticeSlipRow[];
  errors: RowError[];
};

export async function parseNoticeSlipXlsx(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ rowNumber: 0, message: "Файл не містить аркушів" }] };
  }

  const rows: NoticeSlipRow[] = [];
  const errors: RowError[] = [];

  let headerRowIdx = 0;
  let headerMap: Record<string, number> = {};
  for (let i = 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const map: Record<string, number> = {};
    let nonEmpty = 0;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const norm = normalizeHeader(cell.value);
      if (norm) map[norm] = colNumber;
      nonEmpty++;
    });
    if (nonEmpty > 0 && Object.keys(map).length >= 2) {
      headerRowIdx = i;
      headerMap = map;
      break;
    }
  }

  if (!headerRowIdx) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 0,
          message: `Не знайдено рядок із заголовками. Очікувані колонки: ${COLUMN_HEADERS.join(", ")}`,
        },
      ],
    };
  }

  for (const required of ["ФІО", "Тип"] as const) {
    if (!headerMap[required]) {
      errors.push({
        rowNumber: headerRowIdx,
        message: `Відсутня обов'язкова колонка "${required}"`,
      });
    }
  }
  if (errors.length) return { rows: [], errors };

  for (let i = headerRowIdx + 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const get = (h: string) => {
      const col = headerMap[h];
      if (!col) return "";
      return cellToString(row.getCell(col).value);
    };

    const nameRaw = get("ФІО");
    const addressRaw = get("Адреса");
    const trackingRaw = get("ШКІ") || null;
    const typeRaw = get("Тип");

    if (!nameRaw && !addressRaw && !typeRaw) continue;

    if (!nameRaw) {
      errors.push({ rowNumber: i, message: "Порожнє ФІО" });
      continue;
    }

    const itemType = parseItemType(typeRaw);
    if (!itemType) {
      errors.push({
        rowNumber: i,
        message: `Некоректний тип відправлення: "${typeRaw}" (очікується "просте" або "рекомендоване")`,
      });
      continue;
    }

    if (itemType === "REGISTERED" && !trackingRaw) {
      errors.push({ rowNumber: i, message: "ШКІ обов'язковий для рекомендованого відправлення" });
      continue;
    }

    let name = nameRaw;
    let address = addressRaw;
    if (!address) {
      const extracted = extractAddressFromName(nameRaw);
      name = extracted.name;
      address = extracted.address ?? "";
    }

    if (!address) {
      errors.push({ rowNumber: i, message: "Порожня адреса" });
      continue;
    }

    rows.push({
      rowNumber: i,
      name,
      address,
      trackingNumber: trackingRaw,
      itemType,
    });
  }

  return { rows, errors };
}

export async function buildNoticeSlipTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Повідомлення");
  ws.columns = COLUMN_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: h === "ФІО" ? 28 : h === "Адреса" ? 32 : 16,
  }));
  ws.getRow(1).font = { bold: true };
  ws.addRow({
    "ФІО": "Іванов Іван Іванович",
    "Адреса": "вул. Шевченка, 10, кв. 5",
    "ШКІ": "0501234567890",
    "Тип": "рекомендоване",
  });
  ws.addRow({
    "ФІО": "Петренко Марія Іванівна",
    "Адреса": "вул. Франка, 4, кв. 11",
    "ШКІ": "",
    "Тип": "просте",
  });
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
