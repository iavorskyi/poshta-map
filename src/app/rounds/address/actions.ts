"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/format";

export async function createAddressRound(formData: FormData) {
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

  let createdId: number;
  try {
    const created = await prisma.addressRound.create({
      data: {
        date: fromDateInputValue(date),
        postmanId: postmanIdRaw ? Number(postmanIdRaw) : null,
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
  try {
    await prisma.addressRound.update({
      where: { id },
      data: {
        date: fromDateInputValue(data.date),
        postmanId: data.postmanId,
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

export async function deleteAddressRound(id: number) {
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
