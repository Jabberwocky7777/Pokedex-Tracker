// HOW TO ADD A NEW THEME:
// 1. Copy an existing theme object below
// 2. Change id, label, and override any vars (all keys required — see list below)
// 3. Push it to the `themes` array — nothing else needed
//
// Required var keys every theme must define:
//   Tailwind gray remap:   --color-gray-50 through --color-gray-950
//   Tailwind indigo remap: --color-indigo-200 through --color-indigo-950
//   Custom font vars:      --theme-font-display, --theme-font-body, --theme-font-mono
//   Custom stat vars:      --theme-stat-low, --theme-stat-mid, --theme-stat-high
//   Muted text vars:       --theme-text-muted (text-gray-500), --theme-text-faint (text-gray-600/700)
//                          — both must reach 4.5:1 on gray-900 and gray-950 (WCAG AA)
//
// fonts: the path of a stylesheet in public/fonts/ with the @font-face rules, or omit if no
// custom font is needed. Fonts are served from this origin (offline, and no request to
// Google): copy the woff2 files and the license into public/fonts/ alongside it.
// Example: '/fonts/my-font.css'

export interface AppTheme {
  id: string;
  label: string;
  fonts?: string;
  vars: Record<string, string>;
}

export const themes: AppTheme[] = [
  {
    id: 'dark',
    label: 'Dark',
    // No Tailwind color overrides — keeps the default gray/indigo palette.
    vars: {
      '--theme-font-display': 'system-ui, sans-serif',
      '--theme-font-body':    'system-ui, sans-serif',
      '--theme-font-mono':    "'Courier New', monospace",
      '--theme-stat-low':     '#7f1d1d',
      '--theme-stat-mid':     '#78350f',
      '--theme-stat-high':    '#14532d',
      // Tailwind's gray-500 is 3.7:1 on gray-900; these are 5.7:1 and 5.2:1
      '--theme-text-muted':   '#8b93a1',
      '--theme-text-faint':   '#848c9b',
    },
  },
  {
    id: 'burnished',
    label: 'Burnished',
    fonts: '/fonts/cormorant-garamond.css',
    vars: {
      // Remap Tailwind's gray scale → warm sepia tones
      '--color-gray-950': '#09080c',
      '--color-gray-900': '#100e18',
      '--color-gray-800': '#17141e',
      '--color-gray-700': '#221d2c',
      '--color-gray-600': '#2e2638',
      '--color-gray-500': '#3a3028',
      '--color-gray-400': '#b09040',
      '--color-gray-300': '#c8a860',
      '--color-gray-200': '#c0a878',
      '--color-gray-100': '#d8d0c4',
      '--color-gray-50':  '#ede8e0',
      // Remap indigo accent → burnished gold
      '--color-indigo-950': '#2a1a04',
      '--color-indigo-900': '#3a2408',
      '--color-indigo-800': '#4a2e0c',
      '--color-indigo-700': '#5a3e10',
      '--color-indigo-600': '#6a4a14',
      '--color-indigo-500': '#7c5a18',
      '--color-indigo-400': '#a07828',
      '--color-indigo-300': '#c09840',
      '--color-indigo-200': '#d4b870',
      // Custom vars (not Tailwind tokens)
      '--theme-font-display': "'Cormorant Garamond', Georgia, serif",
      '--theme-font-body':    "'Cormorant Garamond', Georgia, serif",
      '--theme-font-mono':    "'Courier New', monospace",
      '--theme-stat-low':     '#3a2c10',
      '--theme-stat-mid':     '#5a3e18',
      '--theme-stat-high':    '#7c5a18',
      // gray-500 here is a near-black brown (1.5:1); text gets these instead (5.8:1, 5.3:1)
      '--theme-text-muted':   '#a38a5c',
      '--theme-text-faint':   '#9a8458',
    },
  },
];

export const DEFAULT_THEME = 'dark';
