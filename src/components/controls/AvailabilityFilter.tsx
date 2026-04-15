import { useSettingsStore } from "../../store/useSettingsStore";
import type { AvailabilityMode } from "../../types";

export default function AvailabilityFilter() {
  const { availabilityMode, setAvailabilityMode } = useSettingsStore();

  const options: { id: AvailabilityMode; label: string; title: string }[] = [
    {
      id: "all",
      label: "All",
      title: "Show all Pokémon regardless of game availability",
    },
    {
      id: "obtainable",
      label: "Obtainable",
      title: "Highlight Pokémon reachable in selected games: wild encounters, NPC trades, evolution, and breeding (baby Pokémon only)",
    },
    {
      id: "catchable",
      label: "Catchable",
      title: "Only Pokémon with direct wild, gift, or static encounters in selected games",
    },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setAvailabilityMode(opt.id)}
          title={opt.title}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            availabilityMode === opt.id
              ? opt.id === "all"
                ? "bg-gray-600 text-white shadow"
                : "bg-indigo-600 text-white shadow"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
