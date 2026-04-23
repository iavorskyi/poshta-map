import { fromDateInputValue, toDateInputValue } from "./format";

export function currentMonthRange(now: Date = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

/**
 * Parse inclusive date range from search params. Returns Date objects with
 * `to` set to end-of-day (23:59:59.999) so inclusive filtering works.
 * Falls back to current-month range if inputs are missing/invalid.
 */
export function parseRange(rawFrom?: string, rawTo?: string) {
  const fallback = currentMonthRange();
  const fromStr = rawFrom || fallback.from;
  const toStr = rawTo || fallback.to;

  const from = fromDateInputValue(fromStr);
  const toStart = fromDateInputValue(toStr);
  const to = new Date(toStart);
  to.setHours(23, 59, 59, 999);

  return { from, to, fromStr, toStr };
}
