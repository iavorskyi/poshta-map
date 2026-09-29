import { requireUser } from "@/lib/auth";
import { canManageNoticeSlipDefaults } from "@/lib/permissions";
import { getNoticeSlipDefaults } from "./actions";
import { NoticeSlipsClient } from "./NoticeSlipsClient";

export const dynamic = "force-dynamic";

export default async function NoticeSlipsPage() {
  const me = await requireUser();
  const defaults = await getNoticeSlipDefaults();

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Повідомлення ф.22-а</h1>
      </div>

      <NoticeSlipsClient
        initialDefaults={defaults}
        canManageDefaults={canManageNoticeSlipDefaults(me)}
      />
    </div>
  );
}
