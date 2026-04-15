import { useSettingsStore } from "../../store/useSettingsStore";
import type { MetaData } from "../../types";

interface Props {
  meta: MetaData;
}

export default function DexModeSelector({ meta }: Props) {
  const { dexMode, setDexMode, activeGeneration } = useSettingsStore();

  const availableRegionalDexes = meta.regionalDexes.filter((rd) => {
    const genMeta = meta.generations.find((g) => g.id === activeGeneration);
    if (!genMeta) return false;
    return rd.games.some((g) => (genMeta.versions as string[]).includes(g));
  });

  if (availableRegionalDexes.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setDexMode("national")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          dexMode === "national"
            ? "bg-indigo-600 text-white"
            : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        }`}
      >
        National
      </button>
      {availableRegionalDexes.map((rd) => (
        <button
          key={rd.id}
          onClick={() => setDexMode(dexMode === rd.id ? "national" : rd.id)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            dexMode === rd.id
              ? "bg-indigo-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          }`}
        >
          {rd.name}
        </button>
      ))}
    </div>
  );
}
