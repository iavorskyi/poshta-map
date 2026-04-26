import { buildCurrentPaymentsTemplate } from "@/lib/currentPaymentImport";

export const runtime = "nodejs";

export async function GET() {
  const buffer = await buildCurrentPaymentsTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="current-payments-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
