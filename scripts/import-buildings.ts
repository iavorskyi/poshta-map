import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const filePath = "/Users/yavorskyi/Downloads/Адреси_на _обслуговуванні.xlsx";
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("No worksheet");

  // Header row = streets
  const headerRow = ws.getRow(1);
  const streets: { col: number; name: string }[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const v = cell.value;
    if (typeof v === "string" && v.trim()) {
      streets.push({ col, name: v.trim() });
    }
  });

  console.log("Streets found:", streets.map((s) => s.name).join(" | "));

  // Collect numbers per street
  const items: { street: string; number: string }[] = [];
  const seen = new Set<string>(); // dedup within input
  for (const s of streets) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const cell = ws.getCell(r, s.col);
      const v = cell.value;
      if (v == null || v === "") continue;
      const num = String(typeof v === "object" && "result" in v ? (v as { result: unknown }).result : v).trim();
      if (!num) continue;
      const key = `${s.name}::${num.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ street: s.name, number: num });
    }
  }

  console.log(`Total buildings to import: ${items.length}`);

  let created = 0;
  let skipped = 0;
  for (const it of items) {
    try {
      await prisma.building.create({ data: { street: it.street, number: it.number } });
      created++;
    } catch (e) {
      // Likely unique constraint (already exists)
      skipped++;
      console.warn(`SKIP ${it.street} № ${it.number}:`, e instanceof Error ? e.message.split("\n")[0] : e);
    }
  }

  console.log(`Done. Created: ${created}, skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
