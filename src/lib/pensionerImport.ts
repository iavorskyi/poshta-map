import ExcelJS from "exceljs";

export type ParsedRow = {
  rowNumber: number;
  fullName: string;
  street: string;
  house: string;
  apartment: string | null;
  phone: string | null;
  passportNumber: string | null;
  pensionPaymentDay: number;
  notes: string | null;
};

export type RowError = { rowNumber: number; message: string };

export const COLUMN_HEADERS = [
  "ФІО",
  "Вулиця",
  "Будинок",
  "Квартира",
  "Телефон",
  "Паспорт",
  "День пенсії",
  "Примітки",
] as const;

const HEADER_ALIASES: Record<string, string> = {
  "фіо": "ФІО",
  "піб": "ФІО",
  "ім'я": "ФІО",
  "імя": "ФІО",
  "вулиця": "Вулиця",
  "будинок": "Будинок",
  "буд": "Будинок",
  "будинок №": "Будинок",
  "квартира": "Квартира",
  "кв": "Квартира",
  "кв.": "Квартира",
  "телефон": "Телефон",
  "тел": "Телефон",
  "паспорт": "Паспорт",
  "паспорт №": "Паспорт",
  "паспорту": "Паспорт",
  "день пенсії": "День пенсії",
  "день": "День пенсії",
  "примітки": "Примітки",
  "коментар": "Примітки",
  "нотатки": "Примітки",
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

export type ParseResult = {
  rows: ParsedRow[];
  errors: RowError[];
};

export async function parsePensionersXlsx(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ rowNumber: 0, message: "Файл не містить аркушів" }] };
  }

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  // First non-empty row = headers
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
    if (nonEmpty > 0 && Object.keys(map).length >= 3) {
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

  for (const required of ["ФІО", "Вулиця", "Будинок", "День пенсії"] as const) {
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

    const fullName = get("ФІО");
    const street = get("Вулиця");
    const house = get("Будинок");
    const apartment = get("Квартира") || null;
    const phone = get("Телефон") || null;
    const passportNumber = get("Паспорт") || null;
    const dayRaw = get("День пенсії");
    const notes = get("Примітки") || null;

    // Skip fully empty rows silently
    if (!fullName && !street && !house && !dayRaw) continue;

    if (!fullName) {
      errors.push({ rowNumber: i, message: "Порожнє ФІО" });
      continue;
    }
    if (!street) {
      errors.push({ rowNumber: i, message: "Порожня вулиця" });
      continue;
    }
    if (!house) {
      errors.push({ rowNumber: i, message: "Порожній будинок" });
      continue;
    }
    const day = Number(dayRaw);
    if (!Number.isFinite(day) || !Number.isInteger(day) || day < 1 || day > 31) {
      errors.push({ rowNumber: i, message: `Некоректний день пенсії: "${dayRaw}" (треба 1..31)` });
      continue;
    }

    rows.push({
      rowNumber: i,
      fullName,
      street,
      house,
      apartment,
      phone,
      passportNumber,
      pensionPaymentDay: day,
      notes,
    });
  }

  return { rows, errors };
}

export async function buildPensionersTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Пенсіонери");
  ws.columns = COLUMN_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: h === "ФІО" ? 28 : h === "Примітки" ? 32 : h === "Вулиця" ? 22 : 14,
  }));
  ws.getRow(1).font = { bold: true };
  ws.addRow({
    "ФІО": "Петренко Марія Іванівна",
    "Вулиця": "вул. Шевченка",
    "Будинок": "12",
    "Квартира": "5",
    "Телефон": "+380501112233",
    "Паспорт": "АА123456",
    "День пенсії": 5,
    "Примітки": "Живе на 3-му поверсі",
  });
  ws.addRow({
    "ФІО": "Коваль Олексій Петрович",
    "Вулиця": "вул. Франка",
    "Будинок": "4",
    "Квартира": "11",
    "Телефон": "",
    "Паспорт": "",
    "День пенсії": 12,
    "Примітки": "",
  });
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
