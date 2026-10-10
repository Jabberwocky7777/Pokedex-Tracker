import { useCallback, useEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Touch long-press (about half a second) for an element that also handles clicks.
 *
 * Spread `handlers` onto the element and use `pressing` for a visual press state.
 * After a long-press fires, the click that the browser sends on release must be
 * ignored — call `consumeClick()` at the top of the click handler and bail out
 * when it returns true. `wasTouch()` tells a context-menu handler whether the
 * menu came from a touch long-press (already handled here) or a real right-click.
 */
export function useLongPress(onLongPress: () => void) {
  const [pressing, setPressing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const lastPointerWasTouch = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
    setPressing(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      lastPointerWasTouch.current = e.pointerType === "touch";
      fired.current = false;
      if (e.pointerType !== "touch") return;
      start.current = { x: e.clientX, y: e.clientY };
      setPressing(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        setPressing(false);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      // Finger moved — the user is scrolling, not pressing
      if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
  );

  const consumeClick = useCallback(() => {
    if (!fired.current) return false;
    fired.current = false;
    return true;
  }, []);

  const wasTouch = useCallback(() => lastPointerWasTouch.current, []);

  return {
    pressing,
    consumeClick,
    wasTouch,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
    },
  };
}
