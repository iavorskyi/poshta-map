"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createPostman(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Ім'я обов'язкове" };
  await prisma.postman.create({ data: { name } });
  revalidatePath("/postmen");
  return { ok: true };
}

export async function deletePostman(id: number) {
  try {
    await prisma.postman.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити поштаря: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath("/postmen");
  return { ok: true };
}
