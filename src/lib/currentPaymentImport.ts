import ExcelJS from "exceljs";

export type ParsedCpRow = {
  rowNumber: number;
  fullName: string;
  street: string;
  house: string;
  day: number;
  amount: number;
  isPaid: boolean;
};

export type CpRowError = { rowNumber: number; message: string };

export const CP_COLUMN_HEADERS = [
  "ФІО",
  "Вулиця",
  "Будинок",
  "День",
  "Сума",
  "Виплачено",
] as const;

const HEADER_ALIASES: Record<string, string> = {
  "фіо": "ФІО",
  "піб": "ФІО",
  "ім'я": "ФІО",
  "імя": "ФІО",
  "вулиця": "Вулиця",
  "будинок": "Будинок",
  "буд": "Будинок",
  "день": "День",
  "число": "День",
  "день місяця": "День",
  "дата": "День",
  "сума": "Сума",
  "amount": "Сума",
  "виплачено": "Виплачено",
  "оплачено": "Виплачено",
  "isPaid": "Виплачено",
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

function parseBool(s: string): boolean {
  const v = s.trim().toLowerCase();
  if (!v) return false;
  return ["1", "true", "так", "yes", "y", "+", "✓", "✔", "виплачено", "оплачено"].includes(v);
}

export type CpParseResult = {
  rows: ParsedCpRow[];
  errors: CpRowError[];
};

export async function parseCurrentPaymentsXlsx(buffer: ArrayBuffer): Promise<CpParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ rowNumber: 0, message: "Файл не містить аркушів" }] };
  }

  const rows: ParsedCpRow[] = [];
  const errors: CpRowError[] = [];

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
          message: `Не знайдено рядок із заголовками. Очікувані колонки: ${CP_COLUMN_HEADERS.join(", ")}`,
        },
      ],
    };
  }

  for (const required of ["ФІО", "Вулиця", "Будинок", "День", "Сума"] as const) {
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
    const dayRaw = get("День");
    const amountRaw = get("Сума");
    const paidRaw = get("Виплачено");

    if (!fullName && !street && !house && !dayRaw && !amountRaw) continue;

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
      errors.push({ rowNumber: i, message: `Некоректний день: "${dayRaw}" (треба 1..31)` });
      continue;
    }
    const amount = Number(String(amountRaw).replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push({ rowNumber: i, message: `Некоректна сума: "${amountRaw}"` });
      continue;
    }

    rows.push({
      rowNumber: i,
      fullName,
      street,
      house,
      day,
      amount,
      isPaid: parseBool(paidRaw),
    });
  }

  return { rows, errors };
}

export async function buildCurrentPaymentsTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Поточні виплати");
  ws.columns = CP_COLUMN_HEADERS.map((h) => ({
    header: h,
    key: h,
    width:
      h === "ФІО" ? 28 : h === "Вулиця" ? 22 : h === "Сума" ? 14 : h === "Виплачено" ? 12 : 10,
  }));
  ws.getRow(1).font = { bold: true };
  ws.addRow({
    "ФІО": "Петренко Марія Іванівна",
    "Вулиця": "вул. Шевченка",
    "Будинок": "12",
    "День": 5,
    "Сума": 3500,
    "Виплачено": "так",
  });
  ws.addRow({
    "ФІО": "Коваль Олексій Петрович",
    "Вулиця": "вул. Франка",
    "Будинок": "4",
    "День": 12,
    "Сума": 4100,
    "Виплачено": "",
  });
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
