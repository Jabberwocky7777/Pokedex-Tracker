import { useEffect } from "react";
import { useUndoStore } from "../../store/useUndoStore";

const AUTO_DISMISS_MS = 5_000;

/** "Unmarked Gengar · Undo" — shown for 5 seconds after any mark change. */
export default function UndoToast() {
  const toast = useUndoStore((s) => s.toast);
  const dismiss = useUndoStore((s) => s.dismiss);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;

  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(8rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-1/2 -translate-x-1/2 z-[70]
        flex items-center gap-3 pl-4 pr-2 py-1.5 rounded-full border border-gray-700 bg-gray-800/95
        text-sm text-gray-100 shadow-lg backdrop-blur max-w-[calc(100vw-2rem)]"
    >
      <span className="truncate">{toast.message}</span>
      <button
        onClick={() => { toast.undo(); dismiss(); }}
        className="px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex-shrink-0 min-h-[32px]"
      >
        Undo
      </button>
    </div>
  );
}
