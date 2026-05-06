"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { canEditPensioner, canEditRound } from "@/lib/permissions";

type InitialPaymentInput = {
  pensionerId: number;
  paymentId: number;
  amount: number;
  existingId?: number;
  isPaid?: boolean;
};

export async function createRound(formData: FormData) {
  const me = await requireUser();
  const dateStr = String(formData.get("date") ?? "").trim();
  const postmanIdRaw = String(formData.get("postmanId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const initialRaw = String(formData.get("initialPayments") ?? "[]");

  if (!dateStr) return { error: "Оберіть дату обходу" };
  const date = fromDateInputValue(dateStr);

  // Не-адмін створює обхід завжди на себе
  const postmanId = me.isAdmin
    ? postmanIdRaw
      ? Number(postmanIdRaw)
      : null
    : me.id;

  let initial: InitialPaymentInput[] = [];
  try {
    initial = JSON.parse(initialRaw);
  } catch {
    initial = [];
  }

  // Перевіряємо, що всі залучені пенсіонери підпадають під права
  if (!me.isAdmin && initial.length > 0) {
    const pensIds = Array.from(new Set(initial.map((p) => p.pensionerId)));
    const pens = await prisma.pensioner.findMany({
      where: { id: { in: pensIds } },
      select: { id: true, postmanId: true },
    });
    for (const p of pens) {
      if (!canEditPensioner(me, p)) {
        return { error: "У списку є пенсіонер, якого ви не можете редагувати" };
      }
    }
  }

  const existing = initial.filter((p) => p.existingId);
  const fresh = initial.filter((p) => !p.existingId);

  const round = await prisma.$transaction(async (tx) => {
    const created = await tx.round.create({
      data: {
        date,
        postmanId,
        notes,
        currentPayments: {
          create: fresh.map((p) => ({
            pensionerId: p.pensionerId,
            paymentId: p.paymentId,
            amount: p.amount,
            date,
          })),
        },
      },
    });

    for (const p of existing) {
      await tx.currentPayment.update({
        where: { id: p.existingId! },
        data: p.isPaid
          ? { roundId: created.id }
          : {
              roundId: created.id,
              paymentId: p.paymentId,
              amount: p.amount,
            },
      });
    }

    return created;
  });

  revalidatePath("/rounds");
  revalidatePath("/current-payments");
  redirect(`/rounds/${round.id}`);
}

async function loadRoundAndCheck(id: number) {
  const me = await requireUser();
  const round = await prisma.round.findUnique({
    where: { id },
    select: { postmanId: true },
  });
  if (!round) return { error: "Обхід не знайдено" as const };
  if (!canEditRound(me, round)) {
    return { error: "Недостатньо прав" as const };
  }
  return { ok: true as const, me, round };
}

export async function setRoundClosed(id: number, closed: boolean) {
  const check = await loadRoundAndCheck(id);
  if ("error" in check) return { error: check.error };
  try {
    await prisma.round.update({
      where: { id },
      data: { closedAt: closed ? new Date() : null },
    });
  } catch (e) {
    return {
      error: `Не вдалося ${closed ? "закрити" : "відкрити"} обхід: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath(`/rounds/${id}`);
  revalidatePath("/rounds");
  return { ok: true };
}

export async function deleteRound(id: number) {
  const check = await loadRoundAndCheck(id);
  if ("error" in check) return { error: check.error };
  try {
    await prisma.round.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити обхід: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath("/rounds");
  return { ok: true };
}

export async function updateRoundMeta(
  id: number,
  data: { date?: string; postmanId?: number | null; notes?: string | null }
) {
  const check = await loadRoundAndCheck(id);
  if ("error" in check) return { error: check.error };
  const { me } = check;

  const patch: { date?: Date; postmanId?: number | null; notes?: string | null } = {};
  if (data.date) patch.date = fromDateInputValue(data.date);
  // Не-адмін не може передавати обхід іншому листоноші
  if (data.postmanId !== undefined && me.isAdmin) {
    patch.postmanId = data.postmanId;
  }
  if (data.notes !== undefined) patch.notes = data.notes;
  await prisma.round.update({ where: { id }, data: patch });
  revalidatePath(`/rounds/${id}`);
  revalidatePath("/rounds");
  return { ok: true };
}

export async function addCurrentPayment(
  roundId: number,
  data: { pensionerId: number; paymentId: number; amount: number; date?: string }
) {
  const me = await requireUser();
  if (!data.pensionerId || !data.paymentId) return { error: "Оберіть пенсіонера і тип виплати" };
  if (data.amount == null || Number.isNaN(data.amount) || data.amount < 0)
    return { error: "Сума має бути невід'ємною" };

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, date: true, postmanId: true },
  });
  if (!round) return { error: "Обхід не знайдено" };
  if (!canEditRound(me, round)) return { error: "Недостатньо прав" };

  const pensioner = await prisma.pensioner.findUnique({
    where: { id: data.pensionerId },
    select: { postmanId: true },
  });
  if (!pensioner) return { error: "Пенсіонера не знайдено" };
  if (!canEditPensioner(me, pensioner)) {
    return { error: "Цей пенсіонер не з ваших" };
  }

  await prisma.currentPayment.create({
    data: {
      roundId,
      pensionerId: data.pensionerId,
      paymentId: data.paymentId,
      amount: data.amount,
      date: data.date ? fromDateInputValue(data.date) : round.date,
    },
  });
  revalidatePath(`/rounds/${roundId}`);
  return { ok: true };
}

export async function addPensionerToRound(roundId: number, pensionerId: number) {
  const me = await requireUser();
  if (!pensionerId) return { error: "Оберіть пенсіонера" };

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      date: true,
      postmanId: true,
      currentPayments: { select: { pensionerId: true, paymentId: true } },
    },
  });
  if (!round) return { error: "Обхід не знайдено" };
  if (!canEditRound(me, round)) return { error: "Недостатньо прав" };

  const pensioner = await prisma.pensioner.findUnique({
    where: { id: pensionerId },
    select: { postmanId: true },
  });
  if (!pensioner) return { error: "Пенсіонера не знайдено" };
  if (!canEditPensioner(me, pensioner)) return { error: "Цей пенсіонер не з ваших" };

  const monthStart = new Date(
    round.date.getFullYear(),
    round.date.getMonth(),
    1
  );
  const monthEnd = new Date(
    round.date.getFullYear(),
    round.date.getMonth() + 1,
    1
  );

  const inRoundPaymentIds = new Set(
    round.currentPayments
      .filter((cp) => cp.pensionerId === pensionerId)
      .map((cp) => cp.paymentId)
  );

  const monthCps = await prisma.currentPayment.findMany({
    where: {
      pensionerId,
      date: { gte: monthStart, lt: monthEnd },
    },
  });

  const paidIds = new Set(
    monthCps.filter((cp) => cp.isPaid).map((cp) => cp.paymentId)
  );

  const unpaidToAttach = monthCps.filter(
    (cp) =>
      !cp.isPaid && cp.roundId !== roundId && !inRoundPaymentIds.has(cp.paymentId)
  );

  const allCps = await prisma.currentPayment.findMany({
    where: { pensionerId },
    orderBy: { date: "desc" },
    select: { paymentId: true, amount: true },
  });
  const seen = new Set<number>();
  const templates: { paymentId: number; amount: number }[] = [];
  for (const cp of allCps) {
    if (seen.has(cp.paymentId)) continue;
    seen.add(cp.paymentId);
    templates.push({ paymentId: cp.paymentId, amount: cp.amount });
  }
  const willAttachIds = new Set(unpaidToAttach.map((cp) => cp.paymentId));
  const templatesToCreate = templates.filter(
    (t) =>
      !paidIds.has(t.paymentId) &&
      !inRoundPaymentIds.has(t.paymentId) &&
      !willAttachIds.has(t.paymentId)
  );

  if (unpaidToAttach.length === 0 && templatesToCreate.length === 0) {
    return {
      error:
        "Немає виплат для додавання. Усі поточні виплати вже оплачено або вже в обході.",
    };
  }

  await prisma.$transaction([
    ...unpaidToAttach.map((cp) =>
      prisma.currentPayment.update({
        where: { id: cp.id },
        data: { roundId },
      })
    ),
    ...templatesToCreate.map((t) =>
      prisma.currentPayment.create({
        data: {
          roundId,
          pensionerId,
          paymentId: t.paymentId,
          amount: t.amount,
          date: round.date,
        },
      })
    ),
  ]);

  revalidatePath(`/rounds/${roundId}`);
  return {
    ok: true,
    attached: unpaidToAttach.length,
    created: templatesToCreate.length,
  };
}

export async function updateCurrentPayment(
  id: number,
  roundId: number,
  data: { amount?: number; isPaid?: boolean }
) {
  const check = await loadRoundAndCheck(roundId);
  if ("error" in check) return { error: check.error };
  await prisma.currentPayment.update({
    where: { id },
    data: {
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.isPaid !== undefined ? { isPaid: data.isPaid } : {}),
    },
  });
  revalidatePath(`/rounds/${roundId}`);
  return { ok: true };
}

export async function deleteCurrentPayment(id: number, roundId: number) {
  const check = await loadRoundAndCheck(roundId);
  if ("error" in check) return { error: check.error };
  try {
    await prisma.currentPayment.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити виплату: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath(`/rounds/${roundId}`);
  return { ok: true };
}
