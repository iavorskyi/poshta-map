import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const postman1 = await prisma.postman.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Іваненко І. І." },
  });

  const pension = await prisma.payment.upsert({
    where: { code: "PENSION" },
    update: {},
    create: { name: "Пенсія", code: "PENSION" },
  });
  const subsidy = await prisma.payment.upsert({
    where: { code: "SUBSIDY" },
    update: {},
    create: { name: "Субсидія", code: "SUBSIDY" },
  });
  const help = await prisma.payment.upsert({
    where: { code: "HELP" },
    update: {},
    create: { name: "Допомога", code: "HELP" },
  });

  const b1 = await prisma.building.upsert({
    where: { street_number: { street: "вул. Шевченка", number: "12" } },
    update: {},
    create: { street: "вул. Шевченка", number: "12" },
  });
  const b2 = await prisma.building.upsert({
    where: { street_number: { street: "вул. Франка", number: "4" } },
    update: {},
    create: { street: "вул. Франка", number: "4" },
  });
  const b3 = await prisma.building.upsert({
    where: { street_number: { street: "вул. Лесі Українки", number: "27" } },
    update: {},
    create: { street: "вул. Лесі Українки", number: "27" },
  });

  const today = new Date();
  const day = today.getDate();

  const p1 = await prisma.pensioner.upsert({
    where: { id: 1 },
    update: {},
    create: {
      fullName: "Петренко Марія Іванівна",
      buildingId: b1.id,
      apartment: "5",
      phone: "+380501112233",
      passportNumber: "АА123456",
      pensionPaymentDay: day,
      notes: "Живе на 3-му поверсі, ліфта немає.",
    },
  });

  const p2 = await prisma.pensioner.upsert({
    where: { id: 2 },
    update: {},
    create: {
      fullName: "Коваль Олексій Петрович",
      buildingId: b2.id,
      apartment: "11",
      phone: "+380671234567",
      passportNumber: "ВВ654321",
      pensionPaymentDay: day,
      notes: "Глухий — стукати голосно.",
    },
  });

  const p3 = await prisma.pensioner.upsert({
    where: { id: 3 },
    update: {},
    create: {
      fullName: "Сидоренко Ганна Степанівна",
      buildingId: b3.id,
      apartment: null,
      phone: null,
      passportNumber: "ММ999888",
      pensionPaymentDay: ((day + 1) % 28) + 1,
      notes: null,
    },
  });

  // Seed a handful of current payments spread across the month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  await prisma.currentPayment.createMany({
    data: [
      { pensionerId: p1.id, paymentId: pension.id, date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day), amount: 3500, isPaid: false },
      { pensionerId: p1.id, paymentId: subsidy.id, date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day), amount: 850, isPaid: false },
      { pensionerId: p2.id, paymentId: pension.id, date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day), amount: 4100, isPaid: true },
      { pensionerId: p3.id, paymentId: help.id, date: new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(day + 2, 28)), amount: 500, isPaid: false },
    ],
  });

  console.log("Seeded:", { postman1: postman1.id, p1: p1.id, p2: p2.id, p3: p3.id });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
