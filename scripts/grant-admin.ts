import { PrismaClient } from "../src/generated/prisma";
import { hash } from "bcryptjs";
import * as readline from "node:readline";

const prisma = new PrismaClient();

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (a) => {
      rl.close();
      resolve(a);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let postmanIdArg: string | undefined;
  let usernameArg: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--id") postmanIdArg = args[++i];
    else if (a === "--username") usernameArg = args[++i];
  }

  const postmen = await prisma.postman.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, username: true, isAdmin: true },
  });

  if (postmen.length === 0) {
    console.error("Немає поштарів. Спочатку створіть поштаря.");
    process.exit(1);
  }

  let target = postmen.find(
    (p) =>
      (postmanIdArg && String(p.id) === postmanIdArg) ||
      (usernameArg && p.username === usernameArg)
  );

  if (!target) {
    console.log("\nДоступні поштарі:");
    for (const p of postmen) {
      console.log(
        `  ${p.id}\t${p.name}\t${p.username ?? "(без логіну)"}${p.isAdmin ? " [admin]" : ""}`
      );
    }
    const idStr = await ask("\nID поштаря для надання адмін-прав: ");
    const id = Number(idStr.trim());
    target = postmen.find((p) => p.id === id);
    if (!target) {
      console.error("Не знайдено.");
      process.exit(1);
    }
  }

  const username =
    target.username ??
    (await ask(`Логін для "${target.name}": `)).trim();
  if (!username) {
    console.error("Логін не може бути порожнім.");
    process.exit(1);
  }

  let passwordHash: string | undefined;
  if (!target.username) {
    const password = await ask("Пароль (мін. 6): ");
    if (password.length < 6) {
      console.error("Пароль закороткий.");
      process.exit(1);
    }
    passwordHash = await hash(password, 10);
  }

  await prisma.postman.update({
    where: { id: target.id },
    data: {
      isAdmin: true,
      ...(passwordHash ? { username, passwordHash } : {}),
    },
  });

  console.log(`Готово. ${target.name} тепер адмін${passwordHash ? ` (логін: ${username})` : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
