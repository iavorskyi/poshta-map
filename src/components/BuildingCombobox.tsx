"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type BuildingOption = { id: number; street: string; number: string };

export function BuildingCombobox({
  buildings,
  value,
  onChange,
  placeholder = "Оберіть будинок з дільниці",
}: {
  buildings: BuildingOption[];
  value: number | "";
  onChange: (id: number | "") => void;
  placeholder?: string;
}) {
  const selected = buildings.find((b) => b.id === value) ?? null;
  const labelOf = (b: BuildingOption) => `${b.street}, № ${b.number}`;
  const [query, setQuery] = useState(selected ? labelOf(selected) : "");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const b = buildings.find((x) => x.id === value);
    setQuery(b ? labelOf(b) : "");
  }, [value, buildings]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buildings.slice(0, 80);
    return buildings.filter((b) => labelOf(b).toLowerCase().includes(q)).slice(0, 80);
  }, [buildings, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  const commit = (b: BuildingOption | null) => {
    if (b) {
      onChange(b.id);
      setQuery(labelOf(b));
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
            className="text-fg-subtle hover:text-fg px-2 py-1 text-sm"
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
          className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded border border-border bg-surface shadow-lg text-sm"
        >
          {filtered.map((b, i) => (
            <li
              key={b.id}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(b);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`cursor-pointer px-3 py-2 ${
                i === activeIdx ? "bg-elevated text-fg" : "text-fg"
              } ${b.id === value ? "font-medium" : ""}`}
            >
              {labelOf(b)}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-10 left-0 right-0 mt-1 rounded border border-border bg-surface shadow-lg px-3 py-2 text-sm text-fg-subtle">
          Не знайдено. Спочатку додайте будинок у розділі «Дільниця».
        </div>
      )}
    </div>
  );
}
