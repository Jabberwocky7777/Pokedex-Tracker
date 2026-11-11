import { themes, DEFAULT_THEME, SYSTEM_THEME, resolveThemeId } from "../themes";
import { safeSetItem } from "./safe-storage";

let fontLink: HTMLLinkElement | null = null;
let systemQuery: MediaQueryList | null = null;
let followSystem: (() => void) | null = null;

const prefersLight = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;

/**
 * Switches the page to a theme. Themes recolour the app by overriding
 * Tailwind's own palette variables (--color-gray-*, --color-indigo-*) under
 * :root[data-theme="…"], so no component needs to know which theme is on.
 * Unknown ids fall back to the default theme.
 */
export function applyTheme(id: string) {
  // "Match system": follow the system's setting, now and whenever it changes
  if (systemQuery && followSystem) systemQuery.removeEventListener("change", followSystem);
  systemQuery = null;
  followSystem = null;
  if (id === SYSTEM_THEME && typeof matchMedia === "function") {
    systemQuery = matchMedia("(prefers-color-scheme: light)");
    followSystem = () => paint(resolveThemeId(SYSTEM_THEME, prefersLight()));
    systemQuery.addEventListener("change", followSystem);
  }
  paint(resolveThemeId(id, prefersLight()));
  // public/theme-init.js reads this before the app loads, so a reload doesn't
  // flash the default theme first ("system" is resolved there too)
  safeSetItem("pdx-theme", id === SYSTEM_THEME ? SYSTEM_THEME : document.documentElement.dataset.theme!);
}

function paint(id: string) {
  const theme = themes.find((t) => t.id === id) ?? themes.find((t) => t.id === DEFAULT_THEME)!;

  document.documentElement.dataset.theme = theme.id;

  // Every theme is built from the dark design (Light reverses its palette), so
  // Tailwind's dark: variants always apply
  document.documentElement.classList.add("dark");

  const styleId = "pdx-theme-vars";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  if (Object.keys(theme.vars).length > 0) {
    const vars = Object.entries(theme.vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");
    styleEl.textContent = `:root[data-theme="${theme.id}"] {\n${vars}\n}`;
  } else {
    styleEl.textContent = "";
  }

  // Fonts are served from this origin (CSP font-src 'self'), one stylesheet per theme
  if (fontLink) fontLink.remove();
  fontLink = null;
  if (theme.fonts) {
    fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = theme.fonts;
    document.head.appendChild(fontLink);
  }

  // The browser's address bar and the iOS status area match the page
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = theme.themeColor;
}
