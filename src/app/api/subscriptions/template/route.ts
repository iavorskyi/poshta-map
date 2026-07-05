import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildSubscriptionsTemplate } from "@/lib/subscriptionImport";

export const runtime = "nodejs";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || !me.isAdmin) {
    return new Response("Forbidden", { status: 403 });
  }
  const publications = await prisma.publication.findMany({
    orderBy: { name: "asc" },
    select: { code: true, name: true, issuesPerMonth: true },
  });
  const buffer = await buildSubscriptionsTemplate(publications);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="subscriptions-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
