"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { canEditAddressRound } from "@/lib/permissions";

async function loadRoundAndCheck(id: number) {
  const me = await requireUser();
  const round = await prisma.addressRound.findUnique({
    where: { id },
    select: { postmanId: true },
  });
  if (!round) return { error: "Обхід не знайдено" as const };
  if (!canEditAddressRound(me, round)) {
    return { error: "Недостатньо прав" as const };
  }
  return { ok: true as const, me, round };
}

export async function createAddressRound(formData: FormData) {
  const me = await requireUser();
  const date = String(formData.get("date") ?? "");
  const postmanIdRaw = String(formData.get("postmanId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const buildingIdsRaw = String(formData.get("buildingIds") ?? "");

  if (!date) return { error: "Вкажіть дату" };

  let buildingIds: number[] = [];
  try {
    buildingIds = buildingIdsRaw ? (JSON.parse(buildingIdsRaw) as number[]) : [];
  } catch {
    return { error: "Некоректний список будинків" };
  }

  const postmanId = me.isAdmin
    ? postmanIdRaw
      ? Number(postmanIdRaw)
      : null
    : me.id;

  let createdId: number;
  try {
    const created = await prisma.addressRound.create({
      data: {
        date: fromDateInputValue(date),
        postmanId,
        notes: notes || null,
        items: {
          create: buildingIds.map((bid, idx) => ({
            buildingId: bid,
            position: idx,
          })),
        },
      },
    });
    createdId = created.id;
  } catch (e) {
    return {
      error: `Не вдалося створити обхід: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }

  revalidatePath("/rounds");
  redirect(`/rounds/address/${createdId}`);
}

export async function updateAddressRoundMeta(
  id: number,
  data: { date: string; postmanId: number | null; notes: string | null }
) {
  const check = await loadRoundAndCheck(id);
  if ("error" in check) return { error: check.error };
  const { me } = check;
  try {
    await prisma.addressRound.update({
      where: { id },
      data: {
        date: fromDateInputValue(data.date),
        // Не-адмін не може передати обхід іншому
        ...(me.isAdmin ? { postmanId: data.postmanId } : {}),
        notes: data.notes,
      },
    });
  } catch (e) {
    return {
      error: `Не вдалося зберегти: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath(`/rounds/address/${id}`);
  revalidatePath("/rounds");
  return { ok: true };
}

export async function setAddressRoundClosed(id: number, closed: boolean) {
  const check = await loadRoundAndCheck(id);
  if ("error" in check) return { error: check.error };
  try {
    await prisma.addressRound.update({
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
  revalidatePath(`/rounds/address/${id}`);
  revalidatePath("/rounds");
  return { ok: true };
}

export async function deleteAddressRound(id: number) {
  const check = await loadRoundAndCheck(id);
  if ("error" in check) return { error: check.error };
  try {
    await prisma.addressRound.delete({ where: { id } });
  } catch (e) {
    return {
      error: `Не вдалося видалити: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath("/rounds");
  return { ok: true };
}

export async function addBuildingToAddressRound(
  roundId: number,
  buildingId: number
) {
  const check = await loadRoundAndCheck(roundId);
  if ("error" in check) return { error: check.error };
  try {
    const last = await prisma.addressRoundBuilding.findFirst({
      where: { roundId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    await prisma.addressRoundBuilding.create({
      data: {
        roundId,
        buildingId,
        position: (last?.position ?? -1) + 1,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique")) {
      return { error: "Цей будинок вже у списку" };
    }
    return {
      error: `Не вдалося додати будинок: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath(`/rounds/address/${roundId}`);
  return { ok: true };
}

export async function removeBuildingFromAddressRound(
  roundId: number,
  itemId: number
) {
  const check = await loadRoundAndCheck(roundId);
  if ("error" in check) return { error: check.error };
  try {
    await prisma.addressRoundBuilding.delete({ where: { id: itemId } });
  } catch (e) {
    return {
      error: `Не вдалося прибрати будинок: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath(`/rounds/address/${roundId}`);
  return { ok: true };
}

export async function toggleAddressRoundItemDone(
  roundId: number,
  itemId: number,
  done: boolean
) {
  const check = await loadRoundAndCheck(roundId);
  if ("error" in check) return { error: check.error };
  try {
    await prisma.addressRoundBuilding.update({
      where: { id: itemId },
      data: { done },
    });
  } catch (e) {
    return {
      error: `Не вдалося оновити статус: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath(`/rounds/address/${roundId}`);
  return { ok: true };
}

export async function updateAddressRoundItemNotes(
  roundId: number,
  itemId: number,
  notes: string | null
) {
  const check = await loadRoundAndCheck(roundId);
  if ("error" in check) return { error: check.error };
  try {
    await prisma.addressRoundBuilding.update({
      where: { id: itemId },
      data: { notes },
    });
  } catch (e) {
    return {
      error: `Не вдалося зберегти примітку: ${
        e instanceof Error ? e.message : "невідома помилка"
      }`,
    };
  }
  revalidatePath(`/rounds/address/${roundId}`);
  return { ok: true };
}
