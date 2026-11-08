import { useCallback, useRef, useState } from "react";

/**
 * Where a menu opened from a button goes: just under it, never off the left edge. Measured when it
 * opens (in the click handler, not during render), so a scrolled or resized page is accounted for.
 */
export function usePopoverAnchor<T extends HTMLElement = HTMLButtonElement>(gap = 6, nudgeLeft = 0) {
  const ref = useRef<T>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 56, left: 8 });
  const measure = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + gap, left: Math.max(8, rect.left - nudgeLeft) });
  }, [gap, nudgeLeft]);
  return { ref, position, measure };
}
