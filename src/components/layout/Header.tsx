import { Settings } from "lucide-react";
import SyncDot from "./SyncDot";
import { TAB_DEFS, tabDef } from "./tabs";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useTrackerCountStore } from "../../store/useTrackerCountStore";
import { openTab } from "../../lib/navigate";
import type { MetaData } from "../../types";

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

/** Gen 3 / Gen 4 switch. The same setting as the selector in Settings. */
function GenerationToggle({ meta }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const setActiveGeneration = useSettingsStore((s) => s.setActiveGeneration);
  if (meta.activeGenerations.length <= 1) return null;

  return (
    <div role="radiogroup" aria-label="Generation" className="flex items-center p-0.5 rounded-lg bg-gray-800/80 border border-gray-700/70">
      {meta.activeGenerations.map((gen) => {
        const active = gen === activeGeneration;
        return (
          <button
            key={gen}
            role="radio"
            aria-checked={active}
            onClick={() => setActiveGeneration(gen)}
            title={`Generation ${gen}`}
            // The visible pill is small; the padding makes the touch target taller
            className={`relative px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums transition-colors before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] ${
              active ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-gray-100"
            }`}
          >
            Gen {gen}
          </button>
        );
      })}
    </div>
  );
}

function TrackerCounter() {
  const { caught, pending, total } = useTrackerCountStore();
  return (
    <div className="flex flex-col leading-tight text-[11px] tabular-nums" aria-label={`${caught} of ${total} caught, ${caught + pending} including pending`}>
      <span className="text-green-400">{caught} / {total} caught</span>
      {pending > 0 && <span className="text-yellow-500/80">{caught + pending} incl. pending</span>}
    </div>
  );
}

/** The one header, shared by every tab (rendered by App). */
export default function Header({ meta }: Props) {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const navTabs = TAB_DEFS.filter((t) => t.id !== "settings");
  const settingsActive = activeTab === "settings";

  return (
    <header
      className="relative z-40 flex-shrink-0 bg-gray-900/95 backdrop-blur border-b border-gray-800"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >

      {/* ── Mobile top bar (hidden on md+) ───────────────────────────── */}
      <div className="grid md:hidden grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 min-h-[48px]">
        {/* Left: the tracker's counter, on the tracker only */}
        <div className="min-w-0">
          {activeTab === "tracker" && <TrackerCounter />}
        </div>

        {/* Center: current page name */}
        <h1 className="text-center text-sm font-semibold text-white truncate">
          {tabDef(activeTab).label}
        </h1>

        <div className="flex items-center justify-end gap-3">
          <GenerationToggle meta={meta} />
          <SyncDot />
        </div>
      </div>

      {/* ── Desktop top bar (hidden below md) ───────────────────────── */}
      <div className="hidden md:flex items-center h-16 px-4 gap-3 max-w-screen-2xl mx-auto">

        {/* Left zone: flex-1 keeps it equal-width to right zone so center nav stays truly centered */}
        <div className="flex items-center flex-1 min-w-0">
          <button
            onClick={() => openTab("tracker")}
            className="flex items-center gap-2 rounded-md hover:opacity-80 transition-opacity"
            aria-label="Pokédex Tracker — go to Tracker"
          >
            <PokeBall />
            <span className="hidden lg:inline text-sm font-bold text-white whitespace-nowrap tracking-tight" style={{ fontFamily: 'var(--theme-font-display)' }}>
              Pokédex Tracker
            </span>
          </button>
        </div>

        {/* Center zone: every tab. Below xl only the open tab keeps its label; the rest are icons with a tooltip */}
        <nav className="flex items-center gap-1 flex-shrink-0" aria-label="Main navigation">
          {navTabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => openTab(id)}
                title={label}
                aria-label={label}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white text-gray-900"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={16} />
                <span className={isActive ? "whitespace-nowrap" : "hidden xl:inline whitespace-nowrap"}>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right zone: flex-1 + justify-end mirrors left zone width */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <GenerationToggle meta={meta} />
          <SyncDot />
          <button
            onClick={() => openTab("settings")}
            title="Settings"
            aria-label="Settings"
            aria-current={settingsActive ? "page" : undefined}
            className={`p-2 rounded-full transition-colors ${
              settingsActive ? "bg-white text-gray-900" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

    </header>
  );
}
