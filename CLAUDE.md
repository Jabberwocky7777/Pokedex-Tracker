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
├── App.tsx                  # Root: loads pokemon.json, mounts sync engine, keep-alive tab slots (tabs other than the tracker are lazy chunks)
├── main.tsx                 # Vite entry point
├── types/                   # Shared TypeScript types; APP_TABS and VIEW_MODES are the single lists of tabs and tracker views
├── themes/                  # Theme registry (AppTheme interface, dark + burnished themes)
├── store/                   # Zustand stores (see below)
├── hooks/                   # Custom React hooks (usePokemonFilter, useRouteIndex, useSyncEngine, useAttackdex, …)
├── lib/                     # Pure utility modules (no React); includes applyTheme.ts
│   └── save/                # Gen III/IV save-file readers, living-dex model, import planning (see "Save import")
├── data/                    # Bundled data: meta.json, boxes.json, save-tables.json, battle-tower-*.json (generated, committed); daily-events.ts, great-marsh.ts
├── styles/                  # Tailwind CSS entry (index.css)
└── components/
    ├── ThemeSelector.tsx    # Theme dropdown — wired to useSettingsStore
    ├── layout/              # Layout (the tracker tab), Header, FilterSubbar, SyncDot, SyncToast, UndoToast, MobileBottomNav
    ├── auth/                # LoginScreen, NativeOnboardingScreen (both always offer "Use offline")
    ├── tracker/             # DailyChecklist, WhatNextView, ChangeLogView, GestureHint, ProgressBreakdown, AvailabilityHelp
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
    ├── designer/            # DesignerTab, DesignerPanel, DesignerPcBox, IvSection, StatBlock, EvTracker, MoveGrid, MovePicker
    ├── trainer-lookup/      # TrainerLookupTab — Battle Tower trainers and their sets
    ├── damage-calc/         # DamageCalcTab, CalcPokemonPanel, CalcFieldPanel
    ├── settings/            # SettingsTab — generation, sync, backup, theme, clear data; ServerSnapshots (restore an older server copy)
    ├── saves/               # SavesView, BoxBrowser, MonCard, ImportReview, InYourSaves, and the To do / Plan / Search / History panels
    └── shared/              # TypeBadge, PokemonPicker, ShortcutModal, ErrorBoundary

sync-server/
├── server.js               # Express API: /api/login, /api/pull, /api/push, /api/snapshots, /health (createApp() + a main block)
├── server.test.js          # node --test; `npm test` at the root runs it after Vitest
├── package.json
└── package-lock.json       # The image installs with `npm ci`

scripts/
├── fetch-data.ts           # Builds public/data/pokemon.json + src/data/meta.json, boxes.json
│                           # Run via: npm run generate-data (runs validate-data afterwards)
├── pokeapi-csv.ts          # Loads encounter CSVs from PokeAPI/pokeapi at the pinned commit
├── validate-data.ts        # Sanity checks on the generated data (npm run validate-data)
├── fetch-save-tables.ts    # Builds src/data/save-tables.json (npm run generate-save-tables)
├── fetch-battle-tower.ts   # Builds src/data/battle-tower-*.json (npm run fetch-battle-tower)
├── generate-icon.mjs       # App icon (npm run generate:icon)
├── constants.ts            # Versions, dexes, and POKEAPI_COMMIT (the encounter data pin)
└── data/override-provenance.json  # Which rows came from overrides.json (generated, committed)

overrides.json              # Hand-maintained static/roaming/gift corrections merged by fetch-data

public/
└── data/pokemon.json       # Pre-generated Pokémon data (committed, compact JSON, ~4.3 MB)

Dockerfile, docker-entrypoint.sh, nginx.conf, nginx-security-headers.conf, nginx-real-ip.conf
                            # One image: nginx serves dist/ and proxies /api to the sync server,
                            # which the entrypoint runs in a restart loop
```

## Zustand Stores

| Store | File | Persisted | Contents |
|-------|------|-----------|----------|
| `useDexStore` | `store/useDexStore.ts` | ✅ localStorage | `caughtByGen`, `pendingByGen`, `shinyByGen`, `placedByGen` (in its own living-dex slot), and `updatedAt[field][gen][id]` — a per-entry timestamp written on every mark and un-mark (used by the sync merge) |
| `useDesignerStore` | `store/useDesignerStore.ts` | ✅ localStorage | `slots[]` — up to 6 team slots with IVs, EVs, nature, moves |
| `useSettingsStore` | `store/useSettingsStore.ts` | ✅ localStorage | `activeTab`, `activeGeneration`, `selectedPokemonId`, filter prefs, `quickMark`, `gestureHintDismissed`, `nextIncludeSetup`, `shinyLivingDex`, `saveNoticesSeen` — per-device, never synced |
| `useUndoStore` | `store/useUndoStore.ts` | ❌ in-memory | The current undo toast (message + undo callback) |
| `useChangeLogStore` | `store/useChangeLogStore.ts` | ✅ localStorage (key `pokedex-changelog-v1`) | `entries[]` — the change log, newest first, at most 100. Per-device: never synced or backed up |
| `useSyncStatus` | `hooks/useSyncStatus.ts` | ❌ in-memory | `syncing`, `lastSynced`, `error`, `forcePush` — sync UI state |
| `useBoxSlotStore` | `store/useBoxSlotStore.ts` | ✅ localStorage | `slotsByGen` — PC box assignments per generation/game/box |
| `useIvStore` | `store/useIvStore.ts` | ✅ localStorage | `savedSessions` — named IV checker session saves. Nothing in the UI writes these any more; the store is kept so existing data still syncs and backs up |
| `useBattleCalcStore` | `store/useBattleCalcStore.ts` | ✅ localStorage | Damage calculator: both Pokémon, weather, screens, hazards, format — per-device, never synced |
| `useSaveStore` | `store/useSaveStore.ts` | ✅ localStorage (key `save-profiles-v1`) + IndexedDB | localStorage: `profiles[]` (save-profile metadata, synced), `removedProfiles` (id → time removed, synced so a removal reaches other devices) and `activeProfileId` (per device). IndexedDB, loaded by `hydrate()`: `summaries` (synced), `fullSaves`, `reverts` and `history` (this device only). In memory: `panel`, `todoChecks`, `storageFailed` |

## Application Tabs

| Tab ID | Component | Description |
|--------|-----------|-------------|
| `tracker` | `Layout` | Grid/list/PC-box view for all 493 Gen I–IV Pokémon. Caught/pending/shiny marks, progress bar with breakdown, game + availability filtering, the "What can I get next" view (`viewMode: "next"`), imported game saves (`viewMode: "saves"`) and the change log (`viewMode: "log"`). |
| `pokedex` | `PokedexTab` | Single Pokémon detail: base stats, side-by-side stat comparison, full learnset (level-up, TM/HM, egg, tutor) via PokéAPI, and "Where to Find" encounter location table. |
| `attackdex` | `AttackdexTab` | Move browser: search any of the 467 Gen I–IV moves, view power/accuracy/PP/effect for the selected game, and see which Pokémon learn it. Also the move-combo search and the HM planner. |
| `routes` | `RouteInfo` | Searchable list of locations with encounter tables by version and method. HGSS routes show morning/day/night badges. With no game selected it covers the active generation's games only. |
| `catch-calc` | `CatchCalculator` | Gen III/IV catch rate formula with all Poké Balls, status conditions, HP modifiers, and retro battle HP bar UI. Dive and Repeat Ball bonuses are behind "surfing or fishing" / "already caught" checkboxes. |
| `designer` | `DesignerTab` | Team builder: IV range narrowing, stat projections, EV planning, nature selection, move picker (PokéAPI), PC Box slot management. |
| `trainer-lookup` | `TrainerLookupTab` | Battle Tower trainers by category, with their possible sets; any set can be sent to the damage calculator. |
| `damage-calc` | `DamageCalcTab` | Gen IV damage formula for two Pokémon, both directions: weather, screens, Stealth Rock and Spikes, abilities, items, singles/doubles. |
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
- **Merging** (`lib/sync-merge.ts`, pure functions): caught/pending/shiny/placed marks merge per entry by `updatedAt` timestamp — newer wins, un-marks included, missing timestamp = 0, ties keep the mark. Designer slots, IV sessions, box slots and save summaries (`saveSummaries`) are last-write-wins per section via `sectionUpdatedAt` (stamped by store subscriptions in `sync.ts`; applying remote data does not stamp).
- **Server stays dumb:** `sync-server/server.js` stores and returns one JSON blob. Don't add merge logic there.
- **Server snapshots:** before a push replaces `sync.json`, the server copies the old one to `DATA_DIR/snapshots/<UTC hour>.json` — once per hour, pruned to hourly for 24 h and daily for 30 days. `GET /api/snapshots` lists them and `GET /api/snapshots/:id` returns one. Restoring is a client action: `ServerSnapshots` in Settings fetches one and hands it to `restoreBackupData()`, and the result syncs like any other edit.
- **Saves merge per profile.** `saveSummaries` is the exception to section-level last-write-wins: `mergeSaves()` keeps every profile either device has, takes the newer `importedAt` when both have one, and honours `removed` tombstones (`useSaveStore.removedProfiles`), so two devices importing different saves both keep theirs.
- **Normalise on the way in.** `applySnapshot()` and backup restore go through store setters that bring data to the current shape (`normalizeSlots()` pads Designer slots to 90 and fills new fields); `validateBackup()` rejects malformed `boxSlots`, `designer` and `saveSummaries`.
- **Adding a synced field:** add it to the store's `partialize`, to `buildPayload()` and `applySnapshot()` in `sync.ts`, and to the mapping in `lib/__tests__/sync.test.ts` — that test fails if a persisted field is missing from the payload. Backups use the same `buildPayload()`.
- **`saveSummaries` section:** `{ profiles, summaries, removed }` from `useSaveStore` — profile metadata plus, per profile, the box names and `[box, slot, species, form, shiny, level, isEgg, own]` for every Pokémon (~15 KB per save). The `.sav` bytes and the fully parsed save never sync. `syncOnce()` awaits `useSaveStore.hydrate()` first, because the summaries load from IndexedDB asynchronously.
- **Sync indicator:** `SyncDot` in the header shows live status (idle / syncing / synced / stale / error)
- **Dev:** Vite proxies `/api/*` and `/health` → `localhost:3001`

## Data Pipeline

`npm run generate-data` = `scripts/fetch-data.ts` then `scripts/validate-data.ts`.

- **Encounters are pinned.** They are read from PokéAPI's CSVs at `POKEAPI_COMMIT` (`scripts/constants.ts`), not the live API. To pick up newer PokéAPI data, change that SHA, re-run, and review the method counts `validate-data` prints. `meta.json` records the commit under `dataSource`.
- Species, stats, sprites and evolutions still come from the live API. A failed fetch fails the run — nothing is skipped.
- **Everything is as of Generation IV.** `fetch-data.ts` applies PokéAPI's `past_types`, `past_stats` and `past_abilities` (`TARGET_GENERATION`), drops hidden abilities and abilities introduced later, and drops evolutions into species above #493. `validate-data` checks this (no Fairy, known Gen IV stats, Gengar has Levitate, …).
- **Move data is per game too.** `lib/move-fetch.ts` reads PokéAPI's `past_values`; `moveForVersionGroup(detail, versionGroup)` gives power/accuracy/PP/type as they were in that game. Don't read a move's top-level numbers from PokéAPI directly — they are the current games'.
- **Don't add placeholder overrides.** `overrides.json` only covers static legendaries, roamers and gifts PokéAPI lacks. Outbreaks, Poké Radar, Slot 2, honey trees, Great Marsh, Trophy Garden, fossils and NPC trades (method `"trade"`) come from PokéAPI. Gift overrides are gap-fill only.
- The encounter denylist and Altering Cave clean-up run **after** overrides are merged.
- `validate-data` must pass before committing regenerated data.

## Save import (Gen III and IV)

The tracker's Saves view (`viewMode: "saves"`, `components/saves/`) imports `.sav` dumps from Diamond, Pearl, Platinum, HeartGold and SoulSilver (512 KB) and from Ruby, Sapphire, Emerald, FireRed and LeafGreen (128 KB). `parseSave()` in `lib/save/parse.ts` picks the reader by file size. Everything is parsed in the browser; the file is never uploaded and never written to.

- **Licensing:** the parser is written from the documented format (Bulbapedia, Project Pokémon). PKHeX is GPL-3 — use it only as a behaviour reference, never copy its code.
- **Never commit real saves.** `*.sav` / `*.dsv` are gitignored. `lib/save/__tests__/real-save.test.ts` runs only when `lib/save/__tests__/fixtures/platinum.sav` (and optionally `emerald.sav`, `pearl.sav`, `soulsilver.sav`) exist; every other test builds synthetic saves with `__tests__/build.ts`.
- **Format** (`lib/save/gen4.ts`, `pk4.ts`): the Platinum layout is verified against a real cartridge (`real-save.test.ts`, 127 placed / 136 owned) and HGSS against a real SoulSilver save; for DP only the header was checked on a real, empty Pearl save (`UNVERIFIED_FAMILIES` — `dp`, `rse`, `frlg` — triggers a one-time "spot-check" notice). Three traps worth knowing: Platinum's party is at 0xA0 (not Bulbapedia's 0x98); the current boxes are the storage block whose **link value** matches the newest general block — often in the *other* save slot; and the block footer is 0x14 bytes in DP/Pt but 0x10 in HGSS, which has no link field (its save counter is used instead).
- **Gen III** (`lib/save/gen3.ts`, `pk3.ts`): **partly verified** — block/section selection, trainer, party and box names were checked against one real Emerald save (empty PC). Boxed Pokémon and all of FireRed/LeafGreen are tested only with synthetic saves from `__tests__/build3.ts`. Families `rse` and `frlg`; marks go to tracker generation 3. `GEN_CONFIG` / `genConfigOf(family)` in `lib/save/types.ts` carries what differs (generation, 386 vs 493 species, 14 vs 18 boxes, games), and profiles of different generations are never planned together. Gen III has no nickname flag, no gender field and only an ability-slot bit, so those are derived (species name comparison, PID + gender ratio, `abilities3` table). `SaveMon.gen` says which generation's item and met-location tables apply — use `heldItemName(mon)` / `metLocationName(mon)`.
- **Lookup tables:** `src/data/save-tables.json` (moves, abilities, species names, growth curves, gender ratios; Gen III and Gen IV item and met-location indices; the Gen III internal species index and ability slots) is generated by `npm run generate-save-tables` from the PokéAPI CSVs at `POKEAPI_COMMIT`. The Gen III ability slots are the exception: they come from `public/data/pokemon.json` (abilities that existed in Gen III), because today's PokéAPI ability list is wrong for Gen III (Shiftry, Pelipper, Torkoal, Feebas). Run `generate-data` first if pokemon.json is stale.
- **Profiles:** each save is a profile (`id = family-tid-sid`) with a role. One is the **living dex** (National Dex order, 30 per box, from `startBox`); the rest are **playthroughs**, which count as owned but never as placed.
- **Storage:** raw bytes, the parsed save, the summary and the pre-import snapshot live in IndexedDB (`lib/save/storage.ts`); localStorage has only profile metadata. Raw bytes are kept so "Re-read all saves" can re-parse after a parser fix. If a write fails (quota, private mode) `storageFailed` is set and the Saves view says so. Files over 2 MB are refused before they are read.
- **Marks from saves** (`lib/save/reconcile.ts`, `planImport`): planned against *all* imported profiles, then shown in `ImportReview` — nothing is applied unticked. Removals of caught/shiny default to unticked; an older dump (lower save counter) or more than 10 removals unticks every removal. Applying goes through `applyImportWithUndo()` and stores a snapshot for "Revert last import".
- **Pending is allocated, not inferred** (`lib/save/living-dex.ts`, `allocatePending`): each physical copy counts once — a copy whose own slot is still empty is kept for that slot, a placeholder counts for its slot's species, and any other spare for one uncaught later stage (nearest stage, then lowest dex number). Babies are never pending; a missing baby with an owned later stage is "needs breeding" advice.
- **To-do list** (`lib/save/todo.ts`, `buildTodo`; `TodoPanel`): ordered steps for the living-dex save — swap, move, evolve, bring over from another save, catch (best location via `lib/save/acquire.ts`, which reuses `buildNextLocations`), breed, spares. Ticks live in `useSaveStore.todoChecks` (memory only) and reset on the next import.
- **Ready to evolve** (`lib/save/evolve.ts`, `checkEvolution`): level, friendship (≥ 220), held item and known moves are compared with `evolvesTo` in pokemon.json; anything the save can't answer (place, time of day, Beauty) is shown as the game words it. Feeds the READY tags in the box grid, the Pokémon card and the to-do list.
- **Best copy** (`lib/save/best-copy.ts`): copies of a species across saves are ranked by shiny (only with "Shiny living dex" on), own catch, native to the living-dex game, IV total, level. A placed Pokémon's card says when a better copy exists, and the to-do list has a "Swap in best copies" section.
- **Origins** (`lib/save/origin.ts`): Your catch / Traded / Native / Pal Park / Event badges on the card, and T / P / E markers in the grid. The summary carries an `own` flag per Pokémon so the per-profile option "Only count my own catches as placed" (`SaveProfile.ownOnly`) works on every device.
- **Transfer planner** (`buildTransferPlan` in `lib/save/acquire.ts`; `PlanPanel`): everything the living-dex save lacks, as a shopping list per game — already in another save to send over, best caught there (version exclusives flagged), plus evolutions (trade evolutions flagged), breeding and the unobtainable.
- **Box search** (`lib/save/mon-search.ts`; `SearchPanel`): searches every Pokémon in every imported save — name, dex number, `shiny`, `egg`, `nature:` `ability:` `item:` `move:` `ot:` `game:`, IV conditions (`spe:31`, `atk>=28`, `ivtotal>=150`, `perfect>=4`), `evtotal`, `level`. Summary-only saves answer name, shiny, egg and level.
- **Battle tools** (`lib/save/battle.ts`, `monToDesignerPatch`): the card shows Hidden Power from the real IVs, "Send to Designer" fills the first free Designer slot (exact IVs go in `confirmedIVs`), and "Use in damage calc" loads slot 1 through `designerSlotToCalcPokemon`.
- **Import history** (`lib/save/history.ts`, `diffSaves`; `HistoryPanel`): each import is diffed against the previous full save of that profile by PID, so evolutions show as "Kakuna → Beedrill". Newly placed, evolved, new shinies, added, removed and level-ups; the last 20 entries per profile live in IndexedDB on the importing device, and the review screen shows "Since last import".
- **Tracking is species-level.** Forms are shown on the Pokémon card (`lib/save/forms.ts`) but not tracked.

## Tracker Interaction

- **Quick mark** (`useSettingsStore.quickMark`, ⚡ in the filter bar): on = a single tap/click toggles caught; off = tap selects, double-click toggles caught. Defaults to on for `(pointer: coarse)`.
- **Long-press** (~500 ms, touch) toggles pending on cells and list rows via `hooks/useLongPress.ts`; right-click does the same with a mouse.
- **Undo:** every caught/pending/shiny/placed toggle goes through `toggleWithUndo()` in `lib/dex-actions.ts`, which shows the `UndoToast` for 5 s. Undo uses the normal store setters so sync sees it. Don't call the store's toggle functions directly from UI code.
- **Change log** (`viewMode: "log"`, `components/tracker/ChangeLogView.tsx`, `lib/change-log.ts`, `useChangeLogStore`): everything in `dex-actions.ts` runs through `logged()`, which snapshots the generation before and after and records the difference — so a new way of changing marks gets logged by going through `dex-actions.ts`, not by writing to the log itself. Kinds: `marks` (by hand; grouped while less than 5 minutes apart in the same generation, and a mark taken back cancels out of its group), `import`, `clear`, `revert`. `undoLogEntry(id, pokemonId?)` puts a mark back only while it still has the value the entry gave it; anything changed again since is skipped and reported. Undone entries stay in the list with Redo. Backup restore and changes arriving by sync are not logged.
- **View buttons:** `ViewToggle` is only box / list / slots — three layouts of the same list. What's next, Saves and Changes replace the list with a tool, so they are separate labelled buttons (`ToolButtons` in `FilterSubbar.tsx`; their own row on a phone). Pressing the open one again returns to the box view.
- **Search syntax** lives in `lib/pokemon-search.ts` (name, `94` / `#094`, type names, `caught:` / `shiny:` / `pending:` + `yes`/`no`).
- **Availability logic** is `computeAvailability()` / `filterPokemon()` in `hooks/usePokemonFilter.ts`; keep `components/tracker/AvailabilityHelp.tsx` in step with it.
- **Keyboard shortcuts** (`hooks/useKeyboardShortcuts.ts`) only act while the tracker tab is the active one — every tab stays mounted, so a global listener must check `activeTab`.
- **Generation limits** come from `lib/generation.ts` (`generationMaxId`, `generationVersions`, `pairedVersion`, all read from `meta.json`). Don't write 386 / 493 or a game list by hand.
- **Abilities are shown through `abilitiesInGeneration(pokemon, generation)`** (same file), not `pokemon.abilities` directly: pokemon.json has them as of Gen IV, and 89 species had one fewer in Gen III.

## Key Utility Modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `sync.ts` | Token + local-mode flags, `pullData`, `pushData`, `buildPayload`, `applySnapshot`, `syncOnce` |
| `sync-merge.ts` | `mergeTracker`, `mergePayload`, `payloadsEqual` — pure merge logic |
| `backup.ts` | `BackupData` type (version 2); `downloadBackup` (uses `buildPayload`), `restoreBackup` (accepts v1 and v2) |
| `dex-actions.ts` | `toggleWithUndo`, `clearGenerationWithUndo`, `applyImportWithUndo`, `restoreGenLogged`; `undoLogEntry` / `redoLogEntry` for the change log |
| `change-log.ts` | `LogEntry`; `diffSnapshots`, `mergeChanges`, `isApplied`, `describeChanges` ("Pending → Caught"), `summarizeChanges` |
| `pokemon-search.ts` | Tracker search parser and matcher |
| `what-next.ts` | `buildNextLocations` for the "What can I get next" view |
| `evolution-status.ts` | Uncaught-evolution helpers shared by the needs-attention filter and detail panel |
| `npc-trades.ts` | Helpers for in-game trade rows (obtainable but not catchable) |
| `iv-calc.ts` | `calcStat`, `calcHPStat`, `findIVs`, `ivRange`, `intersectIVSets`, `calculateHiddenPower`, `NATURES` — the one stat formula; the damage calc and catch calc use it too |
| `stat-calc.ts` | Designer stat totals; `UNKNOWN_IV` (0) is what an IV counts as until it is known |
| `generation.ts` | `generationMaxId`, `generationVersions`, `pairedVersion` — per-generation limits from `meta.json`; `abilitiesInGeneration` |
| `move-fetch.ts` | PokéAPI learnset + move detail fetching with module-level caches; `moveForVersionGroup`, `buildMoveDetail`, `versionGroupsFor` |
| `damage-calc.ts` | `calcDamage` / `calcDamageRolls` — Gen IV order (base → Mod1 → +2 → crit → Mod2 → roll → STAB → type → Mod3) in exact fractions; abilities, items, entry hazards, weather chip |
| `move-lookup.ts` | Move name → PokéAPI slug for the damage calc, with the Gen IV spellings (`Hi Jump Kick`, `Faint Attack`, …) |
| `calc-from-designer.ts`, `calc-from-tower.ts` | Designer slot / Battle Tower set → damage-calc Pokémon |
| `catch-rate.ts` | Catch formula and ball bonuses (`getDynamicBallBonus`) |
| `clipboard.ts` | `copyText` — works on plain-HTTP LAN deployments, where `navigator.clipboard` doesn't exist |
| `type-colors.ts` | `TYPE_COLORS` (hex) and `TYPE_BG_COLORS` (Tailwind classes) for all 18 types |
| `save/parse.ts` | `parseSave` — picks the Gen III or Gen IV reader by file size |
| `save/gen4.ts`, `save/pk4.ts` | Gen IV save-file and Pokémon-record readers (`parseGen4Save`, `decodePk4`) |
| `save/gen3.ts`, `save/pk3.ts` | Gen III readers (`parseGen3Save`, `decodePk3`) — partly verified, see "Save import" |
| `save/todo.ts`, `save/acquire.ts`, `save/evolve.ts` | Living-dex to-do list, where to get what is missing, ready-to-evolve checks |
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
| `npm run validate-data` | Check the generated data; non-zero exit on failure |
| `npm run generate-save-tables` | Regenerate `src/data/save-tables.json` for the save importer |
| `npm run fetch-battle-tower` | Regenerate `src/data/battle-tower-*.json` |

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

nginx is PID 1 and serves `dist/`; `docker-entrypoint.sh` runs the sync server beside it in a restart loop. `nginx.conf` rate-limits `/api/login` (10/min) separately from pull/push (120/min), gzips text responses, and includes `nginx-security-headers.conf` in every location that sets its own headers (nginx drops inherited `add_header` lines otherwise). The image build runs `nginx -t`, so a broken config fails the build rather than the deploy.

- **Body size:** `client_max_body_size` in `nginx.conf` and `express.json({ limit })` in `server.js` are both 4 MB. Change them together.
- **Real client address:** the rate limits count per client, so `nginx-real-ip.conf` trusts `X-Forwarded-For` from loopback and the private ranges by default; `TRUSTED_PROXIES` (comma-separated CIDRs, or `none`) makes the entrypoint rewrite that file.
- **Content-Security-Policy:** in `nginx-security-headers.conf`. Scripts from this origin only — so no inline `<script>` in `index.html` (the theme bootstrap is `public/theme-init.js`). A new runtime host (images, fetches, fonts) has to be added there. `vite preview` sends the same header (`vite.config.ts` reads the file), so `npm run build && npm run preview` is the way to check a change against it; the dev server does not send it.

Environment variables required by the container:
- `APP_USER` — login username
- `APP_PASSWORD` — login password
- `SYNC_TOKEN` — sync API secret (generate with `openssl rand -hex 32`)
- `CORS_ORIGIN` — (optional) restrict CORS to a specific origin, e.g. `http://192.168.1.50:7777`
- `TRUSTED_PROXIES` — (optional) reverse proxies whose `X-Forwarded-For` is trusted; default loopback + private ranges
