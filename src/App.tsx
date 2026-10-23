import { useState, useEffect, lazy, Suspense } from "react";
import { useSettingsStore } from "./store/useSettingsStore";
import Layout from "./components/layout/Layout";
import LoginScreen from "./components/auth/LoginScreen";
import NativeOnboardingScreen from "./components/auth/NativeOnboardingScreen";
import MobileBottomNav from "./components/layout/MobileBottomNav";
import Header from "./components/layout/Header";
import SyncToast from "./components/layout/SyncToast";
import UndoToast from "./components/layout/UndoToast";
import { useSyncEngine } from "./hooks/useSyncEngine";
import { isSignedIn, isLocalMode, setLocalMode, clearToken, hasServerUrl, initStorage } from "./lib/sync";
import { Capacitor } from "@capacitor/core";
import { AlertTriangle } from "lucide-react";
import metaData from "./data/meta.json";
import { APP_TABS, type Pokemon, type MetaData, type AppTab } from "./types";

const meta = metaData as MetaData;

// The tracker is the landing tab and loads with the app. Every other tab is its
// own chunk, fetched the first time it is opened (the Battle Tower data alone
// is several hundred kB that most visits never need).
const CatchCalculator  = lazy(() => import("./components/catch-calculator/CatchCalculator"));
const DesignerTab      = lazy(() => import("./components/designer/DesignerTab"));
const RouteInfo        = lazy(() => import("./components/route-info/RouteInfo"));
const PokedexTab       = lazy(() => import("./components/pokedex/PokedexTab"));
const AttackdexTab     = lazy(() => import("./components/attackdex/AttackdexTab"));
const TrainerLookupTab = lazy(() => import("./components/trainer-lookup/TrainerLookupTab"));
const DamageCalcTab    = lazy(() => import("./components/damage-calc/DamageCalcTab"));
const SettingsTab      = lazy(() => import("./components/settings/SettingsTab"));
const NotesTab         = lazy(() => import("./components/notes/NotesTab"));

// Renderless component — mounts sync behaviour (pull on load, push on change, 30s poll)
function SyncEngine() {
  useSyncEngine();
  return null;
}

function renderTab(tab: AppTab, allPokemon: Pokemon[], meta: MetaData, onLogout: () => void, onSignIn: () => void) {
  switch (tab) {
    case "tracker":       return <Layout allPokemon={allPokemon} meta={meta} />;
    case "pokedex":       return <PokedexTab allPokemon={allPokemon} meta={meta} />;
    case "attackdex":     return <AttackdexTab allPokemon={allPokemon} meta={meta} />;
    case "routes":        return <RouteInfo allPokemon={allPokemon} meta={meta} />;
    case "catch-calc":    return <CatchCalculator allPokemon={allPokemon} meta={meta} />;
    case "designer":      return <DesignerTab allPokemon={allPokemon} meta={meta} />;
    case "trainer-lookup":return <TrainerLookupTab allPokemon={allPokemon} meta={meta} />;
    case "damage-calc":   return <DamageCalcTab allPokemon={allPokemon} meta={meta} />;
    case "notes":         return <NotesTab allPokemon={allPokemon} meta={meta} />;
    case "settings":      return <SettingsTab allPokemon={allPokemon} meta={meta} onLogout={onLogout} onSignIn={onSignIn} />;
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
  // storageReady: on native we run initStorage() first to recover credentials from
  // Preferences (iOS UserDefaults) before reading localStorage. This handles the case
  // where a SideStore/AltStore update wipes WKWebView's localStorage.
  const [storageReady, setStorageReady] = useState(!isNative);
  const [hasServer, setHasServer] = useState(() => !isNative || hasServerUrl());
  // Auth state — initialize from localStorage so we don't flash the login screen on reload.
  // "Signed in" means either a sync token or explicit local (offline) mode.
  const [isAuthed, setIsAuthed] = useState(() => isSignedIn());
  // A local-mode user asked to sign in: show the login screen without leaving
  // local mode, so cancelling (or reloading) drops them back into the app.
  const [signInRequested, setSignInRequested] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    // If Preferences can't be read, carry on with whatever localStorage has
    // rather than leaving the app on a blank screen
    initStorage().catch(() => {}).finally(() => {
      // Re-read after Preferences recovery — localStorage may now have the token/URL
      setHasServer(hasServerUrl());
      setIsAuthed(isSignedIn());
      setStorageReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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
    setLocalMode(false);
    setIsAuthed(false);
  }

  function handleAuthSuccess() {
    setHasServer(hasServerUrl());
    setSignInRequested(false);
    setIsAuthed(true);
  }

  useEffect(() => {
    function onUnauthorized() { handleLogout(); }
    window.addEventListener("pdx:unauthorized", onUnauthorized);
    return () => window.removeEventListener("pdx:unauthorized", onUnauthorized);
  }, []);

  // Wait for Preferences recovery before deciding auth state on native
  if (!storageReady) return null;

  // Native app: single combined onboarding when server URL or auth token is missing
  // (local mode needs neither)
  if (isNative && (!isAuthed || signInRequested || (!hasServer && !isLocalMode()))) {
    return <NativeOnboardingScreen onSuccess={handleAuthSuccess} />;
  }

  // Web: show login screen until the user has a sync token or picks offline mode
  if (!isAuthed || signInRequested) {
    return <LoginScreen onSuccess={handleAuthSuccess} />;
  }

  // ── App shell ─────────────────────────────────────────────────────────────
  // fixed inset-0 guarantees no document-level scroll on iOS (no rubber-band
  // on the outer shell). All content scrolling happens inside individual tabs.
  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 text-gray-100">
      <SyncEngine />

      {/* The one header, above whichever tab is open */}
      {allPokemon && <Header meta={meta} />}

      <div className="relative flex-1 min-h-0">

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
            <AlertTriangle size={40} className="text-amber-400" aria-hidden="true" />
            <div>
              <p className="text-gray-200 font-semibold mb-1">Failed to load Pokédex data</p>
              <p className="text-sm text-gray-500">Could not fetch <code className="text-gray-400">/data/pokemon.json</code>.</p>
            </div>
            <button
              onClick={() => {
                setAllPokemon(null);
                setLoadError(false);
                setRetryKey((k) => k + 1);
              }}
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
      {allPokemon && APP_TABS.map(tab => (
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
          {mountedTabs.has(tab) && (
            <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
              {renderTab(tab, allPokemon, meta, handleLogout, () => setSignInRequested(true))}
            </Suspense>
          )}
        </div>
      ))}
      </div>

      {/* Global navigation — always rendered, sits on top of tab content */}
      {allPokemon && (
        <>
          <MobileBottomNav />
          <SyncToast />
          <UndoToast />
        </>
      )}
    </div>
  );
}

export default App;
