# Pokédex Tracker — Codebase Guide

## Git Workflow

Always commit directly to `main`. Never create feature branches or worktree branches — just stage and push to `main`.

## iOS Release Checklist (AltStore Source)

The repo serves an AltStore/SideStore source at `https://jabberwocky7777.github.io/Pokedex-Tracker/apps.json` via GitHub Pages.

**Every time a new iOS version is released, update `apps.json` before committing:**

| Field | What to set |
|-------|-------------|
| `version` | New semver string, e.g. `"1.1.0"` |
| `versionDate` | Release date as `YYYY-MM-DD` |
| `downloadURL` | `https://github.com/Jabberwocky7777/Pokedex-Tracker/releases/download/vX.Y.Z/PokedexTracker.ipa` |
| `size` | IPA size in bytes — run `(Get-Item PokedexTracker.ipa).Length` in PowerShell, or ask the user |

Include the `apps.json` update in the same commit as the version bump. GitHub Pages rebuilds automatically on push to `main` (takes ~1 min).

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| UI framework | React | 19.x |
| Language | TypeScript | 6.x |
| State management | Zustand | 5.x (with `persist` middleware) |
| Styling | Tailwind CSS | 4.x (via `@tailwindcss/vite`) |
| Build tool | Vite | 8.x |
| Sync server | Express (Node.js) | — |

## Directory Structure

```
src/
├── App.tsx                  # Root: loads pokemon.json, mounts sync engine, renders layout
├── main.tsx                 # Vite entry point
├── types/                   # Shared TypeScript interfaces (Pokemon, MetaData, AppTab, …)
├── themes/                  # Theme registry (AppTheme interface, dark + burnished themes)
├── store/                   # Zustand stores (see below)
├── hooks/                   # Custom React hooks
├── lib/                     # Pure utility modules (no React); includes applyTheme.ts
├── data/                    # Static JSON (genMeta, npc-trades — committed)
├── styles/                  # Tailwind CSS entry (index.css)
└── components/
    ├── ThemeSelector.tsx    # Theme dropdown — wired to useSettingsStore
    ├── layout/              # Header, FilterSubbar, SyncDot, SyncToast, MobileBottomNav, Layout
    ├── auth/                # LoginScreen
    ├── controls/            # Shared input components (SearchBar, …)
    ├── box-view/            # BoxView, PokemonCell — grid view for the tracker tab
    ├── list-view/           # ListView — list view for the tracker tab
    ├── pokedex/             # PokedexTab, StatPanel, MovesSection, MoveTable, SectionHeading, …
    ├── attackdex/           # AttackdexPanel, MoveSearchBar, MoveDetailPanel
    ├── detail-panel/        # DetailPanel, LocationTable (encounter locations for a Pokémon)
    ├── route-info/          # RouteInfo, RouteDetail (encounter tables browsed by location)
    ├── catch-calculator/    # CatchCalculator
    ├── designer/            # DesignerTab, SlotAccordion, IvSection, EvSection, MovePicker, PcBoxPanel
    ├── pc-box/              # PcBoxLayout, PcBoxGrid, BoxGameSelector
    └── shared/              # TypeBadge, StatBar, NatureSelector (reused across tabs)

sync-server/
├── server.js               # Express API: /api/login, /api/pull, /api/push, /health
└── package.json

scripts/
└── fetch-data.ts           # Fetches PokéAPI → writes public/data/pokemon.json + src/data/*.json
                            # Run via: npm run generate-data

public/
├── data/pokemon.json       # Pre-generated Pokémon data (committed, ~9 MB)
└── env.js                  # Runtime sync config (gitignored — created per-device)
```

## Zustand Stores

| Store | File | Persisted | Contents |
|-------|------|-----------|----------|
| `useDexStore` | `store/useDexStore.ts` | ✅ localStorage | `caughtByGen`, `pendingByGen` — catch/pending sets per generation |
| `useDesignerStore` | `store/useDesignerStore.ts` | ✅ localStorage | `slots[]` — up to 6 team slots with IVs, EVs, nature, moves |
| `useSettingsStore` | `store/useSettingsStore.ts` | ✅ localStorage | `activeTab`, `activeGeneration`, `selectedPokemonId`, filter prefs |
| `useSyncStatus` | `hooks/useSyncStatus.ts` | ❌ in-memory | `syncing`, `lastSynced`, `error`, `forcePush` — sync UI state |
| `useBoxSlotStore` | `store/useBoxSlotStore.ts` | ✅ localStorage | `slotsByGen` — PC box assignments per generation/game/box |
| `useIvStore` | `store/useIvStore.ts` | ✅ localStorage | `savedSessions` — named IV checker session saves |

## Application Tabs

| Tab ID | Component | Description |
|--------|-----------|-------------|
| `tracker` | `TrackerTab` | Grid/list/PC-box view for all 493 Gen I–IV Pokémon. Caught/pending toggles, progress bar, game + availability filtering. |
| `pokedex` | `PokedexTab` | Single Pokémon detail: base stats, side-by-side stat comparison, full learnset (level-up, TM/HM, egg, tutor) via PokéAPI, and "Where to Find" encounter location table. |
| `routes` | `RoutesTab` | Browse encounter tables by location, version, and method. HGSS routes show morning/day/night time-of-day encounter badges. |
| `catch-calc` | `CatchCalculator` | Gen III/IV catch rate formula with all Poké Balls, status conditions, HP modifiers, and retro battle HP bar UI. |
| `designer` | `DesignerTab` | Team builder: IV range narrowing, stat projections, EV planning, nature selection, move picker (PokéAPI), PC Box slot management. |
| `attackdex` | `AttackdexPanel` | Move browser: search any of the 467 Gen I–IV moves, view power/accuracy/PP/effect, and see which Pokémon learn it. |

> **Note:** The designer tab was previously called "IV checker". A store migration in `useSettingsStore` maps the old tab name transparently.

## Data Flow

```
App boot
  └─ fetch /data/pokemon.json        → allPokemon[] in App state → passed as props
  └─ useSyncEngine (hook)
       ├─ doPull() on mount           → applySnapshot() → Zustand stores
       ├─ setInterval(doPull, 30s)   → pauses when document.hidden
       └─ state change (debounced 2s) → pushData() → /api/push
```

## Sync Architecture

- **Auth:** User logs in at `/api/login` → receives `SYNC_TOKEN` → stored in `localStorage` as `pokedex_sync_token`
- **Pull:** `GET /api/pull` every 30 s (pauses when tab is hidden); applies snapshot to Zustand stores
- **Push:** Debounced 2 s after any state change; sends full snapshot to `POST /api/push`
- **Sync indicator:** `SyncDot` in the header shows live status (idle / syncing / synced / stale / error)
- **Config:** `public/env.js` (gitignored) sets `window.__ENV__.SYNC_TOKEN` at runtime; Vite proxies `/api/*` → `localhost:3001` in dev

## Key Utility Modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `sync.ts` | `getToken/setToken`, `pullData`, `pushData`, `buildPayload` |
| `backup.ts` | `BackupData` type; serialise/deserialise store state |
| `iv-calc.ts` | `findIVs`, `ivRange`, `intersectIVSets`, `calculateHiddenPower` |
| `move-fetch.ts` | PokéAPI learnset + move detail fetching with module-level caches |
| `type-colors.ts` | `TYPE_COLORS` (hex) and `TYPE_BG_COLORS` (Tailwind classes) for all 18 types |
| `pokemon-filter.ts` | BFS evolution walk, obtainability filter, generation/game filtering |

## Development Setup

```bash
npm install
npm run dev          # Vite dev server → http://localhost:5173
```

To run sync locally:
```bash
# Terminal 1
SYNC_TOKEN=dev-token DATA_DIR=./data node sync-server/server.js

# Terminal 2
npm run dev
```

Then create `public/env.js` (gitignored):
```js
window.__ENV__ = { SYNC_TOKEN: "dev-token" };
```

## Available Scripts

| Script | Action |
|--------|--------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build → `dist/` |
| `npm run preview` | Serve the `dist/` build locally |
| `npm run lint` | ESLint |
| `npm run generate-data` | Run `scripts/fetch-data.ts` → regenerate `public/data/pokemon.json` (3–5 min) |

## Design System Notes

- **Theme system.** All themes are dark-palette based. The active theme is stored in `useSettingsStore` under `theme` (persisted to `localStorage` key `pdx-theme`). `applyTheme()` in `src/lib/applyTheme.ts` sets `data-theme` on `<html>` and injects a `<style id="pdx-theme-vars">` block with scoped CSS variable overrides. Add new themes by extending `src/themes/index.ts`.
- **Tailwind v4 variable remapping.** Themes override Tailwind's internal CSS variables (`--color-gray-*`, `--color-indigo-*`) under `:root[data-theme="x"]`, so every utility class picks up the new palette automatically — no per-component changes needed.
- **Display font.** Heading elements use `style={{ fontFamily: 'var(--theme-font-display)' }}` inline. Each theme sets `--theme-font-display` in its `vars`. Do not hardcode font families in component styles.
- **Background: `gray-950` / `gray-900`.** Text: `gray-100` (primary), `gray-400` (secondary).
- **Accent color:** `indigo-500/600` for primary actions; `pink-500/600` for Pokédex compare slot B.
- **Type badges:** Use `TYPE_BG_COLORS` from `lib/type-colors.ts` — full Tailwind class strings, correctly scanned by Tailwind v4.
- **Gen III battle screen** in `CatchCalculator` uses intentional hardcoded hex colors for retro aesthetic — do not "fix" these.
- **Stat bar colors** use CSS vars `var(--theme-stat-low/mid/high)` in `pokedexHelpers.ts` — thresholds: <65 low, ≤90 mid, >90 high.

## Deployment

Docker image built via GitHub Actions on every push to `main`. Deployed on TrueNAS SCALE as a custom app on port 7777. See `README.md` for full deploy steps.

Environment variables required by the container:
- `APP_USER` — login username
- `APP_PASSWORD` — login password
- `SYNC_TOKEN` — sync API secret (generate with `openssl rand -hex 32`)
- `CORS_ORIGIN` — (optional) restrict CORS to a specific origin, e.g. `http://192.168.1.50:7777`
