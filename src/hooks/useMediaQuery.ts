import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches now, kept up to date as the window changes (rotating an iPad,
 * resizing a Split View). For layout that CSS alone can't decide; prefer Tailwind variants.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
