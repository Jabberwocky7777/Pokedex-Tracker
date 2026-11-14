/**
 * Opening the search across everything (the command palette, which App owns)
 * from anywhere: the header's search button, the More sheet, Ctrl/Cmd+K and,
 * in the Android app, the Y button.
 */
const OPEN_SEARCH = "pdx-open-search";

export function openSearch(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_SEARCH));
}

/** App's listener; returns the function that removes it. */
export function onOpenSearch(listener: () => void): () => void {
  window.addEventListener(OPEN_SEARCH, listener);
  return () => window.removeEventListener(OPEN_SEARCH, listener);
}
