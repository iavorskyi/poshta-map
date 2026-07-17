"use client";

import { useState } from "react";

export function ExportContacts() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary"
      >
        Зберегти контакти
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-surface p-2 shadow-lg">
            <a
              href="/api/pensioners/vcard?scope=mine"
              download
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm hover:bg-elevated"
            >
              Мої пенсіонери
            </a>
            <a
              href="/api/pensioners/vcard?scope=all"
              download
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm hover:bg-elevated"
            >
              Усі пенсіонери
            </a>
            <p className="px-3 pt-1.5 text-xs text-fg-subtle">
              Завантажиться файл контактів. Телефон запропонує додати їх у
              книгу; дублікати за номером телефон обробляє сам.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
