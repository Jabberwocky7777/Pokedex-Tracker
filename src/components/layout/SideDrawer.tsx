import type { AppTab } from "../../types";

interface Tab {
  id: AppTab;
  label: string;
  icon: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tabs: Tab[];
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onLogout?: () => void;
}

/**
 * Left-side navigation drawer for mobile.
 * Slides in from the left; backdrop closes it on tap.
 * Only visible below the md breakpoint — desktop uses the tab bar.
 */
export default function SideDrawer({ open, onClose, tabs, activeTab, onSelectTab, onLogout }: Props) {
  return (
    <>
      {/* Backdrop — fades in behind the drawer, closes on tap */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="navigation"
        aria-label="Main navigation"
        className={`fixed left-0 top-0 h-full w-64 z-50 bg-gray-900 border-r border-gray-800
          flex flex-col transition-transform duration-300 ease-in-out md:hidden
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Drawer title */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800">
          <div className="w-6 h-6 rounded-full bg-red-500 relative overflow-hidden border-2 border-gray-300 flex-shrink-0">
            <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-gray-300" />
          </div>
          <span className="text-white font-bold text-sm">Pokédex Tracker</span>
        </div>

        {/* Tab buttons — 44 px minimum height for touch targets */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { onSelectTab(tab.id); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium
                transition-colors min-h-[44px] border-l-2
                ${activeTab === tab.id
                  ? "bg-gray-800 text-white border-blue-500"
                  : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 border-transparent"
                }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Sign out — pinned to bottom */}
        <div className="border-t border-gray-800 p-2">
          <button
            onClick={() => { onClose(); onLogout?.(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium
              text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 transition-colors
              rounded-lg min-h-[44px]"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
