import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="inline-flex h-9 items-center px-3 rounded-full border border-border bg-surface text-fg-muted hover:text-fg hover:bg-elevated text-sm transition-colors"
        title="Вийти"
      >
        Вийти
      </button>
    </form>
  );
}
