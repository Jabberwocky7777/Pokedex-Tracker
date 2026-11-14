/**
 * Everything that sits on top of the page and can be dismissed — dialogs, sheets,
 * menus, dropdowns, the detail panel, an inline edit — registers here while it is
 * open, so one call closes whichever is on top. Escape uses it in every browser,
 * and the Android app's Back button and B button use the same call
 * (lib/android-back.ts), so all three always agree on what "back" closes.
 *
 * Components use hooks/useLayer.ts rather than these functions.
 */

export interface Layer {
  close: () => void;
  /** False while the layer is open but out of sight (a tab kept mounted but hidden): it is skipped */
  isVisible?: () => boolean;
}

const stack: Layer[] = [];
let listening = false;

/** Adds a layer on top; the returned function removes it (idempotent). */
export function pushLayer(layer: Layer): () => void {
  stack.push(layer);
  listen();
  return () => {
    const i = stack.lastIndexOf(layer);
    if (i >= 0) stack.splice(i, 1);
  };
}

function topLayer(): Layer | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = stack[i];
    if (!layer.isVisible || layer.isVisible()) return layer;
  }
  return undefined;
}

/** True when something is open that closeTopLayer() would close. */
export function hasOpenLayer(): boolean {
  return topLayer() !== undefined;
}

/** Closes the top visible layer; false when nothing was open. */
export function closeTopLayer(): boolean {
  const layer = topLayer();
  if (!layer) return false;
  layer.close();
  return true;
}

/**
 * An element counts as visible while it has a box on the page and isn't hidden: App keeps
 * tabs that aren't open mounted with visibility: hidden, which (unlike display: none)
 * leaves their boxes in place, so the computed visibility is checked too.
 */
export function isShown(el: Element | null | undefined): boolean {
  if (!el || !el.isConnected || el.getClientRects().length === 0) return false;
  return typeof getComputedStyle !== "function" || getComputedStyle(el).visibility !== "hidden";
}

function listen() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.isComposing || e.defaultPrevented) return;
    if (closeTopLayer()) e.preventDefault();
  });
}

/** Tests only: forget every layer. */
export function resetLayersForTest(): void {
  stack.length = 0;
}
