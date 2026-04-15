import { useSettingsStore } from "../../store/useSettingsStore";
import type { MetaData } from "../../types";

interface Props {
  meta: MetaData;
}

export default function GenerationSelector({ meta }: Props) {
  const { activeGeneration, setActiveGeneration } = useSettingsStore();

  if (meta.activeGenerations.length <= 1) return null;

  return (
    <select
      value={activeGeneration}
      onChange={(e) => setActiveGeneration(Number(e.target.value))}
      className="px-2 py-1.5 rounded-md text-sm font-medium bg-gray-800 text-gray-200 border border-gray-700 hover:border-gray-500 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
      aria-label="Select generation"
    >
      {meta.activeGenerations.map((genId) => {
        const genMeta = meta.generations.find((g) => g.id === genId);
        if (!genMeta) return null;
        return (
          <option key={genId} value={genId}>
            Gen {genId}
          </option>
        );
      })}
    </select>
  );
}
