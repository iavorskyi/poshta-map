import { buildPensionersTemplate } from "@/lib/pensionerImport";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || !me.isAdmin) {
    return new Response("Forbidden", { status: 403 });
  }
  const buffer = await buildPensionersTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pensioners-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
