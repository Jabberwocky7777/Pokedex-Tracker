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

1. **Bump version in Xcode project** — edit both occurrences of `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` to the new version (e.g. `1.1`). Also set `"version"` in `package.json` to the same version as semver (`1.1` → `1.1.0`) and run `npm install` so `package-lock.json` follows.

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

6. **Commit and push** — include both `project.pbxproj` and `apps.json` in the same commit. `.github/workflows/pages.yml` republishes the source on GitHub Pages (~1 min) — only `apps.json`, `pokeball.png` and a pointer page — and fails if `apps.json`'s version differs from `MARKETING_VERSION`.

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| UI framework | React | 19.x |
| Language | TypeScript | 6.x |
| State management | Zustand | 5.x (with `persist` middleware) |
| Styling | Tailwind CSS | 4.x (via `@tailwindcss/vite`) |
| Build tool | Vite | 8.x |
| Offline | vite-plugin-pwa (Workbox) | 2.x |
| Lint | ESLint + typescript-eslint + eslint-plugin-react-hooks | 10.x |
| Sync server | Express (Node.js) | 5.x (path patterns use the v5 syntax: `/{*splat}`, not `*`) |

## Directory Structure

```
src/
├── App.tsx                  # Root: loads pokemon.json, mounts sync engine, the one shared Header, keep-alive tab slots (tabs other than the tracker are lazy chunks)
├── main.tsx                 # Vite entry point; registers the service worker (browser only); starts URL routing
├── types/                   # Shared TypeScript types; APP_TABS and VIEW_MODES are the single lists of tabs and tracker views
├── themes/                  # Theme registry (AppTheme interface, dark + burnished themes)
├── store/                   # Zustand stores (see below)
├── hooks/                   # Custom React hooks (usePokemonFilter, useRouteIndex, useSyncEngine, useAttackdex, …)
├── lib/                     # Pure utility modules (no React); includes applyTheme.ts
│   └── save/                # Gen III/IV save-file readers, living-dex model, import planning (see "Save import")
├── data/                    # Bundled data: meta.json, boxes.json, save-tables.json, battle-tower-*.json (generated, committed); daily-events.ts, weekly-events.ts, great-marsh.ts, evolution-items.ts (hand-written; the item locations follow Bulbapedia's acquisition tables)
├── styles/                  # Tailwind CSS entry (index.css)
└── components/
    ├── ThemeSelector.tsx    # Theme dropdown — wired to useSettingsStore
    ├── layout/              # Layout (the tracker tab), Header (shared, rendered once by App), tabs.ts (tab labels/icons,
    │                        #   the four phone tabs), FilterSubbar, SyncDot, SyncToast, UndoToast, MobileBottomNav (4 tabs + More sheet)
    ├── auth/                # LoginScreen, NativeOnboardingScreen (both always offer "Use offline")
    ├── tracker/             # DailyChecklist (with RoamerPanel as its last tab), WhatNextView, ShoppingListView, ProgressView (with ShareCard), ShinyHuntView, ChangeLogView, GestureHint, ProgressBreakdown, AvailabilityHelp
    ├── controls/            # GameSelector, GenerationSelector, SearchBar, ViewToggle
    ├── box-view/            # BoxView, PokemonCell — grid view for the tracker tab
    ├── list-view/           # ListView, PokemonRow — list view for the tracker tab
    ├── pc-box/              # PcBoxLayout, PcBoxGrid, BoxGameSelector — the tracker's "slots" view
    ├── detail-panel/        # DetailPanel, LocationTable, EvolutionBadge, GreatMarshBanner
    ├── pokedex/             # PokedexTab, StatBars, StatComparison, EvolutionChain, MovesSection, MoveTable;
    │                        #   also the Attackdex pieces: AttackdexPanel, MoveSearchBar, LearnerGrid, HmPlannerPanel
    ├── attackdex/           # AttackdexTab (single move / move combo / HM planner), MoveComboPanel
    ├── route-info/          # RouteInfo — encounter tables browsed by location (a searchable list; there is no map)
    ├── catch-calculator/    # CatchCalculator
    ├── designer/            # DesignerTab, DesignerPanel, DesignerPcBox, IvSection, StatBlock, EvTracker, MoveGrid, MovePicker, EggMoveFinder
    ├── trainer-lookup/      # TrainerLookupTab — Battle Tower trainers and their sets
    ├── damage-calc/         # DamageCalcTab, CalcPokemonPanel, CalcFieldPanel
    ├── settings/            # SettingsTab — generation, sync, backup, theme, clear data, Export / Copy notes; ServerSnapshots (restore an older server copy)
    ├── notes/               # NotesTab (Working on / All notes / Journal), WorkingOnPanel, LinkPicker, AllNotesPanel, JournalPanel, NotesPrint, WorkingOnButton (detail panel)
    ├── print/               # Print.tsx — PrintSheet, PrintButton (panel + window.print()), PrintBox, PrintSprite
    ├── saves/               # SavesView, BoxBrowser, MonCard, ImportReview, InYourSaves, and the To do / Plan / Trade / Search / History panels
    └── shared/              # TypeBadge, PokemonPicker, ShortcutModal, ErrorBoundary, BreedingCard and NoteField (tracker panel and Pokédex); links.tsx (PokemonLink, RouteLink, MoveLink, LocationLink, LinkMention)

sync-server/
├── server.js               # Express API: /api/login, /api/pull, /api/push, /api/snapshots, /health (createApp() + a main block)
├── server.test.js          # node --test; `npm test` at the root runs it after Vitest
├── package.json
└── package-lock.json       # The image installs with `npm ci`

scripts/
├── fetch-data.ts           # Builds public/data/pokemon.json + src/data/meta.json, boxes.json
│                           # Run via: npm run generate-data (runs validate-data afterwards)
├── pokeapi-csv.ts          # Loads CSVs from PokeAPI/pokeapi at the pinned commit (`loadCsv`), and shapes the encounter ones
├── moves-data.ts           # Builds public/data/moves.json + learnsets.json (npm run generate-moves)
├── validate-data.ts        # Sanity checks on the generated data (npm run validate-data)
├── fetch-save-tables.ts    # Builds src/data/save-tables.json (npm run generate-save-tables)
├── fetch-battle-tower.ts   # Builds src/data/battle-tower-sets.json from the Platinum decompilation (npm run fetch-battle-tower)
├── generate-icon.mjs       # App icon (npm run generate:icon)
├── generate-social-preview.mjs  # docs/social-preview.png, the GitHub social preview (npm run generate:social)
├── capture-screenshots.ts  # README screenshots into docs/screenshots/ from made-up demo data (npm run screenshots)
├── e2e-links.ts            # Browser click-through of the links, CSP, offline and sync (npm run e2e)
├── constants.ts            # Versions, dexes, and POKEAPI_COMMIT (the encounter data pin)
├── tsconfig.json           # Used by every `tsx` script in package.json (strict; also covers src/lib and src/types)
└── data/
    ├── overrides.json            # Hand-maintained static/roaming/gift corrections merged by fetch-data
    └── override-provenance.json  # Which rows came from overrides.json (generated, committed)

public/
└── data/                   # Generated, committed, compact JSON
    ├── pokemon.json        # Species, stats, encounters (~4.3 MB); loaded at boot
    ├── moves.json          # Every Gen I–IV move per game (~0.4 MB); loaded on first use
    └── learnsets.json      # Learnsets per species and version group (~1.1 MB); loaded on first use

deploy/
├── Dockerfile              # Built with the repo root as context: docker build -f deploy/Dockerfile .
├── docker-compose.yml      # Run from the root: docker compose -f deploy/docker-compose.yml up -d (reads ../.env)
├── docker-entrypoint.sh
├── smoke-test.sh           # CI runs it against the built image before publishing (needs docker, curl, jq)
└── nginx/
    ├── default.conf        # → /etc/nginx/http.d/default.conf
    ├── security-headers.conf
    └── real-ip.conf
                            # One image: nginx serves dist/ and proxies /api to the sync server,
                            # which the entrypoint runs in a restart loop

docs/                       # features, self-hosting, sync, development, data-pipeline, ios (.md; the README links
                            # here), AUDIT.md (the 2026-10 audit), REVIEW.md (the 2026-10-25 review), screenshots/ (npm run screenshots), social-preview.png
.github/                    # workflows, dependabot.yml, CONTRIBUTING.md, SECURITY.md, issue and PR templates

apps.json, pokeball.png     # AltStore source + its icon. Must stay at the root: GitHub Pages serves the
                            # root of main, and installed sources use these exact URLs
```

## Zustand Stores

| Store | File | Persisted | Contents |
|-------|------|-----------|----------|
| `useDexStore` | `store/useDexStore.ts` | ✅ localStorage | `caughtByGen`, `pendingByGen`, `shinyByGen`, `placedByGen` (in its own living-dex slot), and `updatedAt[field][gen][id]` — a per-entry timestamp written on every mark and un-mark (used by the sync merge) |
| `useDesignerStore` | `store/useDesignerStore.ts` | ✅ localStorage | `slots[]` — up to 6 team slots with IVs, EVs, nature, moves |
| `useSettingsStore` | `store/useSettingsStore.ts` | ✅ localStorage | `activeTab` (mirrored in the address bar), `activeGeneration`, filter prefs, `quickMark`, `gestureHintDismissed`, `nextIncludeSetup`, `nextNowOnly`, `shinyLivingDex`, `saveNoticesSeen` — per-device, never synced. In memory only: `selectedPokemonId`, `searchQuery` and the deep-link fields (`activeRoute`, `routeSearch`, `activeAttackdexSlug`) |
| `useTrackerCountStore` | `store/useTrackerCountStore.ts` | ❌ in-memory | The tracker's caught / pending / total for its current filters, published by `Layout` for the shared header's phone counter |
| `useTripStore` | `store/useTripStore.ts` | ✅ localStorage | `entries` — the last 5 printed What's next sheets (route slugs in printed order, games, grouped, setup, printedAt), saved by the print's Print button. An entry store; synced as the `trips` section so a phone can check a sheet off (`TripCheckOff`) |
| `useSoleSourceStore` | `store/useSoleSourceStore.ts` | ❌ in-memory | Pokémon only one selected game can supply (`lib/planner.ts`), published by `Layout` |
| `useUndoStore` | `store/useUndoStore.ts` | ❌ in-memory | The current undo toast (message + undo callback) |
| `useChangeLogStore` | `store/useChangeLogStore.ts` | ✅ localStorage (key `pokedex-changelog-v1`) | `entries[]` — the change log, newest first, at most 100. Per-device: never synced or backed up |
| `useSyncStatus` | `hooks/useSyncStatus.ts` | ❌ in-memory | `syncing`, `lastSynced`, `error`, `forcePush` — sync UI state |
| `useBoxSlotStore` | `store/useBoxSlotStore.ts` | ✅ localStorage | `slotsByGen` — PC box assignments per generation/game/box |
| `useIvStore` | `store/useIvStore.ts` | ✅ localStorage | `savedSessions` — named IV checker session saves. Nothing in the UI writes these any more; the store is kept so existing data still syncs and backs up |
| `useBattleCalcStore` | `store/useBattleCalcStore.ts` | ✅ localStorage | Damage calculator: both Pokémon, weather, screens, hazards, format — per-device, never synced |
| `useRoamerStore` | `store/useRoamerStore.ts` | ✅ localStorage | `entries` — roaming legendaries met, keyed `<game>:<dex number>`. An entry store (`store/createEntryStore.ts`): synced as the `roamers` section and merged entry by entry |
| `useNotesStore` | `store/useNotesStore.ts` | ✅ localStorage | `entries` — per-Pokémon notes keyed `<generation>:<dex number>`. An entry store; synced as the `notes` section, merged note by note |
| `useWorkingOnStore` | `store/useWorkingOnStore.ts` | ✅ localStorage | `entries` — the Notes tab's "Working on" list, keyed by a generated id: text, status, optional link (Pokémon / route / game), optional `note` (multi-line, up to 2000 characters), createdAt, fractional `order`. An entry store; synced as the `workingOn` section. Per account, not per generation |
| `useJournalStore` | `store/useJournalStore.ts` | ✅ localStorage | `entries` — the run journal: date (YYYY-MM-DD), game, text, createdAt. An entry store; synced as the `journal` section |
| `useHuntStore` | `store/useHuntStore.ts` | ✅ localStorage | `entries` — shiny hunts (generation, species, method, count, started / found times) keyed by a generated id. An entry store; synced as the `shinyHunts` section |
| `useGameProgressStore` | `store/useGameProgressStore.ts` | ✅ localStorage | `entries` — Game Progress per game (`badges` ids, `milestones` with done / at / source). An entry store; synced as the `gameProgress` section, merged game by game. Changed only through `lib/progress-actions.ts` |
| `useSaveStore` | `store/useSaveStore.ts` | ✅ localStorage (key `save-profiles-v1`) + IndexedDB | localStorage: `profiles[]` (save-profile metadata, synced), `removedProfiles` (id → time removed, synced so a removal reaches other devices) and `activeProfileId` (per device). IndexedDB, loaded by `hydrate()`: `summaries` (synced), `fullSaves`, `reverts` and `history` (this device only). In memory: `panel`, `todoChecks`, `storageFailed` |

## Application Tabs

| Tab ID | Component | Description |
|--------|-----------|-------------|
| `tracker` | `Layout` | Grid/list/PC-box view for all 493 Gen I–IV Pokémon. Caught/pending/shiny marks, progress bar with breakdown, game + availability filtering, the "What can I get next" view (`viewMode: "next"`), the evolution item shopping list (`viewMode: "items"`), progress over time (`viewMode: "progress"`), and the change log (`viewMode: "log"`). |
| `games` | `MyGamesTab` | My games, in two sections (`#/games/progress`, `#/games/saves`; `useSettingsStore.gamesSection`): Game Progress (`GameProgressView` — every game of the active generation, whatever the tracker's game filter) and the imported saves (`SavesView`). Open it with `openMyGames(section, panel?)`. On a phone it is in the bottom bar |
| `pokedex` | `PokedexTab` | Single Pokémon detail: base stats, side-by-side stat comparison, full learnset (level-up, TM/HM, egg, tutor), and "Where to Find" encounter location table. |
| `attackdex` | `AttackdexTab` | Move browser: search any of the 467 Gen I–IV moves, view power/accuracy/PP/effect for the selected game, and see which Pokémon learn it. Also the move-combo search and the HM planner. |
| `routes` | `RouteInfo` | Searchable list of locations with encounter tables by version and method. HGSS routes show morning/day/night badges. With no game selected it covers the active generation's games only; an area opened by a link from outside the selection is still shown, with a notice. |
| `catch-calc` | `CatchCalculator` | Gen III/IV catch rate formula with all Poké Balls, status conditions, HP modifiers, and retro battle HP bar UI. Dive and Repeat Ball bonuses are behind "surfing or fishing" / "already caught" checkboxes. |
| `designer` | `DesignerTab` | Team builder: IV range narrowing, stat projections, EV planning, nature selection, move picker, PC Box slot management. |
| `trainer-lookup` | `TrainerLookupTab` | Battle Tower trainers by category, with their possible sets at the trainer's IVs; any set can be sent to the damage calculator. |
| `damage-calc` | `DamageCalcTab` | Gen IV damage formula for two Pokémon, both directions: weather, screens, Stealth Rock and Spikes, abilities, items, singles/doubles. |
| `notes` | `NotesTab` | Your own planning, in four sections (`#/notes/working`, `/notes`, `/journal`, `/hunts`): the Working on list, every per-Pokémon note of the generation, the run journal, and the shiny hunt counter (`ShinyHuntView`). The first three print. On a phone it is in the More sheet |
| `settings` | `SettingsTab` | Generation, sync status and sign-in, backup export/restore, theme, clear data. |

`APP_TABS` in `types/index.ts` is the one list of tab ids; `App.tsx` and the settings migration both read it.

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
- **When syncs run** is `lib/sync-scheduler.ts` (pure, tested with fake timers): one at a time with a single queued follow-up, a push 2 s after the last change, polls skipped while a push waits or (at most twice) while typing. `useSyncEngine` only wires it to timers, visibility and the stores.
- **Unchanged polls are cheap.** A poll with nothing local to send pulls with `?since=<last synced version>`; a server still at that version answers `{ unchanged: true }` without the data. The version is forgotten on sign-in / sign-out (`setToken`, `clearToken`).
- **Timestamps use the server's clock.** Every pull returns `serverTime`; `lib/clock.ts` keeps the offset (`pokedex_clock_offset` in localStorage) and `stampNow(previous)` writes marks, entries, section stamps and save import / removal times — never earlier than the stamp being replaced, so a device's later edit always beats its own earlier one. New code that writes a merge timestamp must use `stampNow`, not `Date.now()`.
- **The server's copy is sanitised before the merge.** `sanitizeRemote()` (`lib/backup.ts`) drops malformed sections and entries (a tracker field's marks together with its timestamps) instead of rejecting the pull; a sync that dropped anything always pushes, which repairs the server. An entry that is stamped (`at` is a number) but shaped unlike anything this version knows — possibly from a newer version — is *passed through*: not applied locally, but put back into every push by `withPassThrough()`, so an older device never deletes a newer one's data. Server-snapshot restore is lenient the same way (`restoreBackupData(raw, { lenient: true })`, reporting what it left out); a backup file stays strict.
- **Merging** (`lib/sync-merge.ts`, pure functions): caught/pending/shiny/placed marks merge per entry by `updatedAt` timestamp — newer wins, un-marks included, missing timestamp = 0, ties keep the mark. Designer slots, IV sessions, box slots and save summaries (`saveSummaries`) are last-write-wins per section via `sectionUpdatedAt` (stamped by store subscriptions in `sync.ts`; applying remote data does not stamp).
- **Entry-merged sections** (`roamers`, `notes`, `shinyHunts`, `workingOn`, `journal`, `gameProgress`, `trips`): small collections where each entry has its own `at` timestamp and a removal leaves a tombstone, merged by `mergeEntries()` in `lib/entries.ts` — newer entry wins, like the marks. Each lives in a store made by `createEntryStore()`. To add one: create the store, add it to `ENTRY_SECTIONS` and `BackupData` in `backup.ts` and to `ENTRY_SECTION_NAMES` in `sync-merge.ts`, subscribe to it in `useSyncEngine`, and add it to the mapping in `sync.test.ts`. `buildPayload`, `applySnapshot`, restore and validation then pick it up from `ENTRY_SECTIONS`.
- **Server stays dumb:** `sync-server/server.js` stores and returns one JSON blob. Don't add merge logic there.
- **Server snapshots:** before a push replaces `sync.json`, the server copies the old one to `DATA_DIR/snapshots/` twice over: `<UTC hour>.json` once per hour (pruned to hourly for 24 h and daily for 30 days), and `<UTC time to the ms>.json` (`2026-10-11T14-05-07-123`) for every push, keeping the last 10 — so a bad push can be undone to just before it. `GET /api/snapshots` lists them newest first (a copy kept under both ids is listed once, as the hourly one) and `GET /api/snapshots/:id` returns one. Restoring is a client action: `ServerSnapshots` in Settings fetches one and hands it to `restoreBackupData()`, and the result syncs like any other edit.
- **Saves merge per profile.** `saveSummaries` is the exception to section-level last-write-wins: `mergeSaves()` keeps every profile either device has, takes the newer `importedAt` when both have one, and honours `removed` tombstones (`useSaveStore.removedProfiles`), so two devices importing different saves both keep theirs.
- **Normalise on the way in.** `applySnapshot()` and backup restore go through store setters that bring data to the current shape (`normalizeSlots()` pads Designer slots to 90 and fills new fields); `validateBackup()` rejects malformed `boxSlots`, `designer` and `saveSummaries`, and `sanitizeRemote()` (above) applies the same checks to every pull.
- **Adding a synced field:** add it to the store's `partialize`, to `buildPayload()` and `applySnapshot()` in `sync.ts`, and to the mapping in `lib/__tests__/sync.test.ts` — that test fails if a persisted field is missing from the payload. Backups use the same `buildPayload()`.
- **Never change the type or meaning of an existing synced field** (a note's `text`, a hunt's `count`, a section's shape). Older app versions — an iPhone not yet updated — keep syncing: add a new field or a new section instead, and let old clients ignore it. Entries they can't read are passed through (above), but whole sections of the wrong shape are dropped and overwritten.
- **`saveSummaries` section:** `{ profiles, summaries, removed }` from `useSaveStore` — profile metadata plus, per profile, the box names and `[box, slot, species, form, shiny, level, isEgg, own]` for every Pokémon (~15 KB per save). The `.sav` bytes and the fully parsed save never sync. `syncOnce()` awaits `useSaveStore.hydrate()` first, because the summaries load from IndexedDB asynchronously.
- **Sync indicator:** `SyncDot` in the header shows live status (idle / syncing / synced / stale / error). "Synced" is when this device last synced successfully (not the server's `savedAt`, which is when anyone last pushed); stale is more than an hour without a successful sync.
- **Timeouts:** use `timeoutSignal(ms)` from `lib/sync.ts`, never `AbortSignal.timeout` — the iOS deployment target (15.0) lacks it.
- **Dev:** Vite proxies `/api/*` and `/health` → `127.0.0.1:3001`. The server listens on `127.0.0.1` unless `HOST` is set (in the image, only nginx reaches it)

## Data Pipeline

`npm run generate-data` = `scripts/fetch-data.ts` then `scripts/validate-data.ts`.

- **Encounters are pinned.** They are read from PokéAPI's CSVs at `POKEAPI_COMMIT` (`scripts/constants.ts`), not the live API. To pick up newer PokéAPI data, change that SHA, re-run, and review the method counts `validate-data` prints. `meta.json` records the commit under `dataSource`.
- Species, stats, sprites and evolutions still come from the live API. A failed fetch fails the run — nothing is skipped.
- **Everything is as of Generation IV.** `fetch-data.ts` applies PokéAPI's `past_types`, `past_stats` and `past_abilities` (`TARGET_GENERATION`), drops hidden abilities and abilities introduced later, and drops evolutions into species above #493. `validate-data` checks this (no Fairy, known Gen IV stats, Gengar has Levitate, …).
- **Moves and learnsets are generated too.** `scripts/moves-data.ts` (run by `generate-data`, or alone with `npm run generate-moves`) writes `public/data/moves.json` and `public/data/learnsets.json` from the CSVs at `POKEAPI_COMMIT`: each move's HeartGold/SoulSilver values plus the fields in which an older supported game differs (PokéAPI's changelog applied by `moveValuesIn` in `lib/move-values.ts`), effect text, in-game descriptions, and each species' learnset per version group. Where a default form has no rows for a game its other forms' rows are used (Deoxys in Emerald and FR/LG).
- **No PokéAPI at runtime.** `lib/move-data.ts` loads the two files on first use; `lib/move-fetch.ts`, `attackdex-fetch.ts` and `move-list-fetch.ts` read from them, and the Content-Security-Policy does not allow `pokeapi.co`. `moveForVersionGroup(detail, versionGroup)` gives power/accuracy/PP/type as they were in that game — use it rather than a move's top-level numbers, which are HG/SS.
- **Move names** come from `moveDisplayName(slug)` in `lib/move-names.ts` (the names in `save-tables.json`), never from the slug: "u-turn" is "U-turn".
- **Egg groups and gender ratios** (`eggGroups`, `genderRate` on each Pokémon) come from the species endpoint in `fetch-data.ts`. PokéAPI keeps no history for egg groups, so the one Gen IV difference is an override there (the Ralts line was Amorphous only until Gen VIII). `validate-data` checks the groups, that babies can't breed, and that `genderRate` agrees with `save-tables.json`.
- **Don't add placeholder overrides.** `scripts/data/overrides.json` only covers static legendaries, roamers and gifts PokéAPI lacks. Outbreaks, Poké Radar, Slot 2, honey trees, Great Marsh, Trophy Garden, fossils and NPC trades (method `"trade"`) come from PokéAPI. Gift overrides are gap-fill only.
- The encounter denylist and Altering Cave clean-up run **after** overrides are merged.
- `validate-data` must pass before committing regenerated data.

## Save import (Gen III and IV)

The Saves section of the My games tab (`components/saves/`) imports `.sav` dumps from Diamond, Pearl, Platinum, HeartGold and SoulSilver (512 KB) and from Ruby, Sapphire, Emerald, FireRed and LeafGreen (128 KB). `parseSave()` in `lib/save/parse.ts` picks the reader by file size. Everything is parsed in the browser; the file is never uploaded and never written to.

- **Licensing:** the parser is written from the documented format (Bulbapedia, Project Pokémon). PKHeX is GPL-3 — use it only as a behaviour reference, never copy its code.
- **Never commit real saves.** `*.sav` / `*.dsv` are gitignored. `lib/save/__tests__/real-save.test.ts` runs only when `lib/save/__tests__/fixtures/platinum.sav` (and optionally `emerald.sav`, `pearl.sav`, `soulsilver.sav`) exist; every other test builds synthetic saves with `__tests__/build.ts`.
- **Format** (`lib/save/gen4.ts`, `pk4.ts`): the Platinum layout is verified against a real cartridge (`real-save.test.ts`, 127 placed / 136 owned) and HGSS against a real SoulSilver save; for DP only the header was checked on a real, empty Pearl save (`UNVERIFIED_FAMILIES` — `dp`, `rse`, `frlg` — triggers a one-time "spot-check" notice). Three traps worth knowing: Platinum's party is at 0xA0 (not Bulbapedia's 0x98); the current boxes are the storage block whose **link value** matches the newest general block — often in the *other* save slot; and the block footer is 0x14 bytes in DP/Pt but 0x10 in HGSS, which has no link field (its save counter is used instead).
- **Gen III** (`lib/save/gen3.ts`, `pk3.ts`): **partly verified** — block/section selection, trainer, party and box names were checked against one real Emerald save (empty PC). Boxed Pokémon and all of FireRed/LeafGreen are tested only with synthetic saves from `__tests__/build3.ts`. Families `rse` and `frlg`; marks go to tracker generation 3. `GEN_CONFIG` / `genConfigOf(family)` in `lib/save/types.ts` carries what differs (generation, 386 vs 493 species, 14 vs 18 boxes, games), and profiles of different generations are never planned together. Gen III has no nickname flag, no gender field and only an ability-slot bit, so those are derived (species name comparison, PID + gender ratio, `abilities3` table). `SaveMon.gen` says which generation's item and met-location tables apply — use `heldItemName(mon)` / `metLocationName(mon)`.
- **Lookup tables:** `src/data/save-tables.json` (moves, abilities, species names, growth curves, gender ratios; Gen III and Gen IV item and met-location indices; the Gen III internal species index and ability slots) is generated by `npm run generate-save-tables` from the PokéAPI CSVs at `POKEAPI_COMMIT`. The Gen III ability slots are the exception: they come from `public/data/pokemon.json` (abilities that existed in Gen III), because today's PokéAPI ability list is wrong for Gen III (Shiftry, Pelipper, Torkoal, Feebas). Run `generate-data` first if pokemon.json is stale.
- **Profiles:** each save is a profile (`id = family-tid-sid`) with a role. One is the **living dex** (National Dex order, 30 per box, from `startBox`); the rest are **playthroughs**, which count as owned but never as placed.
- **Storage:** raw bytes, the parsed save, the summary and the pre-import snapshot live in IndexedDB (`lib/save/storage.ts`); localStorage has only profile metadata. Raw bytes are kept so "Re-read all saves" can re-parse after a parser fix. If a write fails (quota, private mode) `storageFailed` is set and the Saves view says so. Files over 2 MB are refused before they are read.
- **Marks from saves** (`lib/save/reconcile.ts`, `planImport`): planned against *all* imported profiles, then shown in `ImportReview` — nothing is applied unticked. Removals of caught/shiny default to unticked; an older dump (lower save counter) or more than 10 removals unticks every removal. Applying goes through `applyImportWithUndo()` and stores a revert point with the changes the import made (`RevertPoint.changes`). "Revert last import" takes back only those, and only marks that still have the import's value (`revertChangesLogged()`) — never the whole pre-import snapshot, which would also undo everything marked since, on every device. Revert points from before `changes` existed fall back to the import's change-log entry, or refuse.
- **Pending is allocated, not inferred** (`lib/save/living-dex.ts`, `allocatePending`): each physical copy counts once — a copy whose own slot is still empty is kept for that slot, a placeholder counts for its slot's species, and any other spare for one uncaught later stage (nearest stage, then lowest dex number). Babies are never pending; a missing baby with an owned later stage is "needs breeding" advice.
- **To-do list** (`lib/save/todo.ts`, `buildTodo`; `TodoPanel`): ordered steps for the living-dex save — swap, move, evolve, bring over from another save, catch (best location via `lib/save/acquire.ts`, which reuses `buildNextLocations`), breed, spares. Ticks live in `useSaveStore.todoChecks` (memory only) and reset on the next import.
- **Ready to evolve** (`lib/save/evolve.ts`, `checkEvolution`): level, friendship (≥ 220), held item and known moves are compared with `evolvesTo` in pokemon.json; anything the save can't answer (place, time of day, Beauty) is shown as the game words it. Feeds the READY tags in the box grid, the Pokémon card and the to-do list.
- **Best copy** (`lib/save/best-copy.ts`): copies of a species across saves are ranked by shiny (only with "Shiny living dex" on), own catch, native to the living-dex game, IV total, level. A placed Pokémon's card says when a better copy exists, and the to-do list has a "Swap in best copies" section.
- **Origins** (`lib/save/origin.ts`): Your catch / Traded / Native / Pal Park / Event badges on the card, and T / P / E markers in the grid. The summary carries an `own` flag per Pokémon so the per-profile option "Only count my own catches as placed" (`SaveProfile.ownOnly`) works on every device.
- **Transfer planner** (`buildTransferPlan` in `lib/save/acquire.ts`; `PlanPanel`): everything the living-dex save lacks, as a shopping list per game — already in another save to send over, best caught there (version exclusives flagged), plus evolutions (trade evolutions flagged), breeding and the unobtainable.
- **Pal Park** (`lib/save/pal-park.ts`, `palParkPlan`; `PalParkPanel`): Gen III species the Gen IV living dex lacks, by the save to bring them from; `palParkOpen` gates D/P/Pt on the National Pokédex in Game Progress.
- **Trade session** (`lib/trade-session.ts`, `buildTradeSession`; `TradeSession`): two sides — imported saves or plain games — and one checklist of what to send each way: version exclusives (what the receiver's games can't give at all, by `computeAvailability`), spares (two saves only), and trade evolutions ("send over and back"). A game-only side lists what the game could send; a save lists what it holds. Shown as the Trade panel, and under the import prompt when no save is imported. Ticks are component state. `tradesBetweenGames` runs it for every pair of selected games (Game progress view).
- **Box search** (`lib/save/mon-search.ts`; `SearchPanel`): searches every Pokémon in every imported save — name, dex number, `shiny`, `egg`, `nature:` `ability:` `item:` `move:` `ot:` `game:`, IV conditions (`spe:31`, `atk>=28`, `ivtotal>=150`, `perfect>=4`), `evtotal`, `level`. Summary-only saves answer name, shiny, egg and level.
- **Battle tools** (`lib/save/battle.ts`, `monToDesignerPatch`): the card shows Hidden Power from the real IVs, "Send to Designer" fills the first free Designer slot (exact IVs go in `confirmedIVs`), and "Use in damage calc" loads slot 1 through `designerSlotToCalcPokemon`.
- **Import history** (`lib/save/history.ts`, `diffSaves`; `HistoryPanel`): each import is diffed against the previous full save of that profile by PID, so evolutions show as "Kakuna → Beedrill". Newly placed, evolved, new shinies, added, removed and level-ups; the last 20 entries per profile live in IndexedDB on the importing device, and the review screen shows "Since last import".
- **Game progress from saves** (`lib/save/progress.ts`): badges, Hall of Fame, National Dex and play time, with offsets from the pret decompilations. Not verified on a real save yet, so a family's progress is only read once it is in `PROGRESS_VERIFIED`; until then `ParsedSave.progress` is undefined and `ImportReview` proposes nothing. `real-save.test.ts` prints what it would read from a fixture. Proposals only ever move progress forward (`proposeFromSave`).
- **Tracking is species-level.** Forms are shown on the Pokémon card (`lib/save/forms.ts`) but not tracked.

## Tracker Interaction

- **Quick mark** (`useSettingsStore.quickMark`, ⚡ in the filter bar): on = a single tap/click toggles caught; off = tap selects, double-click toggles caught. Defaults to on for `(pointer: coarse)`.
- **Long-press** (~500 ms, touch) toggles pending on cells and list rows via `hooks/useLongPress.ts`; right-click does the same with a mouse.
- **Undo:** every caught/pending/shiny/placed toggle goes through `toggleWithUndo()` in `lib/dex-actions.ts`, which shows the `UndoToast` for 5 s. Undo uses the normal store setters so sync sees it. Don't call the store's toggle functions directly from UI code. The Undo of a bulk change (clear, import, revert) goes through its change-log entry (`undoLogEntry`), so it only puts back marks that still have the value the change gave them — a mark synced in from another device during the toast is left alone.
- **Change log** (`viewMode: "log"`, `components/tracker/ChangeLogView.tsx`, `lib/change-log.ts`, `useChangeLogStore`): everything in `dex-actions.ts` runs through `logged()`, which snapshots the generation before and after and records the difference — so a new way of changing marks gets logged by going through `dex-actions.ts`, not by writing to the log itself. Kinds: `marks` (by hand; grouped while less than 5 minutes apart in the same generation, and a mark taken back cancels out of its group), `import`, `clear`, `revert`. `undoLogEntry(id, pokemonId?)` puts a mark back only while it still has the value the entry gave it; anything changed again since is skipped and reported. Undone entries stay in the list with Redo. Backup restore and changes arriving by sync are not logged.
- **Tool views are lazy.** `ShoppingListView` and `ProgressView` are `React.lazy` chunks in `Layout.tsx` (and `GameProgressView`, `SavesView` in `MyGamesTab`, `ShinyHuntView` in `NotesTab`), so opening the tracker doesn't load them. A new tool view of any size should be added the same way.
- **Keep `save-tables.json` off the first load.** Nothing reachable by static imports from `main.tsx` may import `lib/save/tables`, `lib/save/parse` or `lib/move-names` (`useSaveStore` imports the parser dynamically). Check `dist/index.html` has no `modulepreload` for `save-tables` after a change near them.
- **Views:** `ViewToggle` is only box / list / slots — three layouts of the same list. What's next, Daily, Items, Progress and Changes replace the list with a tool; with "Pokémon" (the list itself) they are the `VIEWS` in `FilterSubbar.tsx` — a segmented row (`ViewsSegmented`) on a wide screen, and on a phone one "View: …" button (`ViewsMenuButton`) that opens a sheet (rendered in a portal, since the bar's backdrop-blur would contain a fixed element). The desktop toolbar is two rows: filters + help, then search, layout, Quick mark, Views and the counter.
- **Search syntax** lives in `lib/pokemon-search.ts` (name, `94` / `#094`, type names, `caught:` / `shiny:` / `pending:` / `note:` / `cutecharm:` + `yes`/`no`).
- **List view sort** (`lib/list-sort.ts`): columns sort by number, name, type, games, caught date (`updatedAt.caught`) and note; the sort is `useSettingsStore.listSort` (not persisted) and lives in the address, `#/tracker?sort=caught-desc`.
- **Working on shortcuts** (`lib/working-on.ts`): `toggleWithUndo` calls `completeLinkedItems()` when a Pokémon is marked caught, so its open items become Done and the Undo toast names them; Undo puts both back. Deleting items, clearing done and deleting journal entries all show the Undo toast.
- **Printing** (`components/print/Print.tsx`, the print block at the end of `styles/index.css`): paper never shows the app. A `PrintSheet` is portalled into `<body>` while a print panel is open, and print media hides everything else. Ink rules: white page, black text, thin grey lines, no background fills, sprites 32 px greyscale and off by default, no controls, `break-inside: avoid` per route or entry, and a title + games + date header. `window.print()` does nothing in the iOS app, so the panel disables Print there.
- **Availability logic** is `computeAvailability()` / `filterPokemon()` in `hooks/usePokemonFilter.ts`; keep `components/tracker/AvailabilityHelp.tsx` in step with it.
- **"Right now"** (`availabilityMode: "now"`, and the "Only what's on right now" toggle in What's next — `useSettingsStore.nextNowOnly`): `lib/available-now.ts` decides whether an encounter row is on from a `Clock` (`{ time, weekday }`) — Gen IV time of day (morning 4–10, day 10–20, night 20–4) and the weekday events in `data/weekly-events.ts` (Drifloon and Lapras on Fridays; the Bug-Catching Contest, which is the National Park's untimed grass rows). Everything takes the clock as an argument; components get it from `hooks/useClock.ts`, which only changes when the time of day or weekday does. The weekly events also appear as "Weekly events" sections in the daily checklist.
- **Keyboard shortcuts** (`hooks/useKeyboardShortcuts.ts`) only act while the tracker tab is the active one — every tab stays mounted, so a global listener must check `activeTab`.
- **Generation limits** come from `lib/generation.ts` (`generationMaxId`, `generationVersions`, `pairedVersion`, all read from `meta.json`). Don't write 386 / 493 or a game list by hand.
- **Abilities are shown through `abilitiesInGeneration(pokemon, generation)`** (`lib/abilities.ts`, kept out of `generation.ts` so the save tables stay off the first load), not `pokemon.abilities` directly: pokemon.json has them as of Gen IV, and 89 species had one fewer in Gen III.

## Cross-tab navigation

- **The address bar follows the open tab** (`lib/url-route.ts`, started in `main.tsx`): hash routes `#/<tab>` plus the item where a tab has one — `#/pokedex/94`, `#/attackdex/u-turn`, `#/routes/<area slug>`. A store change pushes a history entry; Back / Forward and a typed address set the store through `applyRoute()`. An address on load wins over the persisted `activeTab`; with none, the persisted tab is used. Hash routing keeps nginx and the iOS bundle unchanged. A reload keeps the address, so tests that patch persisted settings load `/` with no hash.
- **Header and navigation:** one `Header` (App.tsx) for every tab — all tabs on a wide screen (icons only below `xl`, except the open one), the Gen 3 / Gen 4 toggle, the sync dot and Settings as a gear. On a phone the bottom bar has `MOBILE_PRIMARY_TABS` (`layout/tabs.ts`: Tracker, Pokédex, Routes, My games) and a More sheet for the rest. Old persisted `viewMode`s `saves` / `games` / `hunts` are moved to My games / Notes by the settings `merge`. Sign-out is only in Settings, behind a confirmation. Sheets and menus use `hooks/useDialogFocus.ts` (focus inside, Tab trapped, Esc closes).

Anything that names a Pokémon, a route/location or a move links to the tab for it.

- **`lib/navigate.ts` is the one way to open another tab on something:** `showInTracker(id, generation?)` (selects the Pokémon, which opens the tracker's detail panel over whichever view is showing), `openPokedex(id)`, `openRoute(slug)`, `openRouteSearch(text)`, `openMove(slug)`, `openMoveByName(name)`, and `openTab(tab)` for a plain switch. Each sets the target's state and then the tab; leaving the tracker clears `selectedPokemonId`. Don't pair `setActiveTab` with `setActiveX` by hand.
- **Inline links** are `PokemonLink`, `RouteLink`, `MoveLink` and `LocationLink` in `components/shared/links.tsx`: real `<button>`s with a dotted underline (so they read as links on a touch screen) that stop propagation, so they work inside clickable rows and `<label>`s. `LinkMention` turns the first mention of a name in a ready-made sentence (`describeEvolution()`, a to-do step) into a link.
- **Which tab a Pokémon link opens:** the tracker's detail panel from inside the tracker (detail panel, daily checklist, What's next, change log, Saves — pass the save's generation), the Pokédex everywhere else. `LocationTable` takes `linkTo` for this.
- **Free-text places** (TM/HM locations in `lib/tm-locations.ts`, `data/daily-events.ts`) go through `resolvePlace()` in `lib/location-links.ts`: the text before the first `(`, `/`, `,` or dash is matched against the encounter areas of the relevant games after `normalizePlace()` (case, accents, punctuation, possessive 's, "Sea Route" = "Route"). One area → `openRoute`; several (a cave's floors) → `openRouteSearch`; none → plain text. Areas named exactly win over areas that merely start with the name, and a prefix only counts on a word boundary ("Route 32" is not "Route 320").
- **Routes tab:** `RouteInfo` indexes the selected games, plus every game for fallbacks. An area outside the selection is shown for the games it exists in — the active generation's when it has the area (Kanto routes are in both FR/LG and HG/SS), otherwise one other generation's — with a notice, and its checkboxes use the generation of the games shown (`generationOfVersion()`). The search uses `normalizePlace()` on both sides and falls back to the other games when the selection has no match. `useSettingsStore.routeSearch` (not persisted) hands a search over from a link; `RouteInfo` copies it into its box once.
- **Deep-link fields are transient:** `activeRoute`, `routeSearch`, `activeAttackdexSlug` and `selectedPokemonId` are excluded from `partialize`. A move link also switches the Attackdex back to single-move mode.
- **Left unlinked on purpose:** abilities and items (no tab for them), the met location on a save's Pokémon card (a game map name, not an encounter area), and the species lists inside the `ImportReview` dialog (it would stay open over the tracker).

## Key Utility Modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `sync.ts` | Token + local-mode flags, `pullData`, `pushData`, `buildPayload`, `applySnapshot`, `syncOnce` |
| `sync-scheduler.ts` | `createSyncScheduler` — when syncs run (see Sync Architecture) |
| `clock.ts` | `stampNow`, `noteServerTime`, `clockOffset` — merge timestamps on the server's clock |
| `sync-merge.ts` | `mergeTracker`, `mergePayload`, `payloadsEqual` — pure merge logic |
| `backup.ts` | `BackupData` type (version 2); `downloadBackup` (uses `buildPayload`), `restoreBackup` (accepts v1 and v2) |
| `dex-actions.ts` | `toggleWithUndo`, `clearGenerationWithUndo`, `applyImportWithUndo`, `restoreGenLogged`; `undoLogEntry` / `redoLogEntry` for the change log |
| `change-log.ts` | `LogEntry`; `diffSnapshots`, `mergeChanges`, `isApplied`, `describeChanges` ("Pending → Caught"), `summarizeChanges` |
| `navigate.ts` | `showInTracker`, `openPokedex`, `openRoute`, `openRouteSearch`, `openMove`, `openMoveByName` — see "Cross-tab navigation" |
| `location-links.ts` | `normalizePlace`, `placeName`, `resolvePlace`, `encounterAreas` (cached per `allPokemon` array) |
| `pokemon-search.ts` | Tracker search parser and matcher |
| `what-next.ts` | `buildNextLocations` for the "What can I get next" view (optionally only what is on at a given `Clock`), `whenText` for its rows. Caught Pokémon are kept (`caught` on each target) for the print; `count` is the uncaught species and ranks, `total`, `perGame` and `bestGame` describe the location, `onlyIn` flags a Pokémon only one selected game has there, and `onlyInGame` narrows to one game. Rates: the data has one row per encounter slot, so a rate is the sum of slots, and at a time of day it is the untimed slots plus that time's slots (Gen IV swaps slots 3–4 by day and night). Rates are shown only for one regular table adding up to 100% (walk, surf, rods, Rock Smash) and for swarm / Poké Radar / Slot 2; Trophy Garden's Backlot Pokémon and the Great Marsh binoculars pool are "changes daily"; roamers, gifts, headbutt, honey trees and the radio get none. Checked against the pret decompilations (Emerald, FireRed, Platinum, HeartGold) — see `__tests__/what-next-rates.test.ts` |
| `available-now.ts` | `timeOfDay`, `clockOf`, `encounterIsOn`, `availableNow`, `eventsToday` — see "Right now" under Tracker Interaction |
| `evolution-status.ts` | Uncaught-evolution helpers shared by the needs-attention filter and detail panel |
| `evolution-items.ts` | `buildShoppingList` / `summarizeShoppingList` — items needed by uncaught evolutions of caught Pokémon ("2 Dawn Stones, 1 Metal Coat (trade)"); where to get them is `data/evolution-items.ts`, written from Bulbapedia's acquisition tables (checked 2026-10-14) |
| `game-progress.ts`, `progress-actions.ts` | Game Progress (badges and story milestones; definitions in `data/game-progress.ts`, sourced from the pret decompilations and Bulbapedia): `applyProgress`, `proposeFromSave`, `badgeCount`; `setProgressWithUndo` and `applyProgressFromSave` write through the store with the undo toast and change log (`LogEntry.progress`, kind `progress`). Not the catch-count milestones of `progress-history.ts` |
| `trip.ts` | What's next trip tools: `expectedEncounters` / `routeEffort` / `byEffort` (easiest first), `weekdaysOf`, `tripSections` (print grouped by time of day), `notOnRoutes` (the print's appendix) |
| `unlocks.ts`, `planner.ts` | Route unlocks (`data/route-unlocks.ts`: area and method → milestone per game, with sources; unmapped = open from the start, listed by `npm run unlock-gaps`): `requirementsFor`, `isReached`, `reachability`. The planner: `suppliersOf` (a species, what it evolves from, its breedable family), `ladderOf`, `sourceSteps`, `soleSources` (published by `Layout` in `useSoleSourceStore` for the "Only in Pt" tags), `planCoverage` (greedy cover), `unlockPreview`. What's next uses them through `byReach` and `uniqueLocations` |
| `progress-history.ts` | `catchHistory`, `cumulativeSeries`, `milestones`, `caughtSince`, `byMonth` — progress over time from `updatedAt.caught`. A Pokémon only has the time of its latest mark; ones without a time are "undated" and counted first |
| `breeding.ts` | `breedingAdvice` (what hatches, from which caught parent, with what partner or Ditto, incense babies), `findEggMoveChains` (fathers that can pass an egg move down, through intermediate fathers), `family`, `baseStage`, `EGG_GROUP_NAMES`, `genderLabel`. The rules it applies are listed at the top of the file |
| `entries.ts` | `mergeEntries`, `liveEntries`, `restoreEntries`, `isEntries` — the entry-merged sync sections |
| `roamers.ts` | `roamersIn` (the `isRoaming` encounters of a set of games), `roamerState`, `roamerTips` |
| `shiny-odds.ts` | `oddsPerEncounter`, `chanceByNow`, `methodsFor` — Gen III/IV shiny odds: 1/8192 base, Masuda 5/8192 (Gen IV), the Poké Radar chain formula up to 1/200 at 40; fishing has no bonus before Gen VI |
| `progress-card.ts` | `cardLayout` (pure) and `drawCard` — the shareable progress image, drawn on a canvas in the browser. `ShareCard` in the Progress view loads the sprites with `crossOrigin = "anonymous"` (so the canvas can be exported), previews with the canvas itself, and offers Download and, where `navigator.canShare({ files })` allows, the native share sheet. Nothing is sent to a server |
| `npc-trades.ts` | Helpers for in-game trade rows (obtainable but not catchable); each row carries the area's `slug` and `location` |
| `iv-calc.ts` | `calcStat`, `calcHPStat`, `findIVs`, `ivRange`, `intersectIVSets`, `calculateHiddenPower`, `NATURES` — the one stat formula; the damage calc and catch calc use it too |
| `stat-calc.ts` | Designer stat totals; `UNKNOWN_IV` (0) is what an IV counts as until it is known |
| `generation.ts` | `generationMaxId`, `generationVersions`, `generationOfVersion`, `pairedVersion` — per-generation limits from `meta.json`. Loaded on every page, so it must not import the save tables |
| `abilities.ts` | `abilitiesInGeneration` (needs the Gen III ability slots from `save-tables.json`) |
| `url-route.ts` | `parseHash`, `hashOf`, `routeOf`, `applyRoute`, `startUrlRouting` — the address bar ↔ store (see "Cross-tab navigation") |
| `area-names.ts` | `areaDisplayName` — tidies an encounter area's name for display |
| `working-on.ts`, `journal.ts`, `notes.ts`, `notes-export.ts` | The Notes tab: list order and actions (with Undo), the "Today's catches" summary, per-generation note lists, and the Markdown export |
| `gender.ts`, `cute-charm.ts` | Gender ratio text and bar; the Gen IV Cute Charm glitch rule (`cuteCharmInfo`, sources in the file) |
| `bulbapedia.ts` | `bulbapediaPage` / `bulbapediaUrl` — an encounter area's place on Bulbapedia, with the override table. Links only; never embed map images |
| `list-sort.ts` | The tracker list view's column sort |
| `encounter-rates.ts` | `rateHidden(version, method)` — rates known to be wrong in the generated data, shown as "—" everywhere (Routes, Pokédex, What's next print) instead of fixed in the data: HG/SS Rock Smash (data 90/10, game 80/20) |
| `move-data.ts`, `move-values.ts` | Shapes and lazy loader of `public/data/moves.json` / `learnsets.json`; `moveValuesIn` (changelog → one game's values, used by the pipeline) |
| `move-fetch.ts` | `fetchLearnset`, `fetchMoveDetail`, `fetchLearners` (all from the local files), `moveForVersionGroup`, `versionGroupsFor` |
| `move-names.ts`, `showdown-export.ts` | `moveDisplayName` (slug → English name); a Designer slot as Showdown text |
| `damage-calc.ts` | `calcDamage` / `calcDamageRolls` — Gen IV order (base → Mod1 → +2 → crit → Mod2 → roll → STAB → type → Mod3) in exact fractions; abilities, items, entry hazards, weather chip |
| `move-lookup.ts`, `move-slug.ts` | Move name → slug for the damage calc, with the Gen IV spellings (`Hi Jump Kick`, `Faint Attack`, …). `moveNameToSlug` lives in `move-slug.ts` (no data) so `navigate.ts` can use it without loading the move tables |
| `calc-from-designer.ts`, `calc-from-tower.ts` | Designer slot / Battle Tower set → damage-calc Pokémon. `towerStats(set, pokemon, iv)` gives a set's level 50 stats at a trainer's IV tier (510 EVs shared equally, at most 255 each); `speciesKey` matches species names whatever the apostrophe |
| `catch-rate.ts` | Catch formula and ball bonuses (`getDynamicBallBonus`) |
| `clipboard.ts` | `copyText` — works on plain-HTTP LAN deployments, where `navigator.clipboard` doesn't exist |
| `type-colors.ts` | `TYPE_COLORS` (hex) and `TYPE_BG_COLORS` (Tailwind classes) for all 18 types |
| `save/parse.ts` | `parseSave` — picks the Gen III or Gen IV reader by file size |
| `save/gen4.ts`, `save/pk4.ts` | Gen IV save-file and Pokémon-record readers (`parseGen4Save`, `decodePk4`) |
| `save/gen3.ts`, `save/pk3.ts` | Gen III readers (`parseGen3Save`, `decodePk3`) — partly verified, see "Save import" |
| `save/todo.ts`, `save/acquire.ts`, `save/evolve.ts` | Living-dex to-do list, where to get what is missing, ready-to-evolve checks |
| `trade-session.ts` | `buildTradeSession` — what two saves or games should send each other |
| `save/best-copy.ts`, `save/origin.ts`, `save/mon-search.ts`, `save/history.ts`, `save/battle.ts` | Copy ranking, origin badges, box search, import diffs, Designer / damage-calc bridge |
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

Then sign in with those credentials. Use two browser profiles to test two devices syncing.

## Available Scripts

| Script | Action |
|--------|--------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build → `dist/` |
| `npm run preview` | Serve the `dist/` build locally |
| `npm run lint` | ESLint |
| `npm test` | Vitest (`src/**/*.test.ts`, Node environment, setup in `src/test/setup.ts`), then the sync server's tests (`node --test` in `sync-server/`; needs `npm install` there once) |
| `npm run generate-data` | Regenerate `public/data/pokemon.json` + `src/data/meta.json`, then validate (~2 min) |
| `npm run generate-moves` | Regenerate only `public/data/moves.json` + `learnsets.json` (pinned CSVs, no live API) |
| `npm run unlock-gaps` | List each game's encounter areas with no entry in `src/data/route-unlocks.ts` (they count as open from the start) |
| `npm run validate-data` | Check the generated data (pokemon, moves, learnsets); non-zero exit on failure |
| `npm run generate-save-tables` | Regenerate `src/data/save-tables.json` for the save importer |
| `npm run fetch-battle-tower` | Regenerate `src/data/battle-tower-sets.json` (all 950 sets) from pret/pokeplatinum at `PRET_PLATINUM_COMMIT`. `battle-tower-trainers.json` is hand-maintained (scraped once from altissimo1.github.io's rosters) |
| `npm run generate:og` | `public/og-image.png`, the 1200×630 link-preview image (`scripts/generate-og-image.mjs`; not precached) |
| `npm run generate:social` | `docs/social-preview.png`, the 1280×640 GitHub social preview, from `resources/icon.svg` and the tracker screenshot (`scripts/generate-social-preview.mjs`); uploaded by hand in the repo settings |
| `npm run screenshots` | Build, then capture the README screenshots (desktop 1440 px and phone 390 px, Dark and Burnished) into `docs/screenshots/` as WebP, from deterministic demo data seeded into localStorage — never real data (`scripts/capture-screenshots.ts`; `SHOTS=settings,pokedex` re-takes some) |
| `npm run e2e` | Build, then click through every cross-tab link in a real browser (`scripts/e2e-links.ts`, Playwright with an installed Chrome/Edge) at 1440 px and 375 px: links, CSP, offline, no PokéAPI, one check per Phase 5 feature (B1–B9), and two devices against a real local sync server (uses port 3001). `E2E_ITEMS=14,B3` runs a subset, `E2E_ONLY=375` one width. Not part of `npm test` or CI |

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npx tsc -b`, `npm test`, `npm run build` and `npm audit --omit=dev --audit-level=high` (the app and `sync-server/`) on every push and pull request; on pull requests and branches other than `main` it also builds the Docker image without pushing it, and on `main` (push or a manual run) the `publish` job builds and pushes it once those checks pass. Run lint, tsc and test before pushing. Dependabot (`.github/dependabot.yml`) opens weekly update pull requests: one grouped minor/patch pull request per package folder, one grouped pull request for GitHub Actions, and each major npm update on its own. TypeScript minor and major updates are ignored there until typescript-eslint's peer range allows them (it stops at 6.0) — check that before removing the rule.

## Offline (service worker)

`vite-plugin-pwa` (configured in `vite.config.ts`) generates `sw.js` and `manifest.webmanifest` in production builds; the dev server has no worker.

- **Precached:** everything in `dist/` — the shell, every lazy chunk, and `/data/*.json` — so the whole app works with no network. A new file type in `public/` has to match `workbox.globPatterns` to be included.
- **Never cached:** `/api/*` and `/health`. They have no runtime-caching rule and are on the navigation-fallback denylist.
- **Sprites** from `raw.githubusercontent.com` are cached as they are seen (`CacheFirst`, fetched with CORS so they aren't opaque). That fetch is made by the worker, which is why the CSP's `connect-src` lists that host.
- **Updates:** `registerType: "prompt"`: a new worker installs in the background and waits. `main.tsx`'s `onNeedRefresh` calls `updateSW(true)` (skip waiting, then reload) only while `document.hidden`, so a new version never reloads the page under the user; closing every window of the app also lets it take over. nginx serves `sw.js` and the manifest with `no-cache`.
- **iOS app:** `main.tsx` skips `registerSW()` when `Capacitor.isNativePlatform()`; the files are in the bundle but unused.
- **Icons:** `npm run generate:icon` writes the web icons in `public/` (and the iOS one) from `resources/icon.svg`.

## Design System Notes

- **Theme system.** All themes are dark-palette based. The active theme is stored in `useSettingsStore` under `theme` (persisted to `localStorage` key `pdx-theme`). `applyTheme()` in `src/lib/applyTheme.ts` sets `data-theme` on `<html>` and injects a `<style id="pdx-theme-vars">` block with scoped CSS variable overrides. Add new themes by extending `src/themes/index.ts`. A theme's `fonts` is a stylesheet in `public/fonts/` (Burnished: Cormorant Garamond, OFL) — fonts are served from this origin, never Google Fonts, so they work offline and the CSP stays `font-src 'self'`.
- **Tailwind v4 variable remapping.** Themes override Tailwind's internal CSS variables (`--color-gray-*`, `--color-indigo-*`) under `:root[data-theme="x"]`, so every utility class picks up the new palette automatically — no per-component changes needed.
- **Display font.** Heading elements use `style={{ fontFamily: 'var(--theme-font-display)' }}` inline. Each theme sets `--theme-font-display` in its `vars`. Do not hardcode font families in component styles.
- **Background: `gray-950` / `gray-900`.** Text: `gray-100` (primary), `gray-400` (secondary). `text-gray-500/600/700` are remapped in `styles/index.css` to `--theme-text-muted` / `--theme-text-faint` (set per theme, 4.5:1 or better on gray-900), so muted text stays readable while gray-500 borders and fills keep the palette. A new theme must define both.
- **Accent color:** `indigo-500/600` for primary actions and focus; `pink-500/600` for Pokédex compare slot B. **Success / caught:** `emerald` (not `green`). No emoji as icons — use Lucide.
- **Page layout:** every tab is a `PageShell` (`components/shared/Page.tsx`) — `width="full"` for the tracker-like tabs (Damage Calc), `"reading"` (max-w-4xl) for the rest — starting with a `PageHeader` (title, one-line subtitle, optional actions that stack under the title on a phone).
- **Shared controls:** `SegmentedControl` (`shared/SegmentedControl.tsx`) for any one-of-several choice (modes, formats, tiers, boxes, availability); `GameChip` / `GameDot` / `GameLegend` (`shared/GameChip.tsx`) for anything shown in a game's colour — chips pick white or dark text by contrast. Coloured dots always come with a `GameLegend`.
- **Area names** are tidied at display time by `areaDisplayName()` (`lib/area-names.ts`: "of" lower case, floors as 1F / B1F, "Mt."); the data and the place matching keep PokéAPI's names.
- **Touch:** tap targets are at least 44 px on a phone; typed fields and selects are 16 px on touch screens (`styles/index.css`) so iOS doesn't zoom, which is why the viewport allows pinch-zoom.
- **Type badges:** Use `TYPE_BG_COLORS` from `lib/type-colors.ts` — full Tailwind class strings, correctly scanned by Tailwind v4.
- **Gen III battle screen** in `CatchCalculator` uses intentional hardcoded hex colors for retro aesthetic — do not "fix" these.
- **Stat bar colors** use CSS vars `var(--theme-stat-low/mid/high)` in `pokedexHelpers.ts` — thresholds: <65 low, ≤90 mid, >90 high.

## Deployment

Docker image built and published to ghcr.io by the `publish` job in `.github/workflows/ci.yml` on every push to `main` — only after the `check` job (lint, tsc, tests, build, audit) has passed, so a red commit never reaches `latest`. Deployed on TrueNAS SCALE as a custom app on port 7777. See `docs/self-hosting.md` for full deploy steps.

nginx is PID 1 and serves `dist/`; `deploy/docker-entrypoint.sh` runs the sync server beside it in a restart loop, as the unprivileged `node` user (via `su-exec`, after handing `/data` to it; if that isn't possible on the volume it falls back to root and says so). The server listens on `127.0.0.1:3001` only. `deploy/nginx/default.conf` rate-limits `/api/login` (10/min) separately from pull/push (120/min), gzips text responses, and includes `security-headers.conf` in every location that sets its own headers (nginx drops inherited `add_header` lines otherwise). The image build runs `nginx -t`, so a broken config fails the build rather than the deploy, and CI runs `deploy/smoke-test.sh` against the built image before publishing it (app, headers, login, sync, `?since`, the login rate limit for every spelling of the path, and that the server runs as `node`).

- **Base image:** `node:22-alpine` pinned by digest (`NODE_IMAGE` in `deploy/Dockerfile`); Dependabot's docker entry for `/deploy` moves it.
- **`SITE_URL` build argument:** the address the build is served at. With it (CI passes `https://pokedex.shrumslab.com`), `index.html`'s `%SITE_URL%` meta tags become absolute og:url / og:image, and the build emits a `robots.txt` that allows crawling plus `sitemap.xml`. Without it (any other build) those tags are dropped and `robots.txt` disallows everything. Done by the `site-url` plugin in `vite.config.ts`.

- **Body size:** `client_max_body_size` in `deploy/nginx/default.conf` and `express.json({ limit })` in `server.js` are both 4 MB. Change them together. Compressed request bodies are refused (`inflate: false`, 415).
- **Real client address:** the rate limits count per client, so `deploy/nginx/real-ip.conf` trusts `X-Forwarded-For` from loopback and the private ranges by default; `TRUSTED_PROXIES` (comma-separated CIDRs, or `none`) makes the entrypoint rewrite that file.
- **Content-Security-Policy:** in `deploy/nginx/security-headers.conf`. Scripts and requests to this origin only — so no inline `<script>` in `index.html` (the theme bootstrap is `public/theme-init.js`). A new runtime host (images, fetches, fonts) has to be added there. `vite preview` sends the same header (`vite.config.ts` reads the file), so `npm run build && npm run preview` is the way to check a change against it; the dev server does not send it.

Environment variables required by the container:
- `APP_USER` — login username
- `APP_PASSWORD` — login password
- `SYNC_TOKEN` — sync API secret (generate with `openssl rand -hex 32`)
- `CORS_ORIGIN` — (optional) extra origins allowed to call the API cross-origin, comma-separated, e.g. `http://192.168.1.50:5173`. `capacitor://localhost` (the iOS app) is always allowed; any other origin gets no CORS header
- `TRUSTED_PROXIES` — (optional) reverse proxies whose `X-Forwarded-For` is trusted; default loopback + private ranges
