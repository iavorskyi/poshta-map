-- CreateTable
CREATE TABLE "Postman" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Pensioner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "house" TEXT NOT NULL,
    "apartment" TEXT,
    "phone" TEXT,
    "passportNumber" TEXT,
    "pensionPaymentDay" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PensionerPaymentTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pensionerId" INTEGER NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "defaultAmount" REAL NOT NULL,
    CONSTRAINT "PensionerPaymentTemplate_pensionerId_fkey" FOREIGN KEY ("pensionerId") REFERENCES "Pensioner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PensionerPaymentTemplate_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Round" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "postmanId" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round_postmanId_fkey" FOREIGN KEY ("postmanId") REFERENCES "Postman" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurrentPayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roundId" INTEGER NOT NULL,
    "pensionerId" INTEGER NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CurrentPayment_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurrentPayment_pensionerId_fkey" FOREIGN KEY ("pensionerId") REFERENCES "Pensioner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurrentPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_code_key" ON "Payment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PensionerPaymentTemplate_pensionerId_paymentId_dayOfMonth_key" ON "PensionerPaymentTemplate"("pensionerId", "paymentId", "dayOfMonth");
