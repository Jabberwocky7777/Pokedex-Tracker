/**
 * Shared Pokémon type color constants.
 *
 * TYPE_COLORS — hex values for inline CSS styles (e.g. backgroundColor).
 * TYPE_BG_COLORS — Tailwind bg-* classes for className usage (e.g. type badges).
 */

export const TYPE_COLORS: Record<string, string> = {
  normal:   "#9ca3af",
  fire:     "#f97316",
  water:    "#3b82f6",
  grass:    "#22c55e",
  electric: "#eab308",
  ice:      "#67e8f9",
  fighting: "#ef4444",
  poison:   "#a855f7",
  ground:   "#d97706",
  flying:   "#818cf8",
  psychic:  "#ec4899",
  bug:      "#84cc16",
  rock:     "#78716c",
  ghost:    "#6366f1",
  dragon:   "#7c3aed",
  dark:     "#374151",
  steel:    "#94a3b8",
  fairy:    "#f9a8d4",
};

export const TYPE_BG_COLORS: Record<string, string> = {
  normal:   "bg-gray-500",
  fire:     "bg-orange-500",
  water:    "bg-blue-500",
  grass:    "bg-green-500",
  electric: "bg-yellow-500",
  ice:      "bg-cyan-400",
  fighting: "bg-red-600",
  poison:   "bg-purple-500",
  ground:   "bg-amber-600",
  flying:   "bg-indigo-400",
  psychic:  "bg-pink-500",
  bug:      "bg-lime-500",
  rock:     "bg-stone-500",
  ghost:    "bg-indigo-600",
  dragon:   "bg-violet-600",
  dark:     "bg-gray-700",
  steel:    "bg-slate-400",
  fairy:    "bg-pink-300",
};
