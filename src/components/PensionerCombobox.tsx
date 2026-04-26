"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Pensioner = { id: number; fullName: string };

export function PensionerCombobox({
  pensioners,
  value,
  onChange,
  placeholder = "Усі пенсіонери",
}: {
  pensioners: Pensioner[];
  value: number | "";
  onChange: (id: number | "") => void;
  placeholder?: string;
}) {
  const selected = pensioners.find((p) => p.id === value) ?? null;
  const [query, setQuery] = useState(selected?.fullName ?? "");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value -> input text when it changes
  useEffect(() => {
    setQuery(pensioners.find((p) => p.id === value)?.fullName ?? "");
  }, [value, pensioners]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pensioners.slice(0, 50);
    return pensioners.filter((p) => p.fullName.toLowerCase().includes(q)).slice(0, 50);
  }, [pensioners, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  const commit = (p: Pensioner | null) => {
    if (p) {
      onChange(p.id);
      setQuery(p.fullName);
    } else {
      onChange("");
      setQuery("");
    }
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            // If the text is cleared, clear the selection too
            if (!e.target.value.trim()) onChange("");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              if (open && filtered[activeIdx]) {
                e.preventDefault();
                commit(filtered[activeIdx]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="input"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {(query || value !== "") && (
          <button
            type="button"
            onClick={() => commit(null)}
            className="text-slate-400 hover:text-slate-600 px-2 py-1 text-sm"
            aria-label="Очистити"
            tabIndex={-1}
          >
            ✕
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg text-sm"
        >
          {filtered.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(p);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`cursor-pointer px-3 py-2 ${
                i === activeIdx ? "bg-blue-50 text-blue-700" : ""
              } ${p.id === value ? "font-medium" : ""}`}
            >
              {p.fullName}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-10 left-0 right-0 mt-1 rounded border border-slate-200 bg-white shadow-lg px-3 py-2 text-sm text-slate-500">
          Не знайдено
        </div>
      )}
    </div>
  );
}
