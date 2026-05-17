import { useState, useEffect } from "react";
import { useSettingsStore } from "./store/useSettingsStore";
import Layout from "./components/layout/Layout";
import CatchCalculator from "./components/catch-calculator/CatchCalculator";
import DesignerTab from "./components/designer/DesignerTab";
import RouteInfo from "./components/route-info/RouteInfo";
import PokedexTab from "./components/pokedex/PokedexTab";
import AttackdexTab from "./components/attackdex/AttackdexTab";
import TrainerLookupTab from "./components/trainer-lookup/TrainerLookupTab";
import DamageCalcTab from "./components/damage-calc/DamageCalcTab";
import SettingsTab from "./components/settings/SettingsTab";
import LoginScreen from "./components/auth/LoginScreen";
import NativeOnboardingScreen from "./components/auth/NativeOnboardingScreen";
import MobileBottomNav from "./components/layout/MobileBottomNav";
import SyncToast from "./components/layout/SyncToast";
import { useSyncEngine } from "./hooks/useSyncEngine";
import { hasToken, clearToken, hasServerUrl } from "./lib/sync";
import { Capacitor } from "@capacitor/core";
import metaData from "./data/meta.json";
import type { Pokemon, MetaData, AppTab } from "./types";

const meta = metaData as MetaData;

// All tab IDs — used to build the keep-alive slot list
const ALL_TABS: AppTab[] = [
  "tracker", "pokedex", "attackdex", "routes", "catch-calc",
  "designer", "trainer-lookup", "damage-calc", "settings",
];

// Renderless component — mounts sync behaviour (pull on load, push on change, 30s poll)
function SyncEngine() {
  useSyncEngine();
  return null;
}

function renderTab(tab: AppTab, allPokemon: Pokemon[], meta: MetaData, onLogout: () => void) {
  switch (tab) {
    case "tracker":       return <Layout allPokemon={allPokemon} meta={meta} onLogout={onLogout} />;
    case "pokedex":       return <PokedexTab allPokemon={allPokemon} meta={meta} />;
    case "attackdex":     return <AttackdexTab allPokemon={allPokemon} meta={meta} />;
    case "routes":        return <RouteInfo allPokemon={allPokemon} meta={meta} />;
    case "catch-calc":    return <CatchCalculator allPokemon={allPokemon} meta={meta} />;
    case "designer":      return <DesignerTab allPokemon={allPokemon} meta={meta} />;
    case "trainer-lookup":return <TrainerLookupTab allPokemon={allPokemon} meta={meta} />;
    case "damage-calc":   return <DamageCalcTab allPokemon={allPokemon} meta={meta} />;
    case "settings":      return <SettingsTab allPokemon={allPokemon} meta={meta} onLogout={onLogout} />;
  }
}

function App() {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const [allPokemon, setAllPokemon] = useState<Pokemon[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Lazy keep-alive: track which tabs have been visited so they stay mounted.
  // Visibility (not mounting) is toggled — first visit pays the mount cost once,
  // every subsequent switch is instant with zero remount overhead.
  const [mountedTabs, setMountedTabs] = useState<Set<AppTab>>(() => new Set([activeTab]));
  if (!mountedTabs.has(activeTab)) {
    setMountedTabs(prev => new Set([...prev, activeTab]));
  }

  // On native: track whether both a server URL and an auth token are already stored.
  // If either is missing, show the combined onboarding screen.
  const isNative = Capacitor.isNativePlatform();
  const [hasServer, setHasServer] = useState(() => !isNative || hasServerUrl());
  // Auth state — initialize from localStorage so we don't flash the login screen on reload
  const [isAuthed, setIsAuthed] = useState(() => hasToken());

  useEffect(() => {
    setAllPokemon(null); // eslint-disable-line react-hooks/set-state-in-effect -- reset before re-fetch when retryKey changes
    setLoadError(false);
    fetch("/data/pokemon.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((pokemon) => setAllPokemon(pokemon as Pokemon[]))
      .catch(() => setLoadError(true));
  }, [retryKey]);

  function handleLogout() {
    clearToken();
    setIsAuthed(false);
  }

  useEffect(() => {
    function onUnauthorized() { handleLogout(); }
    window.addEventListener("pdx:unauthorized", onUnauthorized);
    return () => window.removeEventListener("pdx:unauthorized", onUnauthorized);
  }, []);

  // Native app: single combined onboarding when server URL or auth token is missing
  if (isNative && (!hasServer || !isAuthed)) {
    return (
      <NativeOnboardingScreen
        onSuccess={() => { setHasServer(true); setIsAuthed(true); }}
      />
    );
  }

  // Web: show login screen until the user has a sync token
  if (!isAuthed) {
    return <LoginScreen onSuccess={() => setIsAuthed(true)} />;
  }

  // ── App shell ─────────────────────────────────────────────────────────────
  // fixed inset-0 guarantees no document-level scroll on iOS (no rubber-band
  // on the outer shell). All content scrolling happens inside individual tabs.
  return (
    <div className="fixed inset-0 bg-gray-950 text-gray-100">
      <SyncEngine />

      {/* Loading screen */}
      {!allPokemon && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500 relative overflow-hidden border-2 border-gray-300 animate-pulse flex-shrink-0">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-gray-300" />
            </div>
            <span className="text-sm">Loading Pokédex data…</span>
          </div>
        </div>
      )}

      {/* Error screen */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <span className="text-4xl">⚠️</span>
            <div>
              <p className="text-gray-200 font-semibold mb-1">Failed to load Pokédex data</p>
              <p className="text-sm text-gray-500">Could not fetch <code className="text-gray-400">/data/pokemon.json</code>.</p>
            </div>
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="mt-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Tab keep-alive slots — all tabs occupy the same absolute position.
          Tabs are mounted on first visit and kept mounted thereafter.
          Inactive tabs are hidden via visibility:hidden + pointer-events:none
          so they hold no layout space and accept no input, but their DOM and
          React state are fully preserved. Tab switches are instant after the
          first visit to each tab. */}
      {allPokemon && ALL_TABS.map(tab => (
        <div
          key={tab}
          className="absolute inset-0"
          style={{
            visibility: activeTab === tab ? "visible" : "hidden",
            pointerEvents: activeTab === tab ? "auto" : "none",
            // Subtle fade so the active tab appears cleanly
            opacity: activeTab === tab ? 1 : 0,
            transition: "opacity 120ms ease",
          }}
        >
          {mountedTabs.has(tab) && renderTab(tab, allPokemon, meta, handleLogout)}
        </div>
      ))}

      {/* Global navigation — always rendered, sits on top of tab content */}
      {allPokemon && (
        <>
          <MobileBottomNav />
          <SyncToast />
        </>
      )}
    </div>
  );
}

export default App;
