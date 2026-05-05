"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ToastType = "error" | "success" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback so non-wrapped trees don't crash; logs to console.
    return {
      showToast: (m, t = "info") => {
        // eslint-disable-next-line no-console
        console[t === "error" ? "error" : "log"]("[toast]", m);
      },
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3 sm:top-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const ms = toast.type === "error" ? 6000 : 3500;
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
  }, [toast.type, onDismiss]);

  const styles =
    toast.type === "error"
      ? "border-danger-border bg-danger-bg text-danger"
      : toast.type === "success"
      ? "border-success-border bg-success-bg text-success"
      : "border-border bg-surface text-fg";

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className={`pointer-events-auto w-full max-w-sm rounded-lg border ${styles} shadow-md px-3 py-2 text-sm flex items-start gap-2`}
    >
      <span className="flex-1 whitespace-pre-line">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-current opacity-60 hover:opacity-100 px-1 leading-none"
        aria-label="Закрити"
      >
        ✕
      </button>
    </div>
  );
}
