import { STAT_KEYS, STAT_LABELS, type StatKey, type Nature } from "../../lib/iv-calc";

export interface StatGridProps {
  label: string;
  sublabel?: string;
  values: Record<StatKey, number>;
  onChange: (stat: StatKey, val: number) => void;
  min: number;
  max: number;
  nature?: Nature;
  accentColor?: "indigo" | "pink";
}

export function StatGrid({ label, sublabel, values, onChange, min, max, nature, accentColor = "indigo" }: StatGridProps) {
  const focusClass = accentColor === "indigo" ? "focus:border-indigo-500" : "focus:border-pink-500";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-300">
        {label}{sublabel && <span className="text-gray-500 font-normal"> {sublabel}</span>}
      </label>
      <div className="grid grid-cols-6 gap-2">
        {STAT_KEYS.map((stat) => (
          <div key={stat} className="flex flex-col gap-1 items-center">
            <span className="text-xs text-gray-500 flex items-center gap-0.5">
              {STAT_LABELS[stat].replace("Special ", "Sp.")}
              {nature?.plus === stat && <span className="text-green-400 text-xs">▲</span>}
              {nature?.minus === stat && <span className="text-red-400 text-xs">▼</span>}
            </span>
            <input
              type="number"
              min={min}
              max={max}
              value={values[stat]}
              onChange={(e) =>
                onChange(stat, Math.max(min, Math.min(max, Number(e.target.value))))
              }
              className={`w-full px-1.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none ${focusClass} text-center`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
