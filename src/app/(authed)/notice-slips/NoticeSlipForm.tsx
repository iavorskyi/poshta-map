"use client";

import { useEffect, useState } from "react";
import { toDateInputValue } from "@/lib/format";
import {
  extractAddressFromName,
  type NoticeSlipItemType,
  type NoticeSlipPrintData,
} from "@/lib/noticeSlipShared";
import type { NoticeSlipDefaults } from "./actions";

export function NoticeSlipForm({
  defaults,
  onChange,
}: {
  defaults: NoticeSlipDefaults;
  onChange: (slip: NoticeSlipPrintData | null) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [itemType, setItemType] = useState<NoticeSlipItemType>("PLAIN");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [branchAddress, setBranchAddress] = useState(defaults.branchAddress);
  const [workingHours, setWorkingHours] = useState(defaults.workingHours);
  const [phone, setPhone] = useState(defaults.phone);
  const [date, setDate] = useState(toDateInputValue(new Date()));

  useEffect(() => {
    if (!name.trim()) {
      onChange(null);
      return;
    }
    onChange({
      key: "manual",
      name,
      address,
      itemType,
      trackingNumber: trackingNumber || null,
      branchAddress,
      workingHours,
      phone,
      dateStr: date,
    });
  }, [name, address, itemType, trackingNumber, branchAddress, workingHours, phone, date, onChange]);

  const handleNameBlur = () => {
    if (address.trim()) return;
    const extracted = extractAddressFromName(name);
    if (extracted.address) {
      setName(extracted.name);
      setAddress(extracted.address);
    }
  };

  return (
    <div className="card p-3 md:p-4 space-y-3">
      <div className="font-medium text-sm">Заповнити бланк вручну</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">
            ФІО адресата{" "}
            <span className="text-fg-subtle">(адресу можна вписати в дужках після ФІО)</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            className="input"
            placeholder="Іванов Іван Іванович (вул. Шевченка, 10, кв. 5)"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">Адреса адресата</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">Тип відправлення</span>
          <div className="flex items-center gap-4 h-[38px]">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="itemType"
                checked={itemType === "PLAIN"}
                onChange={() => setItemType("PLAIN")}
                className="accent-brand"
              />
              просте
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="itemType"
                checked={itemType === "REGISTERED"}
                onChange={() => setItemType("REGISTERED")}
                className="accent-brand"
              />
              рекомендоване
            </label>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">ШКІ відправлення</span>
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            disabled={itemType !== "REGISTERED"}
            className="input disabled:opacity-50"
            placeholder={itemType === "REGISTERED" ? "0501234567890" : "—"}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">Адреса відділення</span>
          <input
            value={branchAddress}
            onChange={(e) => setBranchAddress(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">Режим роботи</span>
          <input
            value={workingHours}
            onChange={(e) => setWorkingHours(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">Телефон</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fg-muted">Дата вкладення</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </label>
      </div>
    </div>
  );
}
