"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type TemplateInput = {
  paymentId: number;
  dayOfMonth: number;
  defaultAmount: number;
};

function parsePensionerForm(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const house = String(formData.get("house") ?? "").trim();
  const apartment = String(formData.get("apartment") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const passportNumber = String(formData.get("passportNumber") ?? "").trim() || null;
  const pensionPaymentDay = Number(formData.get("pensionPaymentDay") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const templatesRaw = String(formData.get("templates") ?? "[]");
  let templates: TemplateInput[] = [];
  try {
    templates = JSON.parse(templatesRaw);
  } catch {
    templates = [];
  }

  return { fullName, street, house, apartment, phone, passportNumber, pensionPaymentDay, notes, templates };
}

function validate(data: ReturnType<typeof parsePensionerForm>) {
  if (!data.fullName) return "ФІО обов'язкове";
  if (!data.street || !data.house) return "Вулиця і номер будинку обов'язкові";
  if (!data.pensionPaymentDay || data.pensionPaymentDay < 1 || data.pensionPaymentDay > 31)
    return "День виплати пенсії має бути 1..31";
  for (const t of data.templates) {
    if (!t.paymentId) return "Вкажіть тип виплати у шаблоні";
    if (!t.dayOfMonth || t.dayOfMonth < 1 || t.dayOfMonth > 31)
      return "День шаблону має бути 1..31";
    if (t.defaultAmount == null || Number.isNaN(t.defaultAmount) || t.defaultAmount < 0)
      return "Сума шаблону має бути невід'ємною";
  }
  return null;
}

export async function createPensioner(formData: FormData) {
  const data = parsePensionerForm(formData);
  const err = validate(data);
  if (err) return { error: err };

  const { templates, ...fields } = data;
  const created = await prisma.pensioner.create({
    data: {
      ...fields,
      templates: {
        create: templates.map((t) => ({
          paymentId: t.paymentId,
          dayOfMonth: t.dayOfMonth,
          defaultAmount: t.defaultAmount,
        })),
      },
    },
  });
  revalidatePath("/pensioners");
  redirect(`/pensioners/${created.id}`);
}

export async function updatePensioner(id: number, formData: FormData) {
  const data = parsePensionerForm(formData);
  const err = validate(data);
  if (err) return { error: err };

  const { templates, ...fields } = data;

  await prisma.$transaction([
    prisma.pensioner.update({
      where: { id },
      data: fields,
    }),
    prisma.pensionerPaymentTemplate.deleteMany({ where: { pensionerId: id } }),
    prisma.pensionerPaymentTemplate.createMany({
      data: templates.map((t) => ({
        pensionerId: id,
        paymentId: t.paymentId,
        dayOfMonth: t.dayOfMonth,
        defaultAmount: t.defaultAmount,
      })),
    }),
  ]);

  revalidatePath("/pensioners");
  revalidatePath(`/pensioners/${id}`);
  return { ok: true };
}

export async function deletePensioner(id: number) {
  try {
    await prisma.pensioner.delete({ where: { id } });
  } catch {
    return { error: "Не вдалося видалити (можливо, є звʼязані виплати)" };
  }
  revalidatePath("/pensioners");
  redirect("/pensioners");
}
