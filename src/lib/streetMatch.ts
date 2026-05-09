// Розпізнавання вулиць з урахуванням різного написання.
//
// Користувачі і Excel-файли пишуть адреси по-різному: "вул. Шевченка",
// "вулиця Шевченка", "Шевченка", "пр-т Миру", "Проспект Миру", з різними
// апострофами тощо. Ця утиліта зводить написання до канонічної форми
// для пошуку та порівняння.

// Усі форми типу вулиці (без крапок — крапки знімаємо до співставлення).
const STREET_TYPE_TOKENS = [
  "вулиця",
  "вул",
  "проспект",
  "просп",
  "пр-т",
  "пр",
  "провулок",
  "пров",
  "переулок",
  "пер",
  "площа",
  "пл",
  "бульвар",
  "бульв",
  "б-р",
  "набережна",
  "наб",
  "шосе",
  "ш",
  "узвіз",
  "узв",
  "тупик",
  "туп",
  "майдан",
  "м-н",
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Регекс для зняття типу вулиці з початку або кінця рядка.
const TYPE_PREFIX_RE = new RegExp(
  `^(?:${STREET_TYPE_TOKENS.map(escapeRe).join("|")})(?:\\s+|$)`,
  "i"
);
const TYPE_SUFFIX_RE = new RegExp(
  `(?:\\s+|^)(?:${STREET_TYPE_TOKENS.map(escapeRe).join("|")})$`,
  "i"
);

// Зводить вулицю до канонічної форми для порівняння. Приклади:
//   "вул. Шевченка"            → "шевченка"
//   "Проспект Миру"            → "миру"
//   "пр-т Миру"                → "миру"
//   "Шевченка вулиця"          → "шевченка"
//   "вул. ім. Т. Шевченка"     → "т шевченка"
//   "Захисників України (1 Травня)" → "захисників україни"
export function normalizeStreet(input: string): string {
  if (!input) return "";
  let s = input.toLowerCase().trim();

  // Уніфікувати апострофи.
  s = s.replace(/[\u02BC\u02B9\u02BB\u2019\u2018\u0060\u00B4'`]/g, "'");

  // Російське ё → е (часта помилка локалізації).
  s = s.replace(/ё/g, "е");

  // Прибрати дужкові уточнення: "Захисників України (1 Травня)" → "Захисників України".
  s = s.replace(/\s*\([^)]*\)\s*/g, " ");

  // Прибрати крапки повністю (щоб "вул." = "вул", "пр." = "пр", "ім." = "ім").
  s = s.replace(/\./g, " ");

  // Решта пунктуації → пробіл.
  s = s.replace(/[,;:!?"«»“”]+/g, " ");

  // Колапс пробілів.
  s = s.replace(/\s+/g, " ").trim();

  // Прибрати "ім" / "імені" як окремі токени (можуть бути будь-де).
  // Використовуємо lookarounds, бо JS \b не працює з кирилицею.
  s = s.replace(/(^|\s)ім(?:ені)?(?=\s|$)/g, "$1").replace(/\s+/g, " ").trim();

  // Жадібно знімати тип вулиці з початку, поки знімається.
  while (TYPE_PREFIX_RE.test(s)) {
    s = s.replace(TYPE_PREFIX_RE, "").trimStart();
  }
  // Те саме з кінця ("Шевченка вулиця").
  while (TYPE_SUFFIX_RE.test(s)) {
    s = s.replace(TYPE_SUFFIX_RE, "").trimEnd();
  }

  return s.trim();
}

// Канонічна форма номера будинку: "12А" / "12 а" / "12-а" → "12а".
export function normalizeNumber(input: string): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_]+/g, "")
    .trim();
}

function streetTokens(s: string): string[] {
  const norm = normalizeStreet(s);
  if (!norm) return [];
  return norm.split(/\s+/).filter(Boolean);
}

// Слова, які несуть мало смислу і не повинні бути єдиною підставою для
// loose-матчу (наприклад "1" з "1 Травня").
const WEAK_TOKENS = new Set([
  "святого",
  "святої",
  "великого",
  "великої",
]);

function isStrongToken(t: string): boolean {
  if (WEAK_TOKENS.has(t)) return false;
  // Числа окремо (наприклад "1", "8") — слабкі.
  if (/^\d+$/.test(t)) return false;
  // Однолітерні токени (ініціали) — слабкі.
  if (t.length <= 1) return false;
  return true;
}

// Перевірка: чи можуть назви вулиць посилатися на одну й ту ж вулицю.
// Спочатку точне співпадіння нормалізованих форм; якщо ні — токенна перевірка
// (одна назва є підмножиною іншої по сильним токенам).
export function streetMatchLoose(a: string, b: string): boolean {
  const an = normalizeStreet(a);
  const bn = normalizeStreet(b);
  if (!an || !bn) return false;
  if (an === bn) return true;

  const ta = streetTokens(a).filter(isStrongToken);
  const tb = streetTokens(b).filter(isStrongToken);
  if (ta.length === 0 || tb.length === 0) return false;

  const setA = new Set(ta);
  const setB = new Set(tb);
  const aSubsetB = ta.every((t) => setB.has(t));
  const bSubsetA = tb.every((t) => setA.has(t));
  return aSubsetB || bSubsetA;
}

export type BuildingForMatch = { id: number; street: string; number: string };

export type AddressMatchResult =
  | { kind: "exact"; id: number }
  | { kind: "loose"; id: number; matchedStreet: string }
  | { kind: "ambiguous"; candidates: { id: number; street: string; number: string }[] }
  | { kind: "none" };

// Шукає будинок за вулицею + номером. Спочатку точне співпадіння за
// нормалізованою формою; якщо нема — loose-матч (одна назва — підмножина
// іншої). Якщо loose-кандидатів декілька — повертає ambiguous.
export function findBuildingByAddress(
  buildings: BuildingForMatch[],
  street: string,
  number: string
): AddressMatchResult {
  const nStreet = normalizeStreet(street);
  const nNumber = normalizeNumber(number);
  if (!nStreet || !nNumber) return { kind: "none" };

  const sameNumber = buildings.filter(
    (b) => normalizeNumber(b.number) === nNumber
  );

  // Спочатку точне співпадіння нормалізованої назви.
  for (const b of sameNumber) {
    if (normalizeStreet(b.street) === nStreet) {
      return { kind: "exact", id: b.id };
    }
  }

  // Loose-матч.
  const looseMatches = sameNumber.filter((b) =>
    streetMatchLoose(b.street, street)
  );
  if (looseMatches.length === 1) {
    return {
      kind: "loose",
      id: looseMatches[0].id,
      matchedStreet: looseMatches[0].street,
    };
  }
  if (looseMatches.length > 1) {
    return {
      kind: "ambiguous",
      candidates: looseMatches.map((b) => ({
        id: b.id,
        street: b.street,
        number: b.number,
      })),
    };
  }

  return { kind: "none" };
}
