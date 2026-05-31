"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useGlobalPending } from "@/components/RouteProgress";
import { useToast } from "@/components/Toast";
import { type BuildingOption } from "@/components/BuildingCombobox";
import { SubscriberForm, type SubscriberFormValues } from "../SubscriberForm";
import { updateSubscriber } from "../actions";

export function EditSubscriberButton({
  subscriberId,
  defaultValues,
  buildings,
}: {
  subscriberId: number;
  defaultValues: SubscriberFormValues;
  buildings: BuildingOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  useGlobalPending(isPending);
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSubmit = (fd: FormData) => {
    startTransition(async () => {
      const res = await updateSubscriber(subscriberId, fd);
      if ("error" in res) {
        showToast(res.error, "error");
      } else {
        showToast("Збережено", "success");
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-sm"
      >
        Редагувати
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-3xl mt-8 mb-8 space-y-2">
            <div className="card flex items-center justify-between gap-3 px-4 py-2">
              <h2 className="font-semibold text-lg">
                Редагувати передплатника
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-fg-subtle hover:text-fg text-sm px-2 py-1"
                aria-label="Закрити"
              >
                ✕
              </button>
            </div>
            <SubscriberForm
              buildings={buildings}
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              onCancel={() => setOpen(false)}
              submitLabel="Зберегти"
              isPending={isPending}
            />
          </div>
        </div>
      )}
    </>
  );
}
