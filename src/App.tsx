import { useState, useEffect } from "react";
import { useSettingsStore } from "./store/useSettingsStore";
import Layout from "./components/layout/Layout";
import CatchCalculator from "./components/catch-calculator/CatchCalculator";
import IvChecker from "./components/iv-checker/IvChecker";
import RouteInfo from "./components/route-info/RouteInfo";
import PokedexTab from "./components/pokedex/PokedexTab";
import { useSyncEngine } from "./hooks/useSyncEngine";
import metaData from "./data/meta.json";
import type { Pokemon, MetaData } from "./types";

const meta = metaData as MetaData;

// Renderless component — mounts sync behaviour (pull on load, push on change)
function SyncEngine() {
  useSyncEngine();
  return null;
}

function App() {
  const { activeTab } = useSettingsStore();
  const [allPokemon, setAllPokemon] = useState<Pokemon[] | null>(null);

  useEffect(() => {
    fetch("/data/pokemon.json")
      .then((r) => r.json())
      .then((pokemon) => setAllPokemon(pokemon as Pokemon[]));
  }, []);

  if (!allPokemon) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500 relative overflow-hidden border-2 border-gray-300 animate-pulse flex-shrink-0">
            <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-gray-300" />
          </div>
          <span className="text-sm">Loading Pokédex data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-950 dark:bg-gray-950 text-gray-100 dark:text-gray-100">
      <SyncEngine />
      {activeTab === "tracker" && (
        <Layout allPokemon={allPokemon} meta={meta} />
      )}
      {activeTab === "catch-calc" && (
        <CatchCalculator allPokemon={allPokemon} meta={meta} />
      )}
      {activeTab === "iv-checker" && (
        <IvChecker allPokemon={allPokemon} meta={meta} />
      )}
      {activeTab === "routes" && (
        <RouteInfo allPokemon={allPokemon} meta={meta} />
      )}
      {activeTab === "pokedex" && (
        <PokedexTab allPokemon={allPokemon} meta={meta} />
      )}
    </div>
  );
}

export default App;
