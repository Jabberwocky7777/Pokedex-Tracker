import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useDialogFocus } from "../../hooks/useDialogFocus";

/**
 * Printing. What prints is never the screen: a separate, plain sheet (portal
 * into <body>) that the print stylesheet in styles/index.css shows on paper and
 * hides on screen, while the app itself is hidden from the printer. The sheet
 * follows the ink rules there: white page, black text, thin grey lines, no fills.
 */

const printedOn = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" });

/** The printed page: a title, the selected games and the date, then the content. */
export function PrintSheet({ title, games, children }: { title: string; games: string; children: ReactNode }) {
  return createPortal(
    <div className="print-sheet" data-testid="print-sheet">
      <header className="p-header">
        <h1>{title}</h1>
        <p className="p-muted">{games} · Printed {printedOn.format(new Date())}</p>
      </header>
      {children}
    </div>,
    document.body,
  );
}

/** An empty tick box for the paper. */
export const PrintBox = () => <span className="p-box" aria-hidden="true" />;

/** A Pokémon sprite on paper: small and grey, when sprites are turned on. */
export const PrintSprite = ({ src }: { src: string }) => <img src={src} alt="" className="p-sprite" />;

// WKWebView (the iOS app) has no print dialog: window.print() does nothing there
export const CAN_PRINT = !Capacitor.isNativePlatform();

interface PanelProps {
  /** The button's label ("Print all", "Print 3 routes") */
  label: string;
  /** What the panel says will print */
  summary: ReactNode;
  /** Extra options (Include sprites, Include done) */
  options?: ReactNode;
  /** The sheet to print; mounted only while the panel is open */
  sheet: ReactNode;
  disabled?: boolean;
}

/** A Print button that opens a small panel: what will print, its options, and Print. */
export function PrintButton({ label, summary, options, sheet, disabled }: PanelProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(ref, open, close);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium disabled:opacity-40"
      >
        <Printer size={15} aria-hidden="true" />
        {label}
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-50 bg-black/50 print:hidden" onClick={close} aria-hidden="true" />
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="Print"
            tabIndex={-1}
            className="fixed z-50 inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[28rem] max-h-[85vh] overflow-y-auto bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 flex flex-col gap-3 print:hidden"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-100">Print</h2>
              <button onClick={close} aria-label="Close" className="p-2 -mr-2 rounded-full text-gray-400 hover:text-gray-100 hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="text-sm text-gray-300">{summary}</div>
            {options && <div className="flex flex-col gap-2">{options}</div>}
            {!CAN_PRINT && (
              <p className="text-xs text-gray-400">Printing isn&apos;t available in the iOS app. Open the tracker in Safari to print.</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={close} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200">Cancel</button>
              <button
                onClick={() => window.print()}
                disabled={!CAN_PRINT}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm text-white font-medium"
              >
                <Printer size={15} aria-hidden="true" />
                Print
              </button>
            </div>
          </div>
          {sheet}
        </>,
        document.body,
      )}
    </>
  );
}

/** A checkbox row for the print panel's options. */
export function PrintOption({ checked, onChange, children }: { checked: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
      {children}
    </label>
  );
}
