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

Before submitting a PR, make sure both of these pass:

```bash
npm run build   # TypeScript check + Vite production build
npm run lint    # ESLint
```

---

## Project Structure

```
src/
  components/
    box-view/       # PC box grid (BoxView, Box, PokemonCell)
    catch-calculator/ # Standalone catch rate tool
    controls/       # Small UI controls (GameSelector, DexModeSelector, etc.)
    detail-panel/   # Sidebar/overlay Pokémon details (DetailPanel, LocationTable, EvolutionBadge)
    iv-checker/     # IV calculator + PC Box session saves
    layout/         # Top-level Layout + Header
    list-view/      # Table/list view (ListView, PokemonRow)
    pokedex/        # National Pokédex viewer with learnset (PokedexTab and sub-components)
    route-info/     # Location/encounter browser (RouteInfo)
    shared/         # Shared components (TypeBadge, ErrorBoundary)
  hooks/
    usePokemonFilter.ts   # Main filtering pipeline (gen → dex → availability → search)
    useProgress.ts        # Caught/total progress calculation
    useRouteIndex.ts      # Inverted index: location → version → method → Pokémon[]
  lib/
    backup.ts             # Export/import backup JSON
    catch-rate.ts         # Gen III/IV catch probability formula
    format-location.ts    # Location slug → display name (hardcoded overrides)
    iv-calc.ts            # IV calculation formulas, nature multipliers, stat projection
    move-fetch.ts         # PokéAPI learnset/move fetcher with session caching
    pokemon-display.ts    # Sprite selector, dex number formatter
    type-colors.ts        # TYPE_COLORS (hex) and TYPE_BG_COLORS (Tailwind classes)
  store/
    useDexStore.ts        # Caught/pending per generation (Zustand + localStorage)
    useIvStore.ts         # IV checker sessions (Zustand + localStorage)
    useSettingsStore.ts   # All UI settings (Zustand + localStorage)
  styles/
    index.css             # Tailwind v4 entry point
  types/
    index.ts              # All shared TypeScript types

public/data/
  pokemon.json            # ~1.2 MB compiled Pokémon data (served at runtime, NOT bundled)

src/data/
  boxes.json              # PC box layout (bundled)
  meta.json               # Generation and regional dex metadata (bundled)
  npc-trades.json         # In-game NPC trades (bundled, manually maintained)

scripts/
  constants.ts            # Version names, PokéAPI IDs, generation metadata
  fetch-data.ts           # Main data generator (fetches from PokéAPI)
  merge-stats.ts          # One-time migration (already run, kept for reference)
  patch-slot2.ts          # One-time patch (already run, kept for reference)
```

---

## Regenerating Pokémon Data

The data pipeline fetches from [PokéAPI](https://pokeapi.co/) and writes to disk:

```bash
npm run generate-data
```

**Output files:**
- `public/data/pokemon.json` — 386+ Pokémon with encounters, evolution chains, regional dex entries, catch rates, and base stats. Compact JSON (no indent).
- `src/data/meta.json` — Generation definitions and regional dex metadata.
- `src/data/boxes.json` — PC box layout (13 boxes × 30 slots).

**Rate limiting:** The script batches 10 Pokémon per request with a 250ms delay. A full run takes 3–5 minutes. Do not remove the delay — PokéAPI will throttle or ban the IP.

**After running:** Commit the updated `public/data/pokemon.json`. The other two files (`meta.json`, `boxes.json`) rarely change.

---

## Scope: Currently Gen III Only

`src/data/meta.json` lists `activeGenerations: [3]`. The type system in `src/types/index.ts` supports Gen 1–9, and `scripts/constants.ts` has Gen 4 version names and IDs already defined.

**To add a new generation:**
1. Update `scripts/constants.ts` — add version names to `GEN_META` and `REGIONAL_DEXES`
2. Run `npm run generate-data` — fetches the new Pokémon from PokéAPI
3. Add display colors/labels to `GAME_COLORS`/`GAME_LABELS` in `src/types/index.ts`
4. Add location name overrides to `src/lib/format-location.ts` for the new region

---

## Pull Request Guidelines

- **One thing per PR** — keep changes focused and reviewable
- **Build and lint must pass** — `npm run build && npm run lint` with no errors
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
