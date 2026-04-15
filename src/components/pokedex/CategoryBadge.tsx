import type { MoveDetail } from "../../lib/move-fetch";

export function CategoryBadge({ cat }: { cat: MoveDetail["category"] }) {
  const config = {
    physical: { label: "Phys.",  bg: "bg-orange-700/80", text: "text-orange-100" },
    special:  { label: "Spec.",  bg: "bg-blue-700/80",   text: "text-blue-100"   },
    status:   { label: "Status", bg: "bg-gray-600/80",   text: "text-gray-200"   },
  }[cat];
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
