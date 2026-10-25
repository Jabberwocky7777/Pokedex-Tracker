# Data pipeline

The app ships with pre-generated data for all 493 Gen I–IV Pokémon in `public/data/pokemon.json`. To regenerate it:

```bash
npm run generate-data
```

The pipeline is one command with two steps:

1. **`scripts/fetch-data.ts`**
   - **Moves and learnsets** (`public/data/moves.json`, `public/data/learnsets.json`) come from the same pinned CSV dump: every Gen I–IV move as it was in each Gen III/IV game, and every Pokémon's learnset per version group. The app loads the two files the first time a move list is opened and never asks PokéAPI for anything while it runs. `npm run generate-moves` rebuilds just these two.
   - **Encounters** come from PokéAPI's CSV dump on GitHub at a **pinned commit**, so a re-run gives the same result until you choose to move the pin. The CSVs are cached under `node_modules/.cache/pokeapi-csv/<commit>/`.
   - **Species, stats, sprites, regional dexes and evolution chains** come from the live [PokéAPI](https://pokeapi.co/) (10 Pokémon per batch, 250 ms apart). Types, base stats and abilities are taken as of Generation IV (PokéAPI's past-generation data), hidden abilities are left out, and evolutions into Pokémon after #493 are dropped. If any request fails, the run fails.
   - `scripts/data/overrides.json` is merged on top: static legendaries and roamers (requirements, event items), plus gifts PokéAPI lacks. Outbreaks, Poké Radar, Slot 2, honey trees, the Great Marsh, the Trophy Garden, fossils and in-game trades are **not** overridden — they come straight from PokéAPI.
   - Known-bad data (the encounter denylist, unreachable Altering Cave Pokémon) is stripped last, after overrides.
   - Writes `public/data/pokemon.json`, `src/data/boxes.json`, `src/data/meta.json` (which records `dataSource.pokeapiCommit` and `generatedAt`) and `scripts/data/override-provenance.json`.
2. **`scripts/validate-data.ts`** (also `npm run validate-data`) prints encounter counts by version and method and fails if there aren't exactly 493 Pokémon, if a type, stat or ability is from a later generation, or if it finds placeholder outbreak rows, a Kanto starter with a wild encounter in Diamond/Pearl/Platinum, HeartGold or SoulSilver without headbutt encounters, or an override that duplicates a PokéAPI row with different levels.

A full run takes about two minutes.

## Updating the pinned PokéAPI commit

1. Pick a newer commit from [PokeAPI/pokeapi](https://github.com/PokeAPI/pokeapi/commits/master) and put its full SHA in `POKEAPI_COMMIT` in `scripts/constants.ts`.
2. Run `npm run generate-data`.
3. Compare the per-version method counts that `validate-data` prints with the previous run and skim `git diff --stat`; investigate anything surprising before committing.
4. Commit `scripts/constants.ts`, `public/data/pokemon.json`, `public/data/moves.json`, `public/data/learnsets.json`, `src/data/meta.json` and `scripts/data/override-provenance.json` together.

> **Note:** Run this locally and commit the result. Do not run it inside Docker — the script writes files to disk and needs network access to GitHub and PokéAPI.
