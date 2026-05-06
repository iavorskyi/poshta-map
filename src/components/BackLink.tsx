"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function BackLink({
  fallbackHref,
  fallbackLabel,
}: {
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.history.length <= 1) return;
    try {
      if (
        document.referrer &&
        new URL(document.referrer).origin === window.location.origin
      ) {
        setCanGoBack(true);
      }
    } catch {
      // ignore malformed referrer
    }
  }, []);

  if (!canGoBack) {
    return (
      <Link href={fallbackHref} className="text-sm text-link hover:text-link-hover hover:underline">
        ← {fallbackLabel}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-link hover:text-link-hover hover:underline"
    >
      ← Назад
    </button>
  );
}
