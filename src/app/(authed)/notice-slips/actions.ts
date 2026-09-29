"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assert, canManageNoticeSlipDefaults } from "@/lib/permissions";
import { parseNoticeSlipXlsx, type NoticeSlipRow, type RowError } from "@/lib/noticeSlipImport";

type Result = { error: string } | { ok: true };

const BRANCH_ADDRESS_KEY = "noticeSlipBranchAddress";
const WORKING_HOURS_KEY = "noticeSlipWorkingHours";
const PHONE_KEY = "noticeSlipPhone";

export type NoticeSlipDefaults = {
  branchAddress: string;
  workingHours: string;
  phone: string;
};

export async function getNoticeSlipDefaults(): Promise<NoticeSlipDefaults> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [BRANCH_ADDRESS_KEY, WORKING_HOURS_KEY, PHONE_KEY] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    branchAddress: map.get(BRANCH_ADDRESS_KEY) ?? "",
    workingHours: map.get(WORKING_HOURS_KEY) ?? "",
    phone: map.get(PHONE_KEY) ?? "",
  };
}

export async function setNoticeSlipDefaults(formData: FormData): Promise<Result> {
  const me = await requireUser();
  assert(canManageNoticeSlipDefaults(me));
  const branchAddress = String(formData.get("branchAddress") ?? "").trim();
  const workingHours = String(formData.get("workingHours") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: BRANCH_ADDRESS_KEY },
      create: { key: BRANCH_ADDRESS_KEY, value: branchAddress },
      update: { value: branchAddress },
    }),
    prisma.appSetting.upsert({
      where: { key: WORKING_HOURS_KEY },
      create: { key: WORKING_HOURS_KEY, value: workingHours },
      update: { value: workingHours },
    }),
    prisma.appSetting.upsert({
      where: { key: PHONE_KEY },
      create: { key: PHONE_KEY, value: phone },
      update: { value: phone },
    }),
  ]);

  return { ok: true };
}

export type NoticeSlipImportPreview =
  | { ok: true; rows: NoticeSlipRow[]; errors: RowError[] }
  | { ok: false; error: string; parseErrors?: RowError[] };

export async function previewNoticeSlipImport(
  formData: FormData
): Promise<NoticeSlipImportPreview> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Файл не обрано" };
  }
  const buffer = await file.arrayBuffer();
  const { rows, errors } = await parseNoticeSlipXlsx(buffer);
  if (rows.length === 0) {
    return {
      ok: false,
      error: errors.length ? "У файлі немає коректних рядків" : "Файл порожній",
      parseErrors: errors,
    };
  }
  return { ok: true, rows, errors };
}
