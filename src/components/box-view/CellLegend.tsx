/**
 * What the tracker cell's marks mean, side by side: the five states a cell can
 * be in. Shown under "How these work" beside the tracker's filters.
 */
const STATES: { label: string; swatch: string; mark: string; markClass: string }[] = [
  { label: "Not caught", swatch: "bg-gray-900 border-gray-700", mark: "", markClass: "" },
  { label: "Caught", swatch: "bg-emerald-500/10 border-gray-700", mark: "✓", markClass: "bg-emerald-500 text-white" },
  {
    label: "Pending: have the pre-evolution",
    swatch: "bg-sky-500/10 border-gray-700",
    mark: "⏱",
    markClass: "bg-sky-400 text-gray-900",
  },
  {
    label: "Placed in the living dex",
    swatch: "bg-amber-400/15 border-amber-400/70",
    mark: "★",
    markClass: "bg-amber-400 text-gray-900",
  },
  { label: "Shiny", swatch: "bg-gray-800 border-gray-700", mark: "✦", markClass: "text-yellow-300" },
];

export default function CellLegend() {
  return (
    <ul aria-label="What the marks mean" className="flex flex-col gap-1.5">
      {STATES.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-xs text-gray-300">
          <span className={`relative w-5 h-5 rounded border-2 flex-shrink-0 ${s.swatch}`} aria-hidden="true">
            {s.mark && (
              <span
                className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-[8px] leading-none ${s.markClass}`}
              >
                {s.mark}
              </span>
            )}
          </span>
          {s.label}
        </li>
      ))}
    </ul>
  );
}
