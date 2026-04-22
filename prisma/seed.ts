import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // Postmen
  const [postman1] = await Promise.all([
    prisma.postman.upsert({
      where: { id: 1 },
      update: {},
      create: { name: "Іваненко І. І." },
    }),
  ]);

  // Payment types
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

  // Pensioners
  const today = new Date();
  const day = today.getDate();

  const p1 = await prisma.pensioner.upsert({
    where: { id: 1 },
    update: {},
    create: {
      fullName: "Петренко Марія Іванівна",
      street: "вул. Шевченка",
      house: "12",
      apartment: "5",
      phone: "+380501112233",
      passportNumber: "АА123456",
      pensionPaymentDay: day,
      notes: "Живе на 3-му поверсі, ліфта немає.",
      templates: {
        create: [
          { paymentId: pension.id, dayOfMonth: day, defaultAmount: 3500 },
          { paymentId: subsidy.id, dayOfMonth: day, defaultAmount: 850 },
        ],
      },
    },
  });

  const p2 = await prisma.pensioner.upsert({
    where: { id: 2 },
    update: {},
    create: {
      fullName: "Коваль Олексій Петрович",
      street: "вул. Франка",
      house: "4",
      apartment: "11",
      phone: "+380671234567",
      passportNumber: "ВВ654321",
      pensionPaymentDay: day,
      notes: "Глухий — стукати голосно.",
      templates: {
        create: [{ paymentId: pension.id, dayOfMonth: day, defaultAmount: 4100 }],
      },
    },
  });

  const p3 = await prisma.pensioner.upsert({
    where: { id: 3 },
    update: {},
    create: {
      fullName: "Сидоренко Ганна Степанівна",
      street: "вул. Лесі Українки",
      house: "27",
      apartment: null,
      phone: null,
      passportNumber: "ММ999888",
      pensionPaymentDay: ((day + 1) % 28) + 1,
      notes: null,
      templates: {
        create: [
          { paymentId: pension.id, dayOfMonth: ((day + 1) % 28) + 1, defaultAmount: 2800 },
          { paymentId: help.id, dayOfMonth: ((day + 1) % 28) + 1, defaultAmount: 500 },
        ],
      },
    },
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
