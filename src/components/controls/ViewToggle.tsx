import { LayoutGrid, List, Grid3X3, Compass } from "lucide-react";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { ViewMode } from "../../types";

const OPTIONS: { id: ViewMode; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "box",   label: "Box view",    Icon: LayoutGrid },
  { id: "list",  label: "List view",   Icon: List       },
  { id: "slots", label: "Slot layout", Icon: Grid3X3    },
  { id: "next",  label: "What can I get next", Icon: Compass },
];

export default function ViewToggle() {
  const viewMode = useSettingsStore((s) => s.viewMode);
  const setViewMode = useSettingsStore((s) => s.setViewMode);

  return (
    <div className="flex items-center rounded-md overflow-hidden border border-gray-700">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => setViewMode(id)}
          title={label}
          aria-label={label}
          className={`px-3 py-1.5 text-sm transition-all ${
            viewMode === id
              ? "bg-gray-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
