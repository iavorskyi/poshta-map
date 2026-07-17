import { normalizePhone } from "@/lib/messengerLinks";

export type VCardPensioner = {
  id: number;
  fullName: string;
  phone: string | null;
  apartment: string | null;
  building: { street: string; number: string } | null;
};

/** Екранування значень vCard 3.0 (RFC 2426): \, ; , та переноси рядків. */
function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function addressLine(p: VCardPensioner): string | null {
  if (!p.building) return null;
  const apt = p.apartment ? `, кв. ${p.apartment}` : "";
  return `${p.building.street}, ${p.building.number}${apt}`;
}

function telValue(phone: string): string {
  const digits = normalizePhone(phone);
  return digits ? `+${digits}` : phone.trim();
}

function oneCard(p: VCardPensioner): string {
  const name = esc(p.fullName);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    // Маємо лише єдиний рядок ФІО — кладемо в family-поле N, решта порожні.
    `N:${name};;;;`,
    `FN:${name}`,
    "ORG:Пенсіонери",
    // Стабільний UID: CardDAV-клієнти за ним оновлюють картку, а не дублюють.
    `UID:pensioner-${p.id}@poshta-map`,
  ];
  if (p.phone) lines.push(`TEL;TYPE=CELL:${esc(telValue(p.phone))}`);
  const addr = addressLine(p);
  if (addr) lines.push(`ADR;TYPE=HOME:;;${esc(addr)};;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/** Збирає багатоконтактний vCard-файл (кожен пенсіонер — окрема картка). */
export function buildPensionersVCard(pensioners: VCardPensioner[]): string {
  return pensioners.map(oneCard).join("\r\n") + "\r\n";
}
