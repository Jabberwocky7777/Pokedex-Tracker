import { TYPE_BG_COLORS } from "../../lib/type-colors";

interface Props {
  type: string;
  size?: "sm" | "md";
}

/** Pill badge for a Pokémon type. Relies on TYPE_BG_COLORS Tailwind classes. */
export default function TypeBadge({ type, size = "md" }: Props) {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  const sizeClass = size === "sm"
    ? "px-1.5 py-0.5 text-xs"
    : "px-3 py-1 text-xs";

  return (
    <span className={`rounded-full font-semibold text-white ${sizeClass} ${TYPE_BG_COLORS[type] ?? "bg-gray-500"}`}>
      {label}
    </span>
  );
}
