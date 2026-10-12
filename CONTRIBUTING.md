# Contributing

Thanks for your interest in contributing to Pokédex Tracker!

---

## Development Setup

```bash
git clone https://github.com/Jabberwocky7777/pokedex-tracker.git
cd pokedex-tracker
npm install
npm run dev   # http://localhost:5173
```

Before submitting a PR, make sure all of these pass (CI runs the first three):

```bash
npm run lint    # ESLint
npx tsc -b      # TypeScript
npm test        # Vitest
npm run build   # production build
```

If you regenerated data, `npm run validate-data` must pass too.

---

## Project Structure

`CLAUDE.md` has the full, current map of the code: the directory tree, the stores, the tabs, how sync merges, the data pipeline and the save importer. The short version:

```
src/
  App.tsx          # loads pokemon.json, mounts sync, one keep-alive slot per tab
  components/      # one folder per tab or feature (layout/ is the tracker tab)
  hooks/           # usePokemonFilter (availability), useRouteIndex, useSyncEngine, …
  lib/             # pure logic, no React: sync, backup, calculators, search
    save/          # Gen III / IV save-file readers and everything built on them
  store/           # Zustand stores (persisted to localStorage; saves also use IndexedDB)
  data/            # bundled, generated JSON (meta, boxes, save tables, Battle Tower)
  types/           # shared types; APP_TABS and VIEW_MODES
sync-server/       # Express: /api/login, /api/pull, /api/push, /health — stores one JSON blob
scripts/           # data generators (see below)
public/data/       # pokemon.json — fetched at runtime, not bundled
overrides.json     # hand-maintained static / roaming / gift encounters
```

---

## Regenerating Pokémon Data

```bash
npm run generate-data
```

This runs `scripts/fetch-data.ts` and then `scripts/validate-data.ts`. See "Regenerating Pokémon Data" in the README for what comes from where; in short, encounters come from PokéAPI's CSVs at a pinned commit, everything else from the live API, and all of it is as of Generation IV.

**Output files:**
- `public/data/pokemon.json` — 493 Pokémon with encounters, evolution chains, regional dex entries, catch rates, types, abilities and base stats. Compact JSON, about 4.3 MB.
- `src/data/meta.json` — generation definitions, regional dexes, and the PokéAPI commit the encounters came from.
- `src/data/boxes.json` — PC box layout.
- `scripts/data/override-provenance.json` — which encounter rows came from `overrides.json`.

**Rate limiting:** the script fetches 10 Pokémon per batch with a 250 ms delay; a full run takes about two minutes. Do not remove the delay.

**After running:** `validate-data` must pass. Commit the four files together.

The other generators are `npm run generate-save-tables` (lookup tables for the save importer) and `npm run fetch-battle-tower` (Battle Tower trainers and sets).

---

## Things that are easy to get wrong

- **Don't break stored data.** Zustand `persist` keys and field names, the sync payload and the backup format are what users already have on their devices and server. If a shape has to change, add a migration and a test (`src/lib/__tests__/sync.test.ts` fails if a persisted field is missing from the payload).
- **Marks go through `toggleWithUndo()`** in `src/lib/dex-actions.ts`, never the store's toggle functions directly — that is what shows the Undo toast.
- **Sync is pull → merge → push.** Nothing pushes local state blindly, and the server has no merge logic.
- **Generation limits come from `src/lib/generation.ts`**, not from `386` / `493` literals.
- **Move numbers come from `moveForVersionGroup()`** in `src/lib/move-fetch.ts`, which reads the generated `public/data/moves.json`. Nothing in the app calls PokéAPI at runtime; new move or learnset data belongs in `scripts/moves-data.ts`.
- **Never commit a real save file.** `*.sav` and `*.dsv` are git-ignored; tests build synthetic saves.
- **The save parser is written from the documented format.** PKHeX is GPL-3: check behaviour against it if you like, but don't copy its code.

---

## Expanding to New Generations

`src/data/meta.json` lists `activeGenerations: [3, 4]`, and the app is built around those two: the data pipeline pins types, stats and abilities to Generation IV, and the calculators implement the Gen III/IV formulas. Adding a generation means, at least:

1. `scripts/constants.ts` — versions, version pairs and regional dexes in `GEN_META` / `REGIONAL_DEXES`, and the `TARGET_GENERATION` handling in `fetch-data.ts`
2. `npm run generate-data`
3. `GAME_COLORS` / `GAME_LABELS` in `src/types/index.ts`
4. Location names in `src/lib/format-location.ts`
5. Version groups in `src/lib/move-fetch.ts` and a machine map next to `src/components/pokedex/gen4-machines.ts`
6. The catch and damage formulas, which changed in Generation V

---

## Pull Request Guidelines

- **One thing per PR** — keep changes focused and reviewable
- **Lint, types, tests and build must pass** — see the commands above
- **Bug fixes come with a test** where one is practical
- **No behavior changes in refactors** — if you're splitting or reorganizing code, functionality must be identical
- **No new production dependencies** — open an issue to discuss before adding packages
- **Types everything** — avoid `any`; use `unknown` + narrowing if the shape is truly unknown

---

## Code Style Notes

- **Tailwind utility classes only** — no new CSS files
- **Co-locate types** — put interfaces/types in the file that owns them, or in `src/types/index.ts` if shared across 3+ files
- **Zustand for cross-component state, `useState` for local UI state** — don't put ephemeral UI state (dropdown open/closed) into a store
- **`TYPE_COLORS` and `TYPE_BG_COLORS`** come from `src/lib/type-colors.ts` — never redefine them locally
- **`activeGames = []` means "All Games"** — this is intentional; don't add a special-case check elsewhere
