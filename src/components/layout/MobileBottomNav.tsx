import { useCallback, useRef, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { useSettingsStore } from "../../store/useSettingsStore";
import { openTab } from "../../lib/navigate";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { MOBILE_PRIMARY_TABS, TAB_DEFS, tabDef } from "./tabs";
import type { AppTab } from "../../types";

/**
 * Phone navigation: four main tabs, and More for the rest (Settings included) in a bottom sheet.
 * With `rail`, the same buttons as an icon rail down the left of a short, wide window (the
 * `rail` window class — a phone on its side, a handheld's wide screen), where a bottom bar
 * would take height the page doesn't have. App renders one of each; CSS shows the right one.
 */
export default function MobileBottomNav({ rail = false }: { rail?: boolean }) {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  useDialogFocus(sheetRef, moreOpen, closeMore);

  const moreTabs = TAB_DEFS.filter((t) => !MOBILE_PRIMARY_TABS.includes(t.id));
  const moreActive = !MOBILE_PRIMARY_TABS.includes(activeTab);

  function go(tab: AppTab) {
    setMoreOpen(false);
    openTab(tab);
  }

  return (
    <>
      <nav
        className={
          rail
            ? "hidden rail:flex flex-col flex-shrink-0 w-16 overflow-y-auto bg-gray-950 border-r border-gray-800/60"
            : "fixed bottom-0 left-0 right-0 z-40 roomy:hidden rail:hidden bg-gray-950/95 backdrop-blur-md border-t border-gray-800/60"
        }
        style={rail ? { paddingLeft: "env(safe-area-inset-left)" } : { paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main navigation"
      >
        <div className={rail ? "flex flex-col items-stretch py-1" : "flex items-stretch"}>
          {MOBILE_PRIMARY_TABS.map((id) => {
            const { shortLabel, Icon } = tabDef(id);
            return (
              <NavButton
                key={id}
                label={shortLabel}
                Icon={Icon}
                active={activeTab === id}
                onClick={() => go(id)}
                current
                rail={rail}
              />
            );
          })}
          <NavButton
            label="More"
            Icon={MoreHorizontal}
            active={moreActive}
            onClick={() => setMoreOpen((o) => !o)}
            ariaLabel={moreActive ? `More: ${tabDef(activeTab).label}` : "More tabs"}
            expanded={moreOpen}
            rail={rail}
          />
        </div>
      </nav>

      {moreOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={closeMore} aria-hidden="true" />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More tabs"
            tabIndex={-1}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">More</span>
              <button
                onClick={closeMore}
                aria-label="Close"
                className="p-2.5 -mr-2 rounded-full text-gray-400 hover:text-gray-100 hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            <ul className="px-2">
              {moreTabs.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <li key={id}>
                    <button
                      onClick={() => go(id)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-left text-sm font-medium transition-colors ${
                        active ? "bg-indigo-500/15 text-indigo-300" : "text-gray-200 hover:bg-gray-800"
                      }`}
                    >
                      <Icon size={20} className={active ? "text-indigo-400" : "text-gray-400"} />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}

function NavButton({
  label,
  Icon,
  active,
  onClick,
  current,
  ariaLabel,
  expanded,
  rail,
}: {
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  onClick: () => void;
  /** A tab button (aria-current) rather than the More button */
  current?: boolean;
  ariaLabel?: string;
  expanded?: boolean;
  rail?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center pt-2 pb-1.5 gap-0.5 relative ${rail ? "min-h-[56px]" : "flex-1 min-h-[60px] short:min-h-[48px] short:pt-1 short:pb-1"}`}
      aria-current={current && active ? "page" : undefined}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-haspopup={expanded !== undefined ? "dialog" : undefined}
    >
      {active &&
        (rail ? (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[2px] rounded-full bg-indigo-500" />
        ) : (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-indigo-500" />
        ))}
      <Icon size={24} className={active ? "text-indigo-400" : "text-gray-500"} />
      {/* A short window (a handheld's small screen) keeps the height for the page: icons only */}
      <span
        className={`text-[11px] font-medium leading-none ${rail ? "" : "short:sr-only"} ${active ? "text-indigo-400" : "text-gray-500"}`}
      >
        {label}
      </span>
    </button>
  );
}
