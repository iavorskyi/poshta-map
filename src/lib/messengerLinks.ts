/** Токен у шаблоні повідомлення, що замінюється назвою організації. */
export const ORG_NAME_TOKEN = "{організація}";

/** Дефолтний шаблон, якщо глобальне налаштування ще не задане. */
export const DEFAULT_ORG_MESSAGE_TEMPLATE =
  `Доброго дня! Це ваш листоноша. Для організації «${ORG_NAME_TOKEN}» є пошта у відділенні. Просимо забрати за зручної нагоди. Дякую!`;

/** Підставляє назву організації замість токена у шаблоні. */
export function renderTemplate(
  template: string | null | undefined,
  orgName: string
): string {
  if (!template) return "";
  return template.split(ORG_NAME_TOKEN).join(orgName);
}

/**
 * Нормалізує телефон до цифр з кодом країни (для deep-links месенджерів).
 * Українські номери у форматі 0XXXXXXXXX приводяться до 380XXXXXXXXX.
 * Повертає null, якщо цифр замало для валідного номера.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D+/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "38" + digits;
  }
  return digits;
}

/** viber://chat — відкриває чат Viber із цим номером (якщо він там є). */
export function viberLink(phone: string | null | undefined): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `viber://chat?number=%2B${digits}`;
}

/** https://t.me/+phone — відкриває чат Telegram із цим номером (якщо він там є). */
export function telegramLink(phone: string | null | undefined): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `https://t.me/+${digits}`;
}
