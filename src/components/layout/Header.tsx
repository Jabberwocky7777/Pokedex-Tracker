import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Settings, Wrench } from "lucide-react";
import SyncDot from "./SyncDot";
import GameSwitcher from "./GameSwitcher";
import { TAB_DEFS, TOOL_TABS, tabDef } from "./tabs";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useTrackerCountStore } from "../../store/useTrackerCountStore";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { usePopoverAnchor } from "../../hooks/usePopoverAnchor";
import { openTab } from "../../lib/navigate";
import type { AppTab, MetaData } from "../../types";

interface Props {
  meta: MetaData;
}

/** CSS-only PokéBall — no emoji, no image */
function PokeBall() {
  return (
    <div className="w-6 h-6 rounded-full bg-red-500 relative overflow-hidden border-2 border-gray-300 flex-shrink-0">
      <div className="absolute inset-x-0 top-1/2 h-[2px] -mt-[1px] bg-gray-300" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-gray-300" />
    </div>
  );
}

function TrackerCounter() {
  const { caught, pending, total } = useTrackerCountStore();
  return (
    <div
      className="flex flex-col leading-tight text-[11px] tabular-nums"
      aria-label={`${caught} of ${total} caught, ${caught + pending} including pending`}
    >
      <span className="text-gray-100">
        {caught} <span className="text-gray-500">/ {total}</span>
      </span>
      {pending > 0 && <span className="text-gray-400">{pending} pending</span>}
    </div>
  );
}

// The main tabs; the calculators and lookups go in the Tools menu, Settings is the gear
const MAIN_TABS = TAB_DEFS.filter((t) => t.id !== "settings" && !TOOL_TABS.includes(t.id));
const TOOLS = TAB_DEFS.filter((t) => TOOL_TABS.includes(t.id));

/** One tab in the header: the open one is underlined. Below 1024 px only the open one keeps its label. */
function NavTab({ id, active }: { id: AppTab; active: boolean }) {
  const { label, Icon } = tabDef(id);
  return (
    <button
      onClick={() => openTab(id)}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center justify-center gap-1.5 h-full px-1 pointer-coarse:min-w-11 text-sm transition-colors border-b-2 ${
        active ? "border-indigo-400 text-white font-medium" : "border-transparent text-gray-400 hover:text-gray-100"
      }`}
    >
      <Icon size={16} aria-hidden="true" />
      <span className={active ? "whitespace-nowrap" : "hidden lg:inline whitespace-nowrap"}>{label}</span>
    </button>
  );
}

/** The calculators and lookups, in one menu. Shows the open one's name while one is open. */
function ToolsMenu({ activeTab }: { activeTab: AppTab }) {
  const [open, setOpen] = useState(false);
  const { ref: anchorRef, position: anchorPosition, measure: measureAnchor } = usePopoverAnchor(4, 8);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(menuRef, open, close);
  const current = TOOLS.find((t) => t.id === activeTab);

  // Up / down move between the items, as in any menu
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  }

  const Icon = current?.Icon ?? Wrench;
  return (
    <>
      <button
        ref={anchorRef}
        onClick={() => {
          measureAnchor();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={current ? `Tools: ${current.label}` : "Tools"}
        data-testid="tools-menu"
        className={`flex items-center gap-1.5 h-full px-1 pointer-coarse:min-w-11 text-sm transition-colors border-b-2 ${
          current ? "border-indigo-400 text-white font-medium" : "border-transparent text-gray-400 hover:text-gray-100"
        }`}
      >
        <Icon size={16} aria-hidden="true" />
        <span className={current ? "whitespace-nowrap" : "hidden lg:inline"}>{current?.label ?? "Tools"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50" onClick={close} aria-hidden="true" />
            <div
              ref={menuRef}
              role="menu"
              aria-label="Tools"
              tabIndex={-1}
              onKeyDown={onKeyDown}
              className="fixed z-50 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-1.5"
              style={anchorPosition}
            >
              {TOOLS.map(({ id, label, Icon: ToolIcon }) => (
                <button
                  key={id}
                  role="menuitem"
                  onClick={() => {
                    close();
                    openTab(id);
                  }}
                  aria-current={id === activeTab ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-3 min-h-10 pointer-coarse:min-h-12 rounded-lg text-sm text-left hover:bg-gray-800 ${
                    id === activeTab ? "text-white bg-gray-800" : "text-gray-300"
                  }`}
                >
                  <ToolIcon size={16} className="text-gray-400" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

/** The one header, shared by every tab (rendered by App). */
export default function Header({ meta }: Props) {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const settingsActive = activeTab === "settings";

  return (
    <header
      className="relative z-40 flex-shrink-0 bg-gray-950 border-b border-gray-800"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* ── Phone (and any short window): page name, games, sync ─────────── */}
      <div className="grid roomy:hidden grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 min-h-[48px]">
        <div className="min-w-0">{activeTab === "tracker" && <TrackerCounter />}</div>
        <span className="text-center text-sm font-semibold text-white truncate">{tabDef(activeTab).label}</span>
        <div className="flex items-center justify-end gap-3 min-w-0">
          <GameSwitcher meta={meta} compact />
          <SyncDot />
        </div>
      </div>

      {/* ── Everything wider ─────────────────────────────────────────────── */}
      <div className="hidden roomy:flex items-stretch h-14 px-4 gap-5 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => openTab("tracker")}
            className="flex items-center gap-2 rounded-md hover:opacity-80 transition-opacity"
            aria-label="Pokédex Tracker — go to Tracker"
          >
            <PokeBall />
            <span
              className="hidden xl:inline text-sm font-bold text-white whitespace-nowrap tracking-tight"
              style={{ fontFamily: "var(--theme-font-display)" }}
            >
              Pokédex Tracker
            </span>
          </button>
          <GameSwitcher meta={meta} />
        </div>

        <nav className="flex items-stretch gap-4 lg:gap-6 flex-1 min-w-0" aria-label="Main navigation">
          {MAIN_TABS.map(({ id }) => (
            <NavTab key={id} id={id} active={activeTab === id} />
          ))}
          <ToolsMenu activeTab={activeTab} />
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0">
          <SyncDot />
          <button
            onClick={() => openTab("settings")}
            title="Settings"
            aria-label="Settings"
            aria-current={settingsActive ? "page" : undefined}
            className={`p-2 pointer-coarse:p-3 rounded-full transition-colors ${
              settingsActive ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
