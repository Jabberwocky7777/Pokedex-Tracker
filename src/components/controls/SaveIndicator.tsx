import { useEffect, useRef, useState } from "react";
import { useDexStore } from "../../store/useDexStore";

export default function SaveIndicator() {
  const caughtByGen = useDexStore((s) => s.caughtByGen);
  const pendingByGen = useDexStore((s) => s.pendingByGen);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    // Skip the very first render (initial load from localStorage)
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [caughtByGen, pendingByGen]);

  return (
    <div
      className={`flex items-center gap-1 text-xs font-medium transition-opacity duration-500 ${
        visible ? "opacity-100 text-green-400" : "opacity-0 text-green-400"
      }`}
      aria-live="polite"
    >
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      Saved
    </div>
  );
}
