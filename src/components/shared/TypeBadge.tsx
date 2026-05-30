import { TYPE_BG_COLORS, TYPE_COLORS } from "../../lib/type-colors";
import { readableInk } from "../../lib/readable-ink";
import { useSettingsStore } from "../../store/useSettingsStore";

interface Props {
  type: string;
  size?: "sm" | "md";
}

/** Pill badge for a Pokémon type. */
export default function TypeBadge({ type, size = "md" }: Props) {
  const legibility = useSettingsStore((s) => s.legibility);
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  const sizeClass = size === "sm"
    ? "px-1.5 py-0.5 text-xs"
    : "px-3 py-1 text-xs";

  if (legibility !== "off") {
    const hex = TYPE_COLORS[type] ?? "#6b7280";
    return (
      <span
        className={`rounded-full font-semibold ${sizeClass}`}
        style={{ backgroundColor: hex, color: readableInk(hex) }}
      >
        {label}
      </span>
    );
  }

  return (
    <span className={`rounded-full font-semibold text-white ${sizeClass} ${TYPE_BG_COLORS[type] ?? "bg-gray-500"}`}>
      {label}
    </span>
  );
}
