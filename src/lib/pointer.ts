/**
 * True on a touch screen (the primary pointer is a finger). Hover-only and
 * right-click-only controls show a visible button instead when this is true.
 */
export const COARSE_POINTER = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
