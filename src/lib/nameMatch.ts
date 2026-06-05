// Fuzzy-матчинг ФІО пенсіонерів у межах одного будинку.
//
// Excel-файли з виплатами часто містять різнобій у написанні ФІО: латинська
// "o" замість кириличної, плутанина з апострофами, відсутнє по батькові,
// перестановки слів. Тут утиліти, які нормалізують рядок і знаходять
// найбільш імовірного пенсіонера серед 1-5 жителів будинку.
//
// Архітектурно повторює `findBuildingByAddress` зі `streetMatch.ts` —
// той самий набір варіантів результату (`exact|fuzzy|ambiguous|none`).

// Зводить ФІО до канонічної форми: lowercase, уніфіковані апострофи, ё→е,
// пунктуація та крапки → пробіл, колапс пробілів.
// Свідомо НЕ робимо й→и / і→и — це псує українські імена; одиничні літери
// поглинаються Levenshtein-допуском.
export function normalizeName(input: string): string {
  if (!input) return "";
  let s = input.toLowerCase().trim();
  s = s.replace(/[\u02BC\u02B9\u02BB\u2019\u2018\u0060\u00B4'`]/g, "'");
  s = s.replace(/ё/g, "е");
  s = s.replace(/\./g, " ");
  s = s.replace(/[,;:!?"«»“”]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Розбити ФІО на токени. Видаляємо однолітерні ініціали, якщо лишається
// ≥2 «довгих» токенів — інакше зберігаємо все, що є. Сортуємо токени,
// щоб порядок слів («Петро Іваненко» vs «Іваненко Петро») не впливав.
export function tokenizeName(input: string): string[] {
  const norm = normalizeName(input);
  if (!norm) return [];
  const raw = norm.split(/\s+/).filter(Boolean);
  const longTokens = raw.filter((t) => t.length > 1);
  const tokens = longTokens.length >= 2 ? longTokens : raw;
  return [...tokens].sort();
}

// Класичний Levenshtein з ранньою зупинкою при перевищенні `limit`.
export function levenshtein(a: string, b: string, limit?: number): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  if (limit != null && Math.abs(al - bl) > limit) return limit + 1;

  let prev = new Array<number>(bl + 1);
  let curr = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      let v = del < ins ? del : ins;
      if (sub < v) v = sub;
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (limit != null && rowMin > limit) return limit + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

// Скільки помилок дозволяємо в одному токені залежно від довжини.
// Короткі імена (Лев, Іван) — без допуску; середні — 1; довгі — 2.
export function tokenAllowance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

export type NameTokensMatch = { ok: boolean; totalDistance: number };

// Перевіряє, чи відповідають два набори (вже відсортованих) токенів один
// одному. Кількість токенів має збігатися — інакше відмова. Для кожної
// пари токенів обчислюємо Levenshtein і порівнюємо з власним бюджетом
// (за довшим токеном — щоб не штрафувати скорочення довгого імені).
export function nameTokensMatch(
  aTokens: string[],
  bTokens: string[]
): NameTokensMatch {
  if (aTokens.length === 0 || bTokens.length === 0) {
    return { ok: false, totalDistance: Number.POSITIVE_INFINITY };
  }
  if (aTokens.length !== bTokens.length) {
    return { ok: false, totalDistance: Number.POSITIVE_INFINITY };
  }
  let total = 0;
  for (let i = 0; i < aTokens.length; i++) {
    const x = aTokens[i];
    const y = bTokens[i];
    const allow = tokenAllowance(Math.max(x.length, y.length));
    const d = levenshtein(x, y, allow);
    if (d > allow) {
      return { ok: false, totalDistance: Number.POSITIVE_INFINITY };
    }
    total += d;
  }
  return { ok: true, totalDistance: total };
}

export type PensionerForNameMatch = { id: number; fullName: string };

export type NameMatchCandidate = {
  id: number;
  fullName: string;
  distance: number;
};

export type NameMatchResult =
  | { kind: "exact"; id: number; fullName: string }
  | { kind: "fuzzy"; candidates: NameMatchCandidate[] }
  | { kind: "ambiguous"; candidates: NameMatchCandidate[] }
  | { kind: "none" };

// Шукає пенсіонера в межах одного будинку.
// - exact: повний збіг нормалізованих токенів (порядок ігноруємо).
// - fuzzy: рівно один кандидат у межах per-token допуску.
// - ambiguous: ≥2 кандидати в межах допуску (відсортовано за зростанням distance).
// - none: жоден кандидат не пройшов.
export function findPensionerInBuilding(
  pensioners: PensionerForNameMatch[],
  fullName: string
): NameMatchResult {
  if (pensioners.length === 0) return { kind: "none" };
  const target = tokenizeName(fullName);
  if (target.length === 0) return { kind: "none" };

  const exact: { id: number; fullName: string }[] = [];
  const candidates: NameMatchCandidate[] = [];

  for (const p of pensioners) {
    const pt = tokenizeName(p.fullName);
    if (pt.length === 0) continue;
    if (
      pt.length === target.length &&
      pt.every((t, i) => t === target[i])
    ) {
      exact.push({ id: p.id, fullName: p.fullName });
      continue;
    }
    const m = nameTokensMatch(target, pt);
    if (m.ok) {
      candidates.push({ id: p.id, fullName: p.fullName, distance: m.totalDistance });
    }
  }

  if (exact.length === 1) {
    return { kind: "exact", id: exact[0].id, fullName: exact[0].fullName };
  }
  if (exact.length > 1) {
    // Однофамільці з ідентичними нормалізованими токенами — рідко, але
    // трактуємо як ambiguous, щоб користувач явно обрав.
    return {
      kind: "ambiguous",
      candidates: exact.map((e) => ({ id: e.id, fullName: e.fullName, distance: 0 })),
    };
  }

  candidates.sort((a, b) => a.distance - b.distance);
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length === 1) return { kind: "fuzzy", candidates };
  return { kind: "ambiguous", candidates };
}
