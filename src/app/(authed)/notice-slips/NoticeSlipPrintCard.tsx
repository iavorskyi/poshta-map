import type { NoticeSlipPrintData } from "@/lib/noticeSlipShared";

export function NoticeSlipPrintCard({
  name,
  address,
  itemType,
  trackingNumber,
  branchAddress,
  workingHours,
  phone,
  dateStr,
}: Omit<NoticeSlipPrintData, "key">) {
  return (
    <article className="notice-slip">
      <div className="notice-slip-title">Укрпошта · ф.22-а</div>
      <div>
        <div className="notice-slip-field-label">Шановний клієнте</div>
        <div className="notice-slip-name">{name || "—"}</div>
        {address && <div className="notice-slip-note">{address}</div>}
      </div>

      <div className="notice-slip-checkbox-row">
        <span className="notice-slip-checkbox">
          <span
            className={`notice-slip-box${itemType === "PLAIN" ? " notice-slip-box--checked" : ""}`}
          />
          просте
        </span>
        <span className="notice-slip-checkbox">
          <span
            className={`notice-slip-box${itemType === "REGISTERED" ? " notice-slip-box--checked" : ""}`}
          />
          рекомендоване {itemType === "REGISTERED" && trackingNumber ? `№ ${trackingNumber}` : "№ ______________"}
        </span>
      </div>

      <div>
        <div className="notice-slip-field-label">
          Одержати можна у відділенні поштового зв&apos;язку за адресою
        </div>
        <div className="notice-slip-field-value">{branchAddress || "—"}</div>
      </div>

      {workingHours && (
        <div>
          <div className="notice-slip-field-label">Режим роботи</div>
          <div className="notice-slip-field-value">{workingHours}</div>
        </div>
      )}

      <div>
        <div className="notice-slip-field-label">Телефон для питань і замовлення доставки додому</div>
        <div className="notice-slip-field-value">{phone || "—"}</div>
      </div>

      <div className="notice-slip-note">
        Для одержання рекомендованого відправлення потрібно пред&apos;явити документ,
        що посвідчує особу. Отримати може повнолітній член родини за документом,
        що посвідчує родинні зв&apos;язки.
      </div>

      <div className="notice-slip-footer">
        <span>До зустрічі. Укрпошта.</span>
        <span>Дата вкладення: {dateStr || "—"}</span>
      </div>
    </article>
  );
}
