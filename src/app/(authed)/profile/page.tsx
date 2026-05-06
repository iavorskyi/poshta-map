import { requireUser } from "@/lib/auth";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const me = await requireUser();
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-semibold">Профіль</h1>
      <div className="card p-4 space-y-1 text-sm">
        <div>
          <span className="text-fg-muted">ПІБ: </span>
          {me.name}
        </div>
        <div>
          <span className="text-fg-muted">Логін: </span>
          {me.username ?? "—"}
        </div>
        <div>
          <span className="text-fg-muted">Роль: </span>
          {me.isAdmin ? "Адмін" : "Поштар"}
        </div>
      </div>
      <ProfileClient />
    </div>
  );
}
