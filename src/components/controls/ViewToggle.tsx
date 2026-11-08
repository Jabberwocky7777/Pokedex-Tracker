import { LayoutGrid, List, Grid3X3 } from "lucide-react";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { ViewMode } from "../../types";

const OPTIONS: { id: ViewMode; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "box", label: "Box view", Icon: LayoutGrid },
  { id: "list", label: "List view", Icon: List },
  { id: "slots", label: "Slot layout", Icon: Grid3X3 },
];

export default function ViewToggle() {
  const viewMode = useSettingsStore((s) => s.viewMode);
  const setViewMode = useSettingsStore((s) => s.setViewMode);

  return (
    <div className="flex items-center rounded-lg overflow-hidden border border-gray-700 flex-shrink-0">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => setViewMode(id)}
          title={label}
          aria-label={label}
          aria-pressed={viewMode === id}
          // 36 px, 44 px on a touch screen — the toolbar's height
          className={`w-9 h-[34px] pointer-coarse:w-11 pointer-coarse:h-[42px] flex items-center justify-center text-sm transition-colors ${
            viewMode === id ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
