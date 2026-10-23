import { forwardRef, type ReactNode } from "react";

/**
 * The two page widths every tab uses:
 * - "full": as wide as the window allows (the tracker, the damage calculator)
 * - "reading": one centred column for everything else
 */
export type PageWidth = "full" | "reading";

const WIDTH_CLASS: Record<PageWidth, string> = {
  full: "max-w-screen-2xl px-3 sm:px-4",
  reading: "max-w-4xl px-4",
};

interface ShellProps {
  width: PageWidth;
  children: ReactNode;
  /** Extra classes for the inner column (gap, padding) */
  className?: string;
}

/**
 * A tab's scrolling area: fills the space under the header, leaves room for the
 * phone's bottom bar, and centres one column of the given width.
 */
export const PageShell = forwardRef<HTMLElement, ShellProps>(function PageShell({ width, children, className = "" }, ref) {
  return (
    <main ref={ref} className="flex-1 min-h-0 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <div className={`${WIDTH_CLASS[width]} mx-auto w-full py-6 sm:py-8 flex flex-col gap-6 ${className}`}>
        {children}
      </div>
    </main>
  );
});

interface HeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Controls beside the title on a wide screen, under it on a phone */
  actions?: ReactNode;
}

/** The title + one-line explanation at the top of every tab. */
export function PageHeader({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--theme-font-display)" }}>{title}</h2>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex-shrink-0 self-start">{actions}</div>}
    </div>
  );
}
