# Pokédex Tracker — Codebase Guide

## Git Workflow

Always commit directly to `main`. Never create feature branches or worktree branches — just stage and push to `main`.

## iOS Release Checklist (AltStore/SideStore Source)

The repo serves an AltStore/SideStore source at `https://jabberwocky7777.github.io/Pokedex-Tracker/apps.json` via GitHub Pages.
Icons (source + app) use `pokeball.png` committed to the repo root.

### Version rule — CRITICAL
The `version` field in `apps.json` **must exactly match** `MARKETING_VERSION` in
`ios/App/App.xcodeproj/project.pbxproj` (both Debug and Release configs), which is what ends up in the IPA's `CFBundleShortVersionString`.
SideStore compares them and will refuse to install if they differ.

**Always update `MARKETING_VERSION` in `project.pbxproj` first, then copy that exact string into `apps.json`.**

### Full release steps

1. **Bump version in Xcode project** — edit both occurrences of `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` to the new version (e.g. `1.1`).

2. **Trigger the IPA build** — run:
   ```
   gh workflow run build-ios.yml --repo Jabberwocky7777/Pokedex-Tracker
   ```
   Then watch with:
   ```
   gh run watch <run-id> --repo Jabberwocky7777/Pokedex-Tracker
   ```

3. **Download the artifact** — after the run completes:
   ```
   gh run download <run-id> --repo Jabberwocky7777/Pokedex-Tracker --name PokedexTracker-IPA --dir ./ipa-download
   ```

4. **Create a GitHub release and upload the IPA**:
   ```
   gh release create vX.Y --repo Jabberwocky7777/Pokedex-Tracker --title "vX.Y" --notes "..." ipa-download/PokedexTracker.ipa#PokedexTracker.ipa
   ```

5. **Update `apps.json`** — all four fields must change together:

   | Field | What to set |
   |-------|-------------|
   | `version` | Must match `MARKETING_VERSION` exactly (e.g. `"1.1"`) |
   | `versionDate` | Release date as `YYYY-MM-DD` |
   | `downloadURL` | `https://github.com/Jabberwocky7777/Pokedex-Tracker/releases/download/vX.Y/PokedexTracker.ipa` |
   | `size` | IPA bytes — `(Get-Item ipa-download/PokedexTracker.ipa).Length` in PowerShell |

6. **Commit and push** — include both `project.pbxproj` and `apps.json` in the same commit. GitHub Pages rebuilds automatically (~1 min).

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
│   └── save/                # Gen IV save-file reader, living-dex model, import planning (see "Save import")
├── data/                    # Static JSON (genMeta, npc-trades, save-tables — committed)
├── styles/                  # Tailwind CSS entry (index.css)
└── components/
    ├── ThemeSelector.tsx    # Theme dropdown — wired to useSettingsStore
    ├── layout/              # Header, FilterSubbar, SyncDot, SyncToast, UndoToast, MobileBottomNav, Layout
    ├── auth/                # LoginScreen, NativeOnboardingScreen (both always offer "Use offline")
    ├── tracker/             # DailyChecklist, WhatNextView, GestureHint, ProgressBreakdown, AvailabilityHelp
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
    ├── saves/               # SavesView, BoxBrowser, MonCard, ImportReview, InYourSaves — imported game saves
    └── shared/              # TypeBadge, StatBar, NatureSelector (reused across tabs)

sync-server/
├── server.js               # Express API: /api/login, /api/pull, /api/push, /health
└── package.json

scripts/
├── fetch-data.ts           # Builds public/data/pokemon.json + src/data/*.json
│                           # Run via: npm run generate-data (runs validate-data afterwards)
├── pokeapi-csv.ts          # Loads encounter CSVs from PokeAPI/pokeapi at the pinned commit
├── validate-data.ts        # Sanity checks on the generated data (npm run validate-data)
├── fetch-save-tables.ts    # Builds src/data/save-tables.json (npm run generate-save-tables)
├── constants.ts            # Versions, dexes, and POKEAPI_COMMIT (the encounter data pin)
└── data/override-provenance.json  # Which rows came from overrides.json (generated, committed)

overrides.json              # Hand-maintained static/roaming/gift corrections merged by fetch-data

public/
├── data/pokemon.json       # Pre-generated Pokémon data (committed, ~9 MB)
└── env.js                  # Runtime sync config (gitignored — created per-device)
```

## Zustand Stores

| Store | File | Persisted | Contents |
|-------|------|-----------|----------|
| `useDexStore` | `store/useDexStore.ts` | ✅ localStorage | `caughtByGen`, `pendingByGen`, `shinyByGen`, `placedByGen` (in its own living-dex slot), and `updatedAt[field][gen][id]` — a per-entry timestamp written on every mark and un-mark (used by the sync merge) |
| `useDesignerStore` | `store/useDesignerStore.ts` | ✅ localStorage | `slots[]` — up to 6 team slots with IVs, EVs, nature, moves |
| `useSettingsStore` | `store/useSettingsStore.ts` | ✅ localStorage | `activeTab`, `activeGeneration`, `selectedPokemonId`, filter prefs, `quickMark`, `gestureHintDismissed`, `nextIncludeSetup`, `shinyLivingDex`, `saveNoticesSeen` — per-device, never synced |
| `useUndoStore` | `store/useUndoStore.ts` | ❌ in-memory | The current undo toast (message + undo callback) |
| `useSyncStatus` | `hooks/useSyncStatus.ts` | ❌ in-memory | `syncing`, `lastSynced`, `error`, `forcePush` — sync UI state |
| `useBoxSlotStore` | `store/useBoxSlotStore.ts` | ✅ localStorage | `slotsByGen` — PC box assignments per generation/game/box |
| `useIvStore` | `store/useIvStore.ts` | ✅ localStorage | `savedSessions` — named IV checker session saves |
| `useSaveStore` | `store/useSaveStore.ts` | ✅ localStorage (key `save-profiles-v1`) + IndexedDB | localStorage: `profiles[]` (save-profile metadata, synced) and `activeProfileId` (per device). IndexedDB, loaded by `hydrate()`: `summaries` (synced), `fullSaves` and `reverts` (this device only) |

## Application Tabs

| Tab ID | Component | Description |
|--------|-----------|-------------|
| `tracker` | `Layout` | Grid/list/PC-box view for all 493 Gen I–IV Pokémon. Caught/pending/shiny marks, progress bar with breakdown, game + availability filtering, the "What can I get next" view (`viewMode: "next"`), and imported game saves (`viewMode: "saves"`). |
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
  └─ useSyncEngine (hook)             → does nothing in local (offline) mode
       ├─ syncOnce() on mount, every 30s (paused while hidden), and when the tab becomes visible
       └─ state change (debounced 2s) → syncOnce()

syncOnce()  =  pullData() → mergePayload(local, remote) → applySnapshot() if local changed
                                                        → pushData() if the server lacks the result
```

## Sync Architecture

- **Auth:** User logs in at `/api/login` → receives `SYNC_TOKEN` → stored in `localStorage` as `pokedex_sync_token`
- **Local (offline) mode:** `localStorage` key `pokedex_local_mode` = `"1"` (mirrored to Capacitor Preferences like the token). `App.tsx` treats "has token OR local mode" as signed in (`isSignedIn()`); the sync engine is off in local mode. Signing in later from Settings runs a normal `syncOnce()`, which merges local data with the server's.
- **Always pull → merge → push.** Nothing pushes local state blindly. `syncOnce()` in `lib/sync.ts` is the only place that talks to both endpoints.
- **Merging** (`lib/sync-merge.ts`, pure functions): caught/pending/shiny/placed marks merge per entry by `updatedAt` timestamp — newer wins, un-marks included, missing timestamp = 0, ties keep the mark. Designer slots, IV sessions, box slots and save summaries (`saveSummaries`) are last-write-wins per section via `sectionUpdatedAt` (stamped by store subscriptions in `sync.ts`; applying remote data does not stamp).
- **Server stays dumb:** `sync-server/server.js` stores and returns one JSON blob. Don't add merge logic there.
- **Adding a synced field:** add it to the store's `partialize`, to `buildPayload()` and `applySnapshot()` in `sync.ts`, and to the mapping in `lib/__tests__/sync.test.ts` — that test fails if a persisted field is missing from the payload. Backups use the same `buildPayload()`.
- **`saveSummaries` section:** `{ profiles, summaries }` from `useSaveStore` — profile metadata plus, per profile, the box names and `[box, slot, species, form, shiny, level, isEgg]` for every Pokémon (~15 KB per save). The `.sav` bytes and the fully parsed save never sync. `syncOnce()` awaits `useSaveStore.hydrate()` first, because the summaries load from IndexedDB asynchronously.
- **Sync indicator:** `SyncDot` in the header shows live status (idle / syncing / synced / stale / error)
- **Dev:** Vite proxies `/api/*` and `/health` → `localhost:3001`

## Data Pipeline

`npm run generate-data` = `scripts/fetch-data.ts` then `scripts/validate-data.ts`.

- **Encounters are pinned.** They are read from PokéAPI's CSVs at `POKEAPI_COMMIT` (`scripts/constants.ts`), not the live API. To pick up newer PokéAPI data, change that SHA, re-run, and review the method counts `validate-data` prints. `meta.json` records the commit under `dataSource`.
- Species, stats, sprites and evolutions still come from the live API.
- **Don't add placeholder overrides.** `overrides.json` only covers static legendaries, roamers and gifts PokéAPI lacks. Outbreaks, Poké Radar, Slot 2, honey trees, Great Marsh, Trophy Garden, fossils and NPC trades (method `"trade"`) come from PokéAPI. Gift overrides are gap-fill only.
- The encounter denylist and Altering Cave clean-up run **after** overrides are merged.
- `validate-data` must pass before committing regenerated data.

## Save import (Gen IV)

The tracker's Saves view (`viewMode: "saves"`, `components/saves/`) imports `.sav` dumps from Diamond, Pearl, Platinum, HeartGold and SoulSilver. Everything is parsed in the browser; the file is never uploaded and never written to.

- **Licensing:** the parser is written from the documented format (Bulbapedia, Project Pokémon). PKHeX is GPL-3 — use it only as a behaviour reference, never copy its code.
- **Never commit real saves.** `*.sav` / `*.dsv` are gitignored. `lib/save/__tests__/real-save.test.ts` runs only when `lib/save/__tests__/fixtures/platinum.sav` exists; every other test builds synthetic saves with `__tests__/build.ts`.
- **Format** (`lib/save/gen4.ts`, `pk4.ts`): only the Platinum layout is verified against a real cartridge; DP and HGSS come from documentation (`UNVERIFIED_FAMILIES`, which triggers a one-time "spot-check" notice). Two traps worth knowing: Platinum's party is at 0xA0 (not Bulbapedia's 0x98), and the current boxes are the storage block whose **link value** matches the newest general block — often in the *other* save slot.
- **Lookup tables:** `src/data/save-tables.json` (moves, abilities, Gen IV item and met-location indices, growth curves) is generated by `npm run generate-save-tables` from the PokéAPI CSVs at `POKEAPI_COMMIT`.
- **Profiles:** each save is a profile (`id = family-tid-sid`) with a role. One is the **living dex** (National Dex order, 30 per box, from `startBox`); the rest are **playthroughs**, which count as owned but never as placed.
- **Storage:** raw bytes, the parsed save, the summary and the pre-import snapshot live in IndexedDB (`lib/save/storage.ts`); localStorage has only profile metadata. Raw bytes are kept so "Re-read all saves" can re-parse after a parser fix.
- **Marks from saves** (`lib/save/reconcile.ts`, `planImport`): planned against *all* imported profiles, then shown in `ImportReview` — nothing is applied unticked. Removals of caught/shiny default to unticked; an older dump (lower save counter) or more than 10 removals unticks every removal. Applying goes through `applyImportWithUndo()` and stores a snapshot for "Revert last import".
- **Pending is allocated, not inferred** (`lib/save/living-dex.ts`, `allocatePending`): each physical copy counts once — a placeholder for its slot's species, any other spare for one uncaught later stage (nearest stage, then lowest dex number). Babies are never pending; a missing baby with an owned later stage is "needs breeding" advice.
- **Tracking is species-level.** Forms are shown on the Pokémon card (`lib/save/forms.ts`) but not tracked.

## Tracker Interaction

- **Quick mark** (`useSettingsStore.quickMark`, ⚡ in the filter bar): on = a single tap/click toggles caught; off = tap selects, double-click toggles caught. Defaults to on for `(pointer: coarse)`.
- **Long-press** (~500 ms, touch) toggles pending on cells and list rows via `hooks/useLongPress.ts`; right-click does the same with a mouse.
- **Undo:** every caught/pending/shiny/placed toggle goes through `toggleWithUndo()` in `lib/dex-actions.ts`, which shows the `UndoToast` for 5 s. Undo uses the normal store setters so sync sees it. Don't call the store's toggle functions directly from UI code.
- **Search syntax** lives in `lib/pokemon-search.ts` (name, `94` / `#094`, type names, `caught:` / `shiny:` / `pending:` + `yes`/`no`).
- **Availability logic** is `computeAvailability()` / `filterPokemon()` in `hooks/usePokemonFilter.ts`; keep `components/tracker/AvailabilityHelp.tsx` in step with it.

## Key Utility Modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `sync.ts` | Token + local-mode flags, `pullData`, `pushData`, `buildPayload`, `applySnapshot`, `syncOnce` |
| `sync-merge.ts` | `mergeTracker`, `mergePayload`, `payloadsEqual` — pure merge logic |
| `backup.ts` | `BackupData` type (version 2); `downloadBackup` (uses `buildPayload`), `restoreBackup` (accepts v1 and v2) |
| `dex-actions.ts` | `toggleWithUndo`, `clearGenerationWithUndo`, `applyImportWithUndo` |
| `pokemon-search.ts` | Tracker search parser and matcher |
| `what-next.ts` | `buildNextLocations` for the "What can I get next" view |
| `evolution-status.ts` | Uncaught-evolution helpers shared by the needs-attention filter and detail panel |
| `npc-trades.ts` | Helpers for in-game trade rows (obtainable but not catchable) |
| `iv-calc.ts` | `findIVs`, `ivRange`, `intersectIVSets`, `calculateHiddenPower` |
| `move-fetch.ts` | PokéAPI learnset + move detail fetching with module-level caches |
| `type-colors.ts` | `TYPE_COLORS` (hex) and `TYPE_BG_COLORS` (Tailwind classes) for all 18 types |
| `pokemon-filter.ts` | BFS evolution walk, obtainability filter, generation/game filtering |
| `save/gen4.ts`, `save/pk4.ts` | Save-file and Pokémon-record readers (`parseGen4Save`, `decodePk4`) |
| `save/living-dex.ts` | `homeSlot`, `detectStartBox`, `analyzeSave`, `allocatePending`, `breedingHints` |
| `save/reconcile.ts` | `planImport` — proposed mark changes plus the stale-dump and mass-removal rules |
| `save/summary.ts`, `save/storage.ts` | Slim synced summary; IndexedDB key/value wrapper |

## Development Setup

```bash
npm install
npm run dev          # Vite dev server → http://localhost:5173
```

To run sync locally:
```bash
# Once
cd sync-server && npm install

# Terminal 1 — any test values; APP_USER/APP_PASSWORD enable the login form
SYNC_TOKEN=dev-token APP_USER=dev APP_PASSWORD=dev-password DATA_DIR=./data node sync-server/server.js

# Terminal 2
npm run dev
```

Then sign in with those credentials. (`public/env.js` is no longer read by the app.) Use two browser profiles to test two devices syncing.

## Available Scripts

| Script | Action |
|--------|--------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build → `dist/` |
| `npm run preview` | Serve the `dist/` build locally |
| `npm run lint` | ESLint |
| `npm test` | Vitest (`src/**/*.test.ts`, Node environment, setup in `src/test/setup.ts`) |
| `npm run generate-data` | Regenerate `public/data/pokemon.json` + `src/data/meta.json`, then validate (~2 min) |
| `npm run validate-data` | Check the generated data; non-zero exit on failure |
| `npm run generate-save-tables` | Regenerate `src/data/save-tables.json` for the save importer |

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npx tsc -b` and `npm test` on every push and pull request. Run the same three before pushing.

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
