import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const me = await getCurrentUser();
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";
  if (me) redirect(next);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-fg font-bold"
            aria-hidden="true"
          >
            П
          </span>
          <span className="font-semibold text-lg">Листоноша</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold">Вхід</h1>
          <p className="text-sm text-fg-muted mt-1">
            Введіть логін і пароль для доступу.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
