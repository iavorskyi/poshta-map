import { getCurrentUser } from "@/lib/auth";
import { buildNoticeSlipTemplate } from "@/lib/noticeSlipImport";

export const runtime = "nodejs";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return new Response("Forbidden", { status: 403 });
  }
  const buffer = await buildNoticeSlipTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="notice-slips-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
