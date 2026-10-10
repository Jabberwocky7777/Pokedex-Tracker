import { useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: "Shift + C", action: "Toggle caught on selected Pokémon" },
  { keys: "Shift + →  /  ↓", action: "Select next Pokémon" },
  { keys: "Shift + ←  /  ↑", action: "Select previous Pokémon" },
  { keys: "Shift + Enter", action: "Select first Pokémon (when none selected)" },
  { keys: "?", action: "Open this help dialog" },
  { keys: "Escape", action: "Close this dialog" },
];

export default function ShortcutModal({ onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Keyboard Shortcuts</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-200">
            <X size={18} />
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs">
              <th className="pb-2 font-medium w-1/2">Shortcut</th>
              <th className="pb-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map(({ keys, action }) => (
              <tr key={keys} className="border-t border-gray-800">
                <td className="py-2 pr-4">
                  <kbd className="font-mono text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-300">
                    {keys}
                  </kbd>
                </td>
                <td className="py-2 text-gray-300">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
