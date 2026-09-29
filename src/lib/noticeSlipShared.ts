export type NoticeSlipItemType = "PLAIN" | "REGISTERED";

export type NoticeSlipPrintData = {
  key: string;
  name: string;
  address: string;
  itemType: NoticeSlipItemType;
  trackingNumber: string | null;
  branchAddress: string;
  workingHours: string;
  phone: string;
  dateStr: string;
};

// Дозволяє вводити адресу просто в дужках після ФІО, наприклад:
// "Іванов Іван Іванович (вул. Шевченка, 10, кв. 5)" -> ім'я без дужок + адреса.
export function extractAddressFromName(raw: string): {
  name: string;
  address: string | null;
} {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (!match) return { name: trimmed, address: null };
  const name = match[1].trim();
  const address = match[2].trim();
  if (!name || !address) return { name: trimmed, address: null };
  return { name, address };
}
