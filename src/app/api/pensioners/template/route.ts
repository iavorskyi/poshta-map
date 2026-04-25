import { buildPensionersTemplate } from "@/lib/pensionerImport";

export const runtime = "nodejs";

export async function GET() {
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
