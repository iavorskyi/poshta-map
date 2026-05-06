"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  setSessionCookie,
  signSession,
  verifyPassword,
} from "@/lib/auth";

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!username || !password) {
    return { error: "Введіть логін і пароль" };
  }

  const postman = await prisma.postman.findUnique({
    where: { username },
    select: { id: true, passwordHash: true },
  });

  if (!postman || !postman.passwordHash) {
    return { error: "Невірний логін або пароль" };
  }

  const ok = await verifyPassword(password, postman.passwordHash);
  if (!ok) {
    return { error: "Невірний логін або пароль" };
  }

  const token = await signSession({ postmanId: postman.id });
  await setSessionCookie(token);

  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(safeNext);
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
