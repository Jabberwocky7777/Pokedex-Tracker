import { LayoutGrid, BookOpen, Map, Calculator, Wand2, Swords, Search, Zap, Settings, MoreHorizontal } from "lucide-react";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { AppTab } from "../../types";

type TabDef = { id: AppTab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> };

const TRACKER_TABS: TabDef[] = [
  { id: "tracker",    label: "Tracker",  Icon: LayoutGrid },
  { id: "pokedex",    label: "Pokédex",  Icon: BookOpen   },
  { id: "attackdex",  label: "Attacks",  Icon: Swords     },
  { id: "routes",     label: "Routes",   Icon: Map        },
  { id: "catch-calc", label: "Catch",    Icon: Calculator },
];

const FRONTIER_TABS: TabDef[] = [
  { id: "designer",       label: "Designer", Icon: Wand2     },
  { id: "trainer-lookup", label: "Trainer",  Icon: Search    },
  { id: "damage-calc",    label: "Damage",   Icon: Zap       },
  { id: "settings",       label: "Settings", Icon: Settings  },
];

export default function MobileBottomNav() {
  const activeTab    = useSettingsStore((s) => s.activeTab);
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);
  const tabGroup     = useSettingsStore((s) => s.tabGroup);
  const setTabGroup  = useSettingsStore((s) => s.setTabGroup);

  const activeTabs   = tabGroup === "tracker" ? TRACKER_TABS : FRONTIER_TABS;
  const isFrontier   = tabGroup === "frontier";

  // The "more" button cycles between groups
  function toggleGroup() {
    setTabGroup(isFrontier ? "tracker" : "frontier");
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-gray-950/95 backdrop-blur-md border-t border-gray-800/60"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch">

        {activeTabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex flex-col items-center justify-center flex-1 pt-2 pb-1.5 gap-0.5 min-h-[60px] relative"
              aria-current={isActive ? "page" : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-indigo-500" />
              )}
              <Icon
                size={26}
                className={isActive ? "text-indigo-400" : "text-gray-500"}
              />
              <span className={`text-[11px] font-medium leading-none ${
                isActive ? "text-indigo-400" : "text-gray-500"
              }`}>
                {label}
              </span>
            </button>
          );
        })}

        {/* Group switcher — small, at the far right */}
        <button
          onClick={toggleGroup}
          className="flex flex-col items-center justify-center px-3 pt-2 pb-1.5 gap-0.5 min-h-[60px] relative"
          aria-label={isFrontier ? "Switch to main tabs" : "Switch to Frontier tabs"}
          title={isFrontier ? "Main tabs" : "Frontier tabs"}
        >
          {/* Dot indicator for active group */}
          <span className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-0.5">
            <span className={`w-1 h-1 rounded-full ${!isFrontier ? "bg-indigo-500" : "bg-gray-700"}`} />
            <span className={`w-1 h-1 rounded-full ${isFrontier  ? "bg-indigo-500" : "bg-gray-700"}`} />
          </span>
          <MoreHorizontal size={24} className="text-gray-500 mt-1" />
          <span className="text-[11px] font-medium leading-none text-gray-500">
            {isFrontier ? "Main" : "More"}
          </span>
        </button>

      </div>
    </nav>
  );
}
