"use client";

import { telegramLink, viberLink } from "@/lib/messengerLinks";
import { useToast } from "@/components/Toast";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function ViberIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 1C6.9 1 2.3 4 1.5 8.9c-.5 3 .1 5.8 1.7 8.1.2.3.3.7.3 1.1l-.3 3.3c-.1.6.5 1 1 .8l3-1.3c.3-.1.6-.1.9 0 1.2.4 2.5.5 3.9.5 5.1 0 9.7-3 10.5-7.9.9-5.7-3.4-11.1-9.5-11.5-.5 0-1-.1-1.5-.1Zm4.6 13.7c-.4 1-1.9 1.9-3 2.1-.7.1-1.6.2-4.6-1-3.5-1.5-5.7-5.1-5.9-5.3-.2-.2-1.4-1.8-1.4-3.5 0-1.6.9-2.4 1.2-2.8.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.3.6.9 2.1 1 2.3.1.2.1.3 0 .5-.1.2-.2.3-.3.5-.2.2-.3.3-.5.5-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.7-.1.3.1 1.8.8 2.1 1 .3.2.5.2.6.4.1.2.1.6-.3 1.6ZM12.5 5.5c-.3 0-.5.2-.5.5s.2.5.5.5c2.5 0 4.5 2 4.5 4.5 0 .3.2.5.5.5s.5-.2.5-.5c0-3-2.5-5.5-5.5-5.5Zm.2 1.8c-.3 0-.5.2-.5.5s.2.4.5.5c1.1.2 1.8.9 2 2 0 .3.2.4.5.4h.1c.3 0 .4-.3.4-.5-.3-1.5-1.4-2.6-3-2.9Zm.1 1.7c-.3 0-.4.2-.4.4 0 .2.1.3.3.4.5.1.7.3.8.8 0 .2.2.3.4.3h.1c.2 0 .4-.3.3-.5-.2-.9-.7-1.4-1.5-1.6Z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm5.1 7.6-1.7 8.1c-.1.6-.5.7-1 .4l-2.8-2-1.3 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.2-4.7c.2-.2 0-.3-.3-.1l-6.4 4-2.8-.9c-.6-.2-.6-.6.1-.9l11-4.2c.5-.2 1 .1.8.9Z" />
    </svg>
  );
}

type Props = {
  phone: string | null | undefined;
  variant?: "card" | "compact";
  stopPropagation?: boolean;
  /** Готовий текст повідомлення для копіювання (вже з підставленою назвою). */
  copyText?: string;
};

export function MessengerButtons({
  phone,
  variant = "card",
  stopPropagation = false,
  copyText,
}: Props) {
  const { showToast } = useToast();
  const viber = viberLink(phone);
  const telegram = telegramLink(phone);
  if (!viber && !telegram) return null;

  const onClick = stopPropagation
    ? (e: React.MouseEvent) => e.stopPropagation()
    : undefined;

  const text = copyText?.trim() || "";
  const handleCopy = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      showToast("Текст скопійовано", "success");
    } catch {
      showToast("Не вдалося скопіювати", "error");
    }
  };

  if (variant === "compact") {
    return (
      <span className="ml-1.5 inline-flex items-center gap-1.5 align-middle">
        {viber && (
          <a
            href={viber}
            onClick={onClick}
            title="Написати у Viber"
            aria-label="Написати у Viber"
            className="text-[#7360f2] hover:opacity-80"
          >
            <ViberIcon className="h-4 w-4" />
          </a>
        )}
        {telegram && (
          <a
            href={telegram}
            onClick={onClick}
            title="Написати у Telegram"
            aria-label="Написати у Telegram"
            className="text-[#26a5e4] hover:opacity-80"
          >
            <TelegramIcon className="h-4 w-4" />
          </a>
        )}
        {text && (
          <button
            type="button"
            onClick={handleCopy}
            title="Скопіювати текст повідомлення"
            aria-label="Скопіювати текст повідомлення"
            className="text-fg-muted hover:text-fg"
          >
            <CopyIcon className="h-4 w-4" />
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {viber && (
        <a
          href={viber}
          onClick={onClick}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#7360f2] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
        >
          <ViberIcon className="h-4 w-4" />
          Viber
        </a>
      )}
      {telegram && (
        <a
          href={telegram}
          onClick={onClick}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#26a5e4] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
        >
          <TelegramIcon className="h-4 w-4" />
          Telegram
        </a>
      )}
      {text && (
        <button
          type="button"
          onClick={handleCopy}
          title="Скопіювати текст повідомлення"
          aria-label="Скопіювати текст повідомлення"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-fg-muted hover:text-fg"
        >
          <CopyIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
