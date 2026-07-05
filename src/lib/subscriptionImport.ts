import ExcelJS from "exceljs";

// Імпорт передплат з XLSX. Формат — див. шаблон, що віддає
// `/api/subscriptions/template` (buildSubscriptionsTemplate нижче).
//
// Один рядок аркуша «Передплати» = одна передплата (передплатник × видання
// × рік) з 12-місячним масивом кількостей примірників. Видання беруться за
// кодом (аркуш «Видання» — довідник code→name для авто-створення відсутніх).

export type ParsedSubRow = {
  rowNumber: number;
  year: number;
  publicationCode: string;
  fullName: string;
  isOrganization: boolean;
  phone: string | null;
  street: string | null;
  number: string | null;
  corpus: string | null;
  apartment: string | null;
  deliveryMode: "ADDRESS" | "PICKUP";
  months: number[]; // рівно 12, index 0 = січень
};

export type SubRowError = { rowNumber: number; message: string };

export type SubParseResult = {
  rows: ParsedSubRow[];
  errors: SubRowError[];
  // Код видання → назва з аркуша «Видання» (для авто-створення відсутніх).
  publicationNames: Record<string, string>;
  // Рядки, де всі 12 місяців = 0 (передплату не створюємо) — просто рахуємо.
  skippedEmpty: number;
};

const MAIN_HEADERS = {
  year: "Рік",
  code: "Код видання",
  fullName: "ПІБ",
  type: "Тип",
  phone: "Телефон",
  street: "Вулиця",
  house: "Буд.",
  corpus: "Кор.",
  apartment: "Кв.",
  delivery: "Доставка",
} as const;

const HEADER_ALIASES: Record<string, keyof typeof MAIN_HEADERS> = {
  "рік": "year",
  "год": "year",
  "year": "year",
  "код видання": "code",
  "код": "code",
  "індекс": "code",
  "code": "code",
  "піб": "fullName",
  "фіо": "fullName",
  "ім'я": "fullName",
  "імя": "fullName",
  "передплатник": "fullName",
  "тип": "type",
  "телефон": "phone",
  "тел": "phone",
  "тел.": "phone",
  "phone": "phone",
  "вулиця": "street",
  "буд": "house",
  "буд.": "house",
  "будинок": "house",
  "дім": "house",
  "кор": "corpus",
  "кор.": "corpus",
  "корпус": "corpus",
  "кв": "apartment",
  "кв.": "apartment",
  "квартира": "apartment",
  "доставка": "delivery",
  "спосіб доставки": "delivery",
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
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => r.text ?? "").join("").trim();
    }
  }
  return String(v).trim();
}

// Заголовок місяця "01".."12" / "1".."12" → індекс 0..11, інакше null.
function monthIndexFromHeader(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  if (n >= 1 && n <= 12) return n - 1;
  return null;
}

function normalizeHeader(raw: unknown): keyof typeof MAIN_HEADERS | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  return HEADER_ALIASES[s] ?? null;
}

function parseType(s: string): boolean {
  const v = s.trim().toLowerCase();
  return ["організація", "організації", "орг", "org", "юр", "юр.особа", "юридична особа"].includes(v);
}

function parseDelivery(s: string): "ADDRESS" | "PICKUP" {
  const v = s.trim().toLowerCase();
  if (["самовивіз", "самовивоз", "pickup", "видача", "відділення"].includes(v)) return "PICKUP";
  return "ADDRESS";
}

// Кількість примірників у клітинці місяця: порожньо → 0. Повертає null при
// некоректному значенні (нечисло / від'ємне / дробове).
function parseQty(s: string): number | null {
  const v = s.trim();
  if (!v) return 0;
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

function readPublicationSheet(wb: ExcelJS.Workbook): Record<string, string> {
  const names: Record<string, string> = {};
  const ws = wb.getWorksheet("Видання");
  if (!ws) return names;
  // Знайти колонки Код / Назва.
  let codeCol = 0;
  let nameCol = 0;
  let headerRow = 0;
  for (let i = 1; i <= Math.min(ws.rowCount, 10); i++) {
    const row = ws.getRow(i);
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const s = cellToString(cell.value).toLowerCase();
      if (s === "код") codeCol = col;
      else if (s === "назва") nameCol = col;
    });
    if (codeCol && nameCol) {
      headerRow = i;
      break;
    }
    codeCol = 0;
    nameCol = 0;
  }
  if (!headerRow) return names;
  for (let i = headerRow + 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const code = cellToString(row.getCell(codeCol).value);
    const name = cellToString(row.getCell(nameCol).value);
    if (code && name) names[code] = name;
  }
  return names;
}

export async function parseSubscriptionsXlsx(buffer: ArrayBuffer): Promise<SubParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet("Передплати") ?? wb.worksheets[0];
  if (!ws) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, message: "Файл не містить аркушів" }],
      publicationNames: {},
      skippedEmpty: 0,
    };
  }

  const publicationNames = readPublicationSheet(wb);

  // Знайти рядок заголовків: ≥4 відомі колонки.
  let headerRowIdx = 0;
  const headerMap: Partial<Record<keyof typeof MAIN_HEADERS, number>> = {};
  const monthCols: Record<number, number> = {}; // monthIndex → column
  for (let i = 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const map: Partial<Record<keyof typeof MAIN_HEADERS, number>> = {};
    const months: Record<number, number> = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const norm = normalizeHeader(cell.value);
      if (norm) map[norm] = col;
      const mi = monthIndexFromHeader(cellToString(cell.value));
      if (mi != null) months[mi] = col;
    });
    if (Object.keys(map).length >= 4) {
      headerRowIdx = i;
      Object.assign(headerMap, map);
      Object.assign(monthCols, months);
      break;
    }
  }

  if (!headerRowIdx) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 0,
          message:
            "Не знайдено рядок із заголовками. Очікувані колонки: Рік, Код видання, ПІБ, Доставка, 01…12",
        },
      ],
      publicationNames,
      skippedEmpty: 0,
    };
  }

  const errors: SubRowError[] = [];
  for (const req of ["year", "code", "fullName"] as const) {
    if (!headerMap[req]) {
      errors.push({
        rowNumber: headerRowIdx,
        message: `Відсутня обов'язкова колонка "${MAIN_HEADERS[req]}"`,
      });
    }
  }
  if (Object.keys(monthCols).length < 12) {
    errors.push({
      rowNumber: headerRowIdx,
      message: `Знайдено лише ${Object.keys(monthCols).length}/12 колонок місяців (01…12)`,
    });
  }
  if (errors.length) return { rows: [], errors, publicationNames, skippedEmpty: 0 };

  const get = (row: ExcelJS.Row, key: keyof typeof MAIN_HEADERS): string => {
    const col = headerMap[key];
    if (!col) return "";
    return cellToString(row.getCell(col).value);
  };

  const rows: ParsedSubRow[] = [];
  let skippedEmpty = 0;

  for (let i = headerRowIdx + 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const yearRaw = get(row, "year");
    const code = get(row, "code");
    const fullName = get(row, "fullName");

    // Зчитати місяці.
    const months = new Array<number>(12).fill(0);
    let monthErr: string | null = null;
    for (let m = 0; m < 12; m++) {
      const col = monthCols[m];
      const q = parseQty(cellToString(row.getCell(col).value));
      if (q == null) {
        monthErr = `Некоректна кількість у місяці ${String(m + 1).padStart(2, "0")}`;
        break;
      }
      months[m] = q;
    }

    const totalMonths = months.reduce((a, b) => a + b, 0);

    // Порожній рядок (жодного значущого поля) — тихо пропускаємо.
    if (!yearRaw && !code && !fullName && totalMonths === 0) continue;

    if (monthErr) {
      errors.push({ rowNumber: i, message: monthErr });
      continue;
    }
    if (!fullName) {
      errors.push({ rowNumber: i, message: "Порожнє ПІБ" });
      continue;
    }
    if (!code) {
      errors.push({ rowNumber: i, message: "Порожній код видання" });
      continue;
    }
    const year = Number(yearRaw);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      errors.push({ rowNumber: i, message: `Некоректний рік: "${yearRaw}" (треба 2000..2100)` });
      continue;
    }

    // Усі місяці нульові — передплату не створюємо.
    if (totalMonths === 0) {
      skippedEmpty++;
      continue;
    }

    const deliveryMode = parseDelivery(get(row, "delivery"));
    rows.push({
      rowNumber: i,
      year,
      publicationCode: code,
      fullName,
      isOrganization: parseType(get(row, "type")),
      phone: get(row, "phone") || null,
      street: get(row, "street") || null,
      number: get(row, "house") || null,
      corpus: get(row, "corpus") || null,
      apartment: get(row, "apartment") || null,
      deliveryMode,
      months,
    });
  }

  return { rows, errors, publicationNames, skippedEmpty };
}

// ── Шаблон ────────────────────────────────────────────────────────────────

const MONTH_HEADERS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MONTH_UK = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];

const TEMPLATE_HEADERS = [
  "Рік",
  "Код видання",
  "Назва видання",
  "ПІБ",
  "Тип",
  "Телефон",
  "Вулиця",
  "Буд.",
  "Кор.",
  "Кв.",
  "Доставка",
  ...MONTH_HEADERS,
  "Всього",
];

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E78" },
};
const MONTH_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2E75B6" },
};

const DATA_ROWS = 400;

export async function buildSubscriptionsTemplate(
  publications: { code: string; name: string; issuesPerMonth: number | null }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;

  // ── Інструкція ──
  const info = wb.addWorksheet("Інструкція", { views: [{ showGridLines: false }] });
  info.getColumn(1).width = 3;
  info.getColumn(2).width = 110;
  const infoLines: [string, string][] = [
    ["title", "Шаблон імпорту передплат"],
    ["p", "Заповнюйте аркуші «Видання» і «Передплати». Один рядок «Передплати» = одна передплата (передплатник × видання × рік)."],
    ["h", "Аркуш «Видання»"],
    ["p", "Довідник видань (Код · Назва · МСП). Якщо потрібного видання немає — додайте рядок унизу: Код і Назва обов'язкові. Код — каталожний індекс Укрпошти із заголовка блоку на папері."],
    ["h", "Аркуш «Передплати» — колонки"],
    ["li", "Рік — рік передплати (напр. 2026)."],
    ["li", "Код видання — оберіть код зі списку (випадайка). Назва підтягнеться автоматично для звірки."],
    ["li", "ПІБ — прізвище ім'я по батькові або назва організації."],
    ["li", "Тип — «Особа» або «Організація»."],
    ["li", "Телефон — окремо від ПІБ (на папері часто дописаний у клітинці ПІБ)."],
    ["li", "Вулиця / Буд. / Кор. / Кв. — адреса. Застосунок сам прив'яже до будинку дільниці або збереже як текст (поза дільницею)."],
    ["li", "Доставка — «На адресу» або «Самовивіз». Для «Відділення ДО»/«Начальнику відділення»/КП без адреси — «Самовивіз», адресу лишіть порожньою."],
    ["li", "01…12 — кількість примірників на місяць (01 = січень … 12 = грудень). 0 або порожньо = немає передплати. Рядок з усіма нулями застосунок пропустить."],
    ["li", "Всього — рахується автоматично, для звірки. Не заповнюйте."],
    ["h", "Приклад рядка"],
    ["p", "2026 | 40224 | Миронова Ірина Миколаївна | Особа | 0995077409 | Торгова | 2-А | | | На адресу | 1 1 1 1 1 1 1 1 1 1 1 1"],
    ["p", "Повторний імпорт того самого року оновлює кількості, дублів не створює. Передплатник розпізнається за ПІБ+адресою; на кроці підтвердження ви вирішуєте, прив'язати до наявного чи створити нового."],
  ];
  let ir = 1;
  for (const [kind, text] of infoLines) {
    const c = info.getCell(ir, 2);
    c.value = kind === "li" ? `•  ${text}` : text;
    if (kind === "title") c.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1F4E78" } };
    else if (kind === "h") c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1F4E78" } };
    else c.font = { name: "Arial", size: 10 };
    c.alignment = { wrapText: true, vertical: "top" };
    if (kind === "li" || kind === "p") info.getRow(ir).height = 28;
    ir++;
  }

  // ── Видання ──
  const pubs = wb.addWorksheet("Видання", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  pubs.columns = [
    { header: "Код", width: 12 },
    { header: "Назва", width: 62 },
    { header: "МСП", width: 8 },
    { header: "Примітки", width: 30 },
  ];
  pubs.getRow(1).eachCell((cell) => {
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "center" };
  });
  for (const p of publications) {
    pubs.addRow([p.code, p.name, p.issuesPerMonth ?? null, null]);
  }
  const lastPubRow = 1 + Math.max(publications.length, 0) + 200; // запас на нові видання

  // ── Передплати ──
  const ws = wb.addWorksheet("Передплати", { views: [{ state: "frozen", xSplit: 4, ySplit: 1, showGridLines: false }] });
  ws.columns = TEMPLATE_HEADERS.map((h, i) => ({
    header: h,
    width: [7, 13, 34, 30, 13, 15, 18, 8, 7, 7, 13][i] ?? (i >= 11 && i <= 22 ? 5 : 8),
  }));
  ws.getRow(1).eachCell((cell, col) => {
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = col >= 12 && col <= 23 ? MONTH_FILL : HEADER_FILL;
    cell.alignment = { horizontal: "center", wrapText: true };
    // Українська назва місяця як коментар до заголовка.
    if (col >= 12 && col <= 23) {
      cell.note = MONTH_UK[col - 12] + "ень/ий";
    }
  });

  // Формули-помічники + рамки на область даних.
  for (let r = 2; r <= DATA_ROWS + 1; r++) {
    ws.getCell(r, 3).value = { formula: `IFERROR(VLOOKUP(B${r},Видання!$A:$B,2,FALSE),"")` };
    ws.getCell(r, 24).value = { formula: `IF(COUNT(L${r}:W${r})=0,"",SUM(L${r}:W${r}))` };
    ws.getCell(r, 3).font = { name: "Arial", size: 10, color: { argb: "FF808080" } };
  }

  // Валідації.
  for (let r = 2; r <= DATA_ROWS + 1; r++) {
    ws.getCell(r, 1).dataValidation = {
      type: "whole",
      operator: "between",
      allowBlank: true,
      formulae: [2000, 2100],
      error: "Рік — ціле число (напр. 2026).",
      errorTitle: "Некоректний рік",
    };
    ws.getCell(r, 2).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`Видання!$A$2:$A$${lastPubRow}`],
      error: "Оберіть код зі списку на аркуші «Видання» (або додайте нове видання там).",
      errorTitle: "Невідомий код",
    };
    ws.getCell(r, 5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Особа,Організація"'],
    };
    ws.getCell(r, 11).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"На адресу,Самовивіз"'],
    };
    for (let c = 12; c <= 23; c++) {
      ws.getCell(r, c).dataValidation = {
        type: "whole",
        operator: "between",
        allowBlank: true,
        formulae: [0, 999],
        error: "Кількість примірників — ціле число 0–999.",
        errorTitle: "Некоректна кількість",
      };
    }
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
