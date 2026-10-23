import type { ReactNode } from "react";

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Shown before the label */
  icon?: ReactNode;
  /** Tooltip, and the accessible name when the label is only an icon */
  title?: string;
  disabled?: boolean;
}

interface Props<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers */
  ariaLabel: string;
  size?: "sm" | "md";
  /** Let the segments wrap onto more lines when there isn't room */
  wrap?: boolean;
  /** Stretch to the container's width, segments sharing it equally */
  fill?: boolean;
  className?: string;
}

/**
 * The one segmented control: a set of options of which exactly one is on.
 * Used for modes, formats, tiers, boxes and the like across every tab.
 */
export default function SegmentedControl<T extends string | number>({
  options, value, onChange, ariaLabel, size = "md", wrap = false, fill = false, className = "",
}: Props<T>) {
  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`${fill ? "flex w-full" : "inline-flex"} items-center gap-0.5 p-0.5 rounded-lg bg-gray-800/80 border border-gray-700/60 ${wrap ? "flex-wrap" : ""} ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            title={option.title}
            aria-label={typeof option.label === "string" ? undefined : option.title}
            onClick={() => onChange(option.value)}
            className={`${sizeClass} ${fill ? "flex-1" : ""} inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-100 hover:bg-gray-700/60"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
