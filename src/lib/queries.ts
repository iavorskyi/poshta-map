import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const CACHE_TAGS = {
  payments: "ref:payments",
  postmen: "ref:postmen",
  publications: "ref:publications",
} as const;

/**
 * Список типів виплат. Дані рідко змінюються — кешуємо у пам'яті, інвалідація
 * через revalidateTag(CACHE_TAGS.payments) у `payments/actions.ts`.
 */
export const getCachedPayments = unstable_cache(
  async () => {
    return prisma.payment.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    });
  },
  ["ref-payments"],
  { tags: [CACHE_TAGS.payments] }
);

export type CachedPayment = Awaited<ReturnType<typeof getCachedPayments>>[number];

/**
 * Короткий список листонош (без авторизаційних полів). Інвалідація через
 * revalidateTag(CACHE_TAGS.postmen) у `postmen/actions.ts`. Сторінка
 * /postmen робить власний запит, бо потребує паролі/підрахунки.
 */
export const getCachedPostmen = unstable_cache(
  async () => {
    return prisma.postman.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  },
  ["ref-postmen"],
  { tags: [CACHE_TAGS.postmen] }
);

export type CachedPostman = Awaited<ReturnType<typeof getCachedPostmen>>[number];

/**
 * Видання (газети/журнали). Інвалідація через
 * revalidateTag(CACHE_TAGS.publications) у `subscriptions/publications/actions.ts`.
 */
export const getCachedPublications = unstable_cache(
  async () => {
    return prisma.publication.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, issuesPerMonth: true },
    });
  },
  ["ref-publications"],
  { tags: [CACHE_TAGS.publications] }
);

export type CachedPublication = Awaited<
  ReturnType<typeof getCachedPublications>
>[number];
