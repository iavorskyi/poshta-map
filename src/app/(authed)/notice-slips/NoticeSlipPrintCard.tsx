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
      <div className="notice-slip-header-row">
        <div>
          <div className="notice-slip-brand">УКРПОШТА</div>
          <div className="notice-slip-brand-sub">Повідомлення</div>
        </div>
        <div className="notice-slip-form-code">Форма 22-а</div>
      </div>

      <div className="notice-slip-text">
        Шановний клієнте{" "}
        <span className="notice-slip-underline-inline">{name || "\u00A0"}</span>
        {address && (
          <>
            {" "}
            (<span className="notice-slip-underline-inline">{address}</span>)
          </>
        )}
        , Вам надійшло поштове відправлення:
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
          рекомендоване №{" "}
          <span className="notice-slip-underline-short">
            {itemType === "REGISTERED" ? trackingNumber || "\u00A0" : "\u00A0"}
          </span>
        </span>
      </div>
      <div className="notice-slip-caption">(ШКІ відправлення)</div>

      <div className="notice-slip-text">
        Одержати його Ви можете у відділенні поштового зв&apos;язку за адресою:
      </div>
      <div className="notice-slip-underline-block">{branchAddress || "\u00A0"}</div>

      <div className="notice-slip-text">
        ми працюємо: <span className="notice-slip-underline-inline">{workingHours || "\u00A0"}</span>
      </div>
      <div className="notice-slip-text">
        телефонуйте, якщо виникли питання:{" "}
        <span className="notice-slip-underline-inline">{phone || "\u00A0"}</span>
      </div>

      <div className="notice-slip-note">
        Для одержання рекомендованого відправлення потрібно пред&apos;явити документ,
        що посвідчує особу. Отримати може повнолітній член родини за документом,
        що посвідчує родинні зв&apos;язки.
      </div>
      <div className="notice-slip-text">
        Також Ви можете замовити доставку відправлення додому
      </div>
      <div className="notice-slip-text">
        за телефоном: <span className="notice-slip-underline-inline">{phone || "\u00A0"}</span>
      </div>

      <div className="notice-slip-footer">
        <span className="notice-slip-footer-brand">ДО ЗУСТРІЧІ. УКРПОШТА.</span>
        <span className="notice-slip-footer-date">
          <span className="notice-slip-underline-inline">{dateStr || "\u00A0"}</span>
          <span className="notice-slip-caption">
            дата вкладання повідомлення до абонентської скриньки
          </span>
        </span>
      </div>
    </article>
  );
}
