import { useEffect, useRef, useState } from "react";
import { useSyncStatus } from "../../hooks/useSyncStatus";

type ToastKind = "synced" | "error";

interface ToastState {
  kind: ToastKind;
  message: string;
  id: number;
}

const AUTO_DISMISS_MS = 3_000;

export default function SyncToast() {
  const { changeCount, error } = useSyncStatus();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);
  const prevRef = useRef({ changeCount, error });

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { changeCount, error };

    let next: Omit<ToastState, "id"> | null = null;

    // Only a sync that actually sent or brought in changes is worth a toast;
    // the 30-second checks that find nothing new stay silent
    if (changeCount > prev.changeCount) {
      next = { kind: "synced", message: "Synced" };
    }
    // New error appeared
    if (error && !prev.error) {
      next = { kind: "error", message: "Sync failed" };
    }

    if (!next) return;

    if (dismissRef.current) clearTimeout(dismissRef.current);
    const id = ++idRef.current;
    setToast({ ...next, id });
    setVisible(true);
    dismissRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
  }, [changeCount, error]);

  if (!toast) return null;

  const colors =
    toast.kind === "error"
      ? "bg-red-900/90 border-red-700 text-red-200"
      : "bg-gray-800/90 border-gray-700 text-emerald-300";

  return (
    <div
      key={toast.id}
      className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 pointer-events-none
        ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
        px-4 py-2 rounded-full border text-sm font-medium shadow-lg backdrop-blur ${colors}`}
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
