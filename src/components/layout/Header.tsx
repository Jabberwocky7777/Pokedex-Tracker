import { useState } from "react";
import { LayoutGrid, BookOpen, Map, Calculator, Wand2, Swords, LogOut, RefreshCw, Search, Zap, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import SyncDot from "./SyncDot";
import { useSettingsStore } from "../../store/useSettingsStore";
import { getToken } from "../../lib/sync";
import type { AppTab } from "../../types";

interface Props {
  onLogout?: () => void;
  caughtCount?: number;
  totalCount?: number;
}

type TabDef = { id: AppTab; label: string; Icon: React.ComponentType<{ size?: number }> };

const TRACKER_TABS: TabDef[] = [
  { id: "tracker",    label: "Tracker",    Icon: LayoutGrid },
  { id: "pokedex",    label: "Pokédex",    Icon: BookOpen   },
  { id: "attackdex",  label: "Attackdex",  Icon: Swords     },
  { id: "routes",     label: "Routes",     Icon: Map        },
  { id: "catch-calc", label: "Catch Calc", Icon: Calculator },
];

const FRONTIER_TABS: TabDef[] = [
  { id: "designer",       label: "Designer",    Icon: Wand2     },
  { id: "trainer-lookup", label: "Trainer",     Icon: Search    },
  { id: "damage-calc",    label: "Damage Calc", Icon: Zap       },
  { id: "settings",       label: "Settings",    Icon: Settings  },
];

/** Restart button — calls /api/restart, Docker restart policy brings up the new image */
function RestartButton() {
  const [state, setState] = useState<"idle" | "restarting" | "done">("idle");

  async function handleRestart() {
    if (!window.confirm("Restart the server? The app will be unavailable for a few seconds while Docker restarts.")) return;
    setState("restarting");
    try {
      const token = getToken();
      await fetch("/api/restart", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // expected — server closed the connection while restarting
    }
    setState("done");
    // After ~8 s the container should be back up; reload the page
    setTimeout(() => window.location.reload(), 8000);
  }

  return (
    <button
      onClick={handleRestart}
      disabled={state !== "idle"}
      title={state === "restarting" ? "Restarting…" : state === "done" ? "Reloading page…" : "Restart server"}
      aria-label={state === "restarting" ? "Restarting…" : state === "done" ? "Reloading page…" : "Restart server"}
      className={`p-1.5 rounded-md transition-colors ${
        state !== "idle"
          ? "text-amber-400 cursor-not-allowed"
          : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
      }`}
    >
      <RefreshCw size={16} className={state === "restarting" ? "animate-spin" : ""} />
    </button>
  );
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

export default function Header({ onLogout, caughtCount, totalCount }: Props) {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);
  const tabGroup = useSettingsStore((s) => s.tabGroup);
  const setTabGroup = useSettingsStore((s) => s.setTabGroup);
  const allTabs = [...TRACKER_TABS, ...FRONTIER_TABS];
  const currentLabel = allTabs.find((t) => t.id === activeTab)?.label ?? "Pokédex Tracker";
  const activeTabs = tabGroup === "tracker" ? TRACKER_TABS : FRONTIER_TABS;

  return (
    <header
      className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >

      {/* ── Mobile top bar (hidden on md+) ───────────────────────────── */}
      <div className="flex md:hidden items-center px-3 min-h-[44px]">
        {/* Left: caught/total counter (tracker only) or spacer */}
        <div className="w-16 flex-shrink-0">
          {caughtCount !== undefined && totalCount !== undefined && (
            <span className="text-xs text-gray-400 tabular-nums">
              {caughtCount} / {totalCount}
            </span>
          )}
        </div>

        {/* Center: current page name */}
        <span className="flex-1 text-center text-sm font-semibold text-white truncate">
          {currentLabel}
        </span>

        {/* Right: sync dot */}
        <div className="w-16 flex-shrink-0 flex justify-end">
          <SyncDot />
        </div>
      </div>

      {/* ── Desktop top bar (hidden below md) ───────────────────────── */}
      <div className="hidden md:flex items-center h-16 px-4 max-w-screen-2xl mx-auto">

        {/* Left zone: flex-1 keeps it equal-width to right zone so center nav stays truly centered */}
        <div className="flex items-center flex-1">
          <button
            onClick={() => setActiveTab("tracker")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            aria-label="Go to Tracker"
          >
            <PokeBall />
            <span className="text-sm font-bold text-white whitespace-nowrap tracking-tight" style={{ fontFamily: 'var(--theme-font-display)' }}>
              Pokédex Tracker
            </span>
          </button>
        </div>

        {/* Center zone: flex-shrink-0 so it never gets pushed around */}
        <nav className="flex items-center gap-1 flex-shrink-0" aria-label="Main navigation">
          {/* ← arrow to tracker group */}
          <button
            onClick={() => setTabGroup("tracker")}
            disabled={tabGroup === "tracker"}
            title="Tracker tools"
            className={`p-1 rounded-md transition-colors ${
              tabGroup === "tracker"
                ? "text-gray-600 cursor-default"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
            aria-label="Switch to Tracker tabs"
          >
            <ChevronLeft size={16} />
          </button>

          {activeTabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white text-gray-900"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}

          {/* → arrow to frontier group */}
          <button
            onClick={() => setTabGroup("frontier")}
            disabled={tabGroup === "frontier"}
            title="Battle Frontier tools"
            className={`p-1 rounded-md transition-colors ${
              tabGroup === "frontier"
                ? "text-gray-600 cursor-default"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
            aria-label="Switch to Battle Frontier tabs"
          >
            <ChevronRight size={16} />
          </button>
        </nav>

        {/* Right zone: flex-1 + justify-end mirrors left zone width */}
        <div className="flex items-center gap-2 flex-1 justify-end ml-6">
          <SyncDot />
          <RestartButton />
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

    </header>
  );
}
