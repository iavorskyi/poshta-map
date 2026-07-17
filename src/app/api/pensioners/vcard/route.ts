import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildPensionersVCard } from "@/lib/vcard";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });

  const scope = req.nextUrl.searchParams.get("scope");
  const mine = scope === "mine";

  const pensioners = await prisma.pensioner.findMany({
    where: {
      phone: { not: null },
      ...(mine ? { postmanId: me.id } : {}),
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      apartment: true,
      building: { select: { street: true, number: true } },
    },
  });

  const vcf = buildPensionersVCard(pensioners);
  const filename = mine ? "pensioners-mine.vcf" : "pensioners-all.vcf";

  return new Response(vcf, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
