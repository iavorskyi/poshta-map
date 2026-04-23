"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function parsePensionerForm(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const house = String(formData.get("house") ?? "").trim();
  const apartment = String(formData.get("apartment") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const passportNumber = String(formData.get("passportNumber") ?? "").trim() || null;
  const pensionPaymentDay = Number(formData.get("pensionPaymentDay") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  return { fullName, street, house, apartment, phone, passportNumber, pensionPaymentDay, notes };
}

function validate(data: ReturnType<typeof parsePensionerForm>) {
  if (!data.fullName) return "ФІО обов'язкове";
  if (!data.street || !data.house) return "Вулиця і номер будинку обов'язкові";
  if (!data.pensionPaymentDay || data.pensionPaymentDay < 1 || data.pensionPaymentDay > 31)
    return "День виплати пенсії має бути 1..31";
  return null;
}

export async function createPensioner(formData: FormData) {
  const data = parsePensionerForm(formData);
  const err = validate(data);
  if (err) return { error: err };

  const created = await prisma.pensioner.create({ data });
  revalidatePath("/pensioners");
  redirect(`/pensioners/${created.id}`);
}

export async function updatePensioner(id: number, formData: FormData) {
  const data = parsePensionerForm(formData);
  const err = validate(data);
  if (err) return { error: err };

  await prisma.pensioner.update({ where: { id }, data });

  revalidatePath("/pensioners");
  revalidatePath(`/pensioners/${id}`);
  return { ok: true };
}

export async function deletePensioner(id: number) {
  try {
    await prisma.pensioner.delete({ where: { id } });
  } catch {
    return { error: "Не вдалося видалити" };
  }
  revalidatePath("/pensioners");
  redirect("/pensioners");
}
