import type { ReactNode } from "react";

// The options panels of What's next (catch and level up): labelled rows of pill toggles and labelled selects,
// all 36 px high, so the controls line up at every width.

export const SELECT =
  "min-h-[36px] rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500";

/** One labelled row of toggles: the label in its own column on a wide screen, above the pills on a phone */
export function OptionRow({
  label,
  children,
  testId,
  ariaLabel,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3">
      <span className="sm:w-16 sm:pt-2 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label={ariaLabel ?? label}
        data-testid={testId}
      >
        {children}
      </div>
    </div>
  );
}

/** An on/off toggle, the same pill everywhere in the options */
export function Pill({
  on,
  onClick,
  title,
  testId,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      data-testid={testId}
      className={`px-3 min-h-[36px] rounded-full border text-xs font-medium transition-colors ${
        on
          ? "bg-indigo-600 border-indigo-500 text-white"
          : "bg-gray-800/60 border-gray-700 text-gray-300 hover:text-gray-100 hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

export function SelectField({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0 [&_select]:w-full" title={title}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}
