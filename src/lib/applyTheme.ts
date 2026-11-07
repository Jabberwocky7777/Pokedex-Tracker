import { themes, DEFAULT_THEME } from "../themes";

let fontLink: HTMLLinkElement | null = null;

/**
 * Switches the page to a theme. Themes recolour the app by overriding
 * Tailwind's own palette variables (--color-gray-*, --color-indigo-*) under
 * :root[data-theme="…"], so no component needs to know which theme is on.
 * Unknown ids fall back to the default theme.
 */
export function applyTheme(id: string) {
  const theme = themes.find((t) => t.id === id) ?? themes.find((t) => t.id === DEFAULT_THEME)!;

  document.documentElement.dataset.theme = theme.id;

  // Every theme is a dark palette, so Tailwind's dark: variants always apply
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

  // public/theme-init.js reads this before the app loads, so a reload doesn't
  // flash the default theme first
  localStorage.setItem("pdx-theme", theme.id);
}
