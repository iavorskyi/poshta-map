"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Глобальна "тонка стрічка" зверху сторінки. Показуємо при:
//  • кліку по внутрішніх <a> / <Link> (навігація)
//  • сабміті <form> (server actions, що подаються формою)
//  • кастомних подіях app:pending-start / app:pending-end, які
//    диспатчить хук useGlobalPending — для useTransition-екшнів,
//    що не змінюють URL і не йдуть через форму.
//
// Стрічка має animation-delay, тож для миттєвих переходів вона не блимає.

const START_EVENT = "app:pending-start";
const END_EVENT = "app:pending-end";

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [count, setCount] = useState(0);

  // Скидаємо лічильник, коли URL змінився (навігація завершилась).
  useEffect(() => {
    setCount(0);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Тільки прості ліві кліки без модифікаторів
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      if (target.target && target.target !== "_self") return;
      if (target.hasAttribute("download")) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      setCount((c) => c + 1);
    };

    const onSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      setCount((c) => c + 1);
    };

    const onStart = () => setCount((c) => c + 1);
    const onEnd = () => setCount((c) => Math.max(0, c - 1));

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener(START_EVENT, onStart);
    document.addEventListener(END_EVENT, onEnd);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener(START_EVENT, onStart);
      document.removeEventListener(END_EVENT, onEnd);
    };
  }, []);

  const active = count > 0;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none"
    >
      <div
        className={`h-full origin-left bg-brand transition-opacity ${
          active ? "route-progress-bar opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

// Хук для components, які мають свій useTransition — пушить isPending
// у глобальну стрічку. Викликаємо так: useGlobalPending(isPending).
export function useGlobalPending(isPending: boolean) {
  useEffect(() => {
    if (!isPending) return;
    document.dispatchEvent(new CustomEvent(START_EVENT));
    return () => {
      document.dispatchEvent(new CustomEvent(END_EVENT));
    };
  }, [isPending]);
}
