// Пошук організацій: один рядок-запит, який матчиться одразу по кільком
// полям (назва, адреса, ФІО/телефон контактів) з допуском на одруківки.
//
// База дрібна (десятки записів) — обчислюємо все в памʼяті без SQL-trigram.
// Для тексту нормалізуємо й токенізуємо за тим же кодом, що й fuzzy-матч
// пенсіонерів (див. `nameMatch.ts`), щоб не дублювати правила. Для телефонів
// порівнюємо лише цифри — не залежимо від форматів "+38 (066) ...".
import { tokenizeName, levenshtein, normalizeName } from "@/lib/nameMatch";

export type OrgSearchInput = {
  id: number;
  name: string;
  address: string | null;
  description: string | null;
  contacts: { name: string; phone: string | null; note: string | null }[];
};

export type OrgSearchHit<T extends OrgSearchInput> = {
  org: T;
  // Менше — краще. 0 — точне попадання, ≥1 — fuzzy/substring.
  score: number;
  matchedOn: "name" | "address" | "contact" | "phone";
};

function digits(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\D+/g, "");
}

// Скільки одруківок припустимо для рядка довжини n.
// Спрямовано бути менш строгим, ніж per-token бюджет з nameMatch (там 0/1/2),
// бо тут зіставляємо повну фразу/адресу, де довгі рядки переважно праві.
function totalAllowance(n: number): number {
  if (n <= 3) return 0;
  if (n <= 6) return 1;
  if (n <= 10) return 2;
  if (n <= 16) return 3;
  return 4;
}

// Скоринг текстового збігу: 0 — exact substring (нормалізований),
// інакше — мінімальна Levenshtein-відстань між токенами запиту та цільового
// тексту (sliding window). Повертає число або `null`, якщо не схоже.
function scoreText(queryNorm: string, target: string | null | undefined): number | null {
  if (!queryNorm) return 0;
  const tNorm = normalizeName(target ?? "");
  if (!tNorm) return null;
  if (tNorm.includes(queryNorm)) return 0;
  // Спробуємо посимвольний Levenshtein на токенах запиту проти всіх n-грам
  // тієї ж довжини в цілі. Це дешево і працює для «адміністрація» vs
  // «адміністрація» з опискою.
  const qTokens = tokenizeName(queryNorm);
  const tTokens = tokenizeName(tNorm);
  if (qTokens.length === 0 || tTokens.length === 0) return null;
  let best = Number.POSITIVE_INFINITY;
  for (const q of qTokens) {
    const allow = totalAllowance(q.length);
    let tokenBest = Number.POSITIVE_INFINITY;
    for (const t of tTokens) {
      const d = levenshtein(q, t, allow);
      if (d < tokenBest) tokenBest = d;
      if (tokenBest === 0) break;
    }
    // Якщо хоч один токен запиту нікуди не вліз — рядок не матчиться.
    if (tokenBest > allow) return null;
    if (tokenBest < best) best = tokenBest;
  }
  return best === Number.POSITIVE_INFINITY ? null : best + 1; // +1 щоб exact substring (0) завжди перемагав fuzzy
}

export function searchOrganizations<T extends OrgSearchInput>(
  orgs: T[],
  query: string
): OrgSearchHit<T>[] {
  const q = query.trim();
  if (!q) {
    return orgs.map((org) => ({ org, score: 0, matchedOn: "name" as const }));
  }
  const qNorm = normalizeName(q);
  const qDigits = digits(q);
  const hits: OrgSearchHit<T>[] = [];
  for (const org of orgs) {
    let bestScore: number | null = null;
    let bestOn: OrgSearchHit<T>["matchedOn"] = "name";

    const consider = (s: number | null, on: OrgSearchHit<T>["matchedOn"]) => {
      if (s == null) return;
      if (bestScore == null || s < bestScore) {
        bestScore = s;
        bestOn = on;
      }
    };

    // Текстові поля. Назва пріоритетніше — оцінюємо її першою з невеликим
    // бонусом (бо при рівному score сортування стабільне).
    consider(scoreText(qNorm, org.name), "name");
    consider(scoreText(qNorm, org.address), "address");
    consider(scoreText(qNorm, org.description), "address");

    // Контакти: ФІО + примітка fuzzy; телефон — лише substring по цифрам.
    for (const c of org.contacts) {
      consider(scoreText(qNorm, c.name), "contact");
      consider(scoreText(qNorm, c.note), "contact");
      if (qDigits.length >= 3) {
        const cd = digits(c.phone);
        if (cd && cd.includes(qDigits)) consider(0, "phone");
      }
    }

    if (bestScore != null) hits.push({ org, score: bestScore, matchedOn: bestOn });
  }
  // Менший score → ближче. Стабільно сортуємо за score, потім за назвою.
  hits.sort((a, b) => a.score - b.score || a.org.name.localeCompare(b.org.name, "uk"));
  return hits;
}
