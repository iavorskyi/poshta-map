import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "phs";
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 днів

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 8) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set an 8+ character secret in env."
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: number;
  name: string;
  username: string | null;
  isAdmin: boolean;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSession(payload: { postmanId: number }): Promise<string> {
  return await new SignJWT({ pid: payload.postmanId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string
): Promise<{ postmanId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.pid !== "number") return null;
    return { postmanId: payload.pid };
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const verified = await verifySession(token);
  if (!verified) return null;
  const postman = await prisma.postman.findUnique({
    where: { id: verified.postmanId },
    select: { id: true, name: true, username: true, isAdmin: true },
  });
  return postman;
});

export async function requireUser(): Promise<SessionUser> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  return me;
}

export async function requireAdmin(): Promise<SessionUser> {
  const me = await requireUser();
  if (!me.isAdmin) redirect("/");
  return me;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
