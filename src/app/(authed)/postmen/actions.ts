"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin, requireUser, verifyPassword } from "@/lib/auth";

export async function createPostman(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Ім'я обов'язкове" };
  await prisma.postman.create({ data: { name } });
  revalidatePath("/postmen");
  return { ok: true };
}

export async function deletePostman(id: number) {
  await requireAdmin();
  try {
    await prisma.postman.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити листоношу: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath("/postmen");
  return { ok: true };
}

export async function updatePostmanName(id: number, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Ім'я обов'язкове" };
  await prisma.postman.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/postmen");
  return { ok: true };
}

export async function updatePostmanPhone(id: number, phone: string) {
  await requireAdmin();
  const trimmed = phone.trim();
  try {
    await prisma.postman.update({
      where: { id },
      data: { phone: trimmed || null },
    });
  } catch (e) {
    return {
      error: `Не вдалося зберегти телефон: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath("/postmen");
  return { ok: true };
}

export async function setPostmanCredentials(
  id: number,
  username: string,
  password: string
) {
  await requireAdmin();
  const u = username.trim();
  if (!u) return { error: "Логін обов'язковий" };
  if (password.length < 6) return { error: "Пароль має бути не менше 6 символів" };

  const existing = await prisma.postman.findUnique({
    where: { username: u },
    select: { id: true },
  });
  if (existing && existing.id !== id) {
    return { error: "Такий логін вже використовується" };
  }

  const passwordHash = await hashPassword(password);
  await prisma.postman.update({
    where: { id },
    data: { username: u, passwordHash },
  });
  revalidatePath("/postmen");
  return { ok: true };
}

export async function clearPostmanCredentials(id: number) {
  await requireAdmin();
  try {
    await prisma.postman.update({
      where: { id },
      data: { username: null, passwordHash: null },
    });
  } catch (e) {
    return {
      error: `Не вдалося скинути доступ: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath("/postmen");
  return { ok: true };
}

export async function setPostmanAdmin(id: number, isAdmin: boolean) {
  const me = await requireAdmin();
  if (me.id === id && !isAdmin) {
    return { error: "Не можна забрати в себе адмінські права" };
  }
  if (!isAdmin) {
    const adminCount = await prisma.postman.count({ where: { isAdmin: true } });
    if (adminCount <= 1) {
      return { error: "Не можна знести останнього адміна" };
    }
  }
  await prisma.postman.update({ where: { id }, data: { isAdmin } });
  revalidatePath("/postmen");
  return { ok: true };
}

export async function changeOwnPassword(
  oldPassword: string,
  newPassword: string
) {
  const me = await requireUser();
  if (newPassword.length < 6) {
    return { error: "Новий пароль має бути не менше 6 символів" };
  }
  const postman = await prisma.postman.findUnique({
    where: { id: me.id },
    select: { passwordHash: true },
  });
  if (!postman?.passwordHash) {
    return { error: "Пароль не встановлено. Зверніться до адміна." };
  }
  const ok = await verifyPassword(oldPassword, postman.passwordHash);
  if (!ok) return { error: "Невірний поточний пароль" };
  const passwordHash = await hashPassword(newPassword);
  await prisma.postman.update({ where: { id: me.id }, data: { passwordHash } });
  return { ok: true };
}
