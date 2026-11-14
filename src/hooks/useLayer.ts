import { useEffect, useRef, type RefObject } from "react";
import { isShown, pushLayer } from "../lib/layers";

/**
 * Registers something dismissable (lib/layers.ts) while `open` is true, so Escape —
 * and Back and B in the Android app — closes it when it is the top layer. With a
 * ref (or several, for something drawn in different places at different widths),
 * the layer is skipped while none of them is on screen.
 */
export function useLayer(
  open: boolean,
  onClose: () => void,
  refs?: RefObject<Element | null> | RefObject<Element | null>[],
): void {
  // The latest onClose, without re-registering (which would move the layer to the top)
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  const refList = useRef(refs);
  useEffect(() => {
    refList.current = refs;
  });

  useEffect(() => {
    if (!open) return;
    return pushLayer({
      close: () => close.current(),
      isVisible: () => {
        const r = refList.current;
        if (!r) return true;
        const list = Array.isArray(r) ? r : [r];
        // A ref not attached yet counts as visible, so a layer is never skipped by accident
        if (list.every((x) => x.current == null)) return true;
        return list.some((x) => isShown(x.current));
      },
    });
  }, [open]);
}
