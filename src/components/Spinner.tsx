type Props = {
  size?: number;
  className?: string;
  label?: string;
};

// Маленький інлайн-спінер для кнопок. Колір успадковується від тексту
// (`border-current`), тож вписується і в світлу, і в темну тему.
export function Spinner({ size = 14, className = "", label = "Завантаження" }: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
