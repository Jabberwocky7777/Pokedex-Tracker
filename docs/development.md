# Development

## Prerequisites
- [Node.js](https://nodejs.org/) 22+
- npm 10+

## Install and run

```bash
git clone https://github.com/Jabberwocky7777/pokedex-tracker.git
cd pokedex-tracker
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Testing sync locally

The sync server runs separately on port 3001. To test it during development:

1. Install its dependencies once: `cd sync-server && npm install`
2. In one terminal (pick any test values):
   `SYNC_TOKEN=dev-token APP_USER=dev APP_PASSWORD=dev-password DATA_DIR=./data node sync-server/server.js`
3. In another terminal: `npm run dev`, then sign in with the `APP_USER` / `APP_PASSWORD` you chose.

Vite proxies `/api/*` and `/health` to `127.0.0.1:3001` automatically (the server listens on loopback only; set `HOST=0.0.0.0` to reach it from another device). Without `APP_USER` / `APP_PASSWORD` the login form is not shown and the app offers offline mode only.

To see two devices converge, open the app in two separate browser profiles (or one normal and one private window), sign in on both, and mark different Pokémon in each.

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build → `dist/` |
| `npm run preview` | Serve the `dist/` build locally |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (sync merge, backup, filter and search, calculators, save import), then the sync server's tests |
| `npm run generate-data` | Regenerate `public/data/pokemon.json` + `src/data/*.json` from PokéAPI, then validate |
| `npm run validate-data` | Sanity-check the generated data; exits non-zero on bad data |
| `npm run generate-moves` | Regenerate only `public/data/moves.json` and `learnsets.json` (no live API needed) |
| `npm run generate-save-tables` | Regenerate the lookup tables the save importer uses (`src/data/save-tables.json`) |
| `npm run e2e` | Build, then click through the app's cross-tab links in a real browser (needs Chrome or Edge; uses ports 4174 and 3001) |
| `npm run fetch-battle-tower` | Regenerate the 950 Battle Tower sets (`src/data/battle-tower-sets.json`) from the pret/pokeplatinum decompilation |
| `npm run screenshots` | Build, then capture the README screenshots into `docs/screenshots/` from made-up demo data (`scripts/capture-screenshots.ts`; `SHOTS=settings` re-takes one) |
| `npm run generate:social` | `docs/social-preview.png`, the 1280×640 GitHub social preview (needs the screenshots) |

CI (`.github/workflows/ci.yml`) runs on pushes to `main` and on pull requests: lint, `tsc -b` and the scripts' type-check, the tests, a production build and `npm audit` of the runtime dependencies; the browser e2e suite in its own job; and a Docker build that is smoke-tested by `deploy/smoke-test.sh` — on `main` the image is then pushed to ghcr.io. See [CONTRIBUTING](../.github/CONTRIBUTING.md) before opening a pull request.

## Marking Pokémon

| Action | Quick mark **on** | Quick mark **off** |
|--------|-------------------|--------------------|
| Tap / click a cell or list row | Toggle caught | Open the detail panel |
| Double-click a cell | — | Toggle caught |
| Long-press (~0.5 s, touch) or right-click | Toggle pending | Toggle pending |
| List view checkboxes | Toggle caught / pending | Toggle caught / pending |
| `Shift+C` (tracker tab) | Toggle caught on the selected Pokémon | Same |
| `Space` / `Enter` on a focused list checkbox | Toggle it | Same |

Quick mark is the ⚡ button in the tracker filter bar. It defaults to on for touch screens (`pointer: coarse`) and off otherwise, and your choice is remembered per device. Shiny is toggled from the detail panel. Every change shows an **Undo** toast for 5 seconds.

## Search syntax

Terms are separated by spaces and must all match.

| Term | Matches |
|------|---------|
| `gengar` | Name contains "gengar" |
| `94`, `#094` | Dex number — the regional number when a regional dex is selected |
| `ghost` | Type |
| `caught:yes` / `caught:no` | Caught or not |
| `shiny:yes`, `pending:yes` | Marked shiny / pending (`:no` works too) |
| `note:yes` | Has a note in this generation (`note:no`: has none) |
| `cutecharm:no` | Can't be affected by Cute Charm: genderless or one gender only (`cutecharm:yes`: can) |

Example: `ghost caught:no` lists the Ghost types you still need.

The full map of the code — directory tree, stores, tabs, how sync merges, the save importer — is in [CLAUDE.md](../CLAUDE.md). How the data files are built is in [data-pipeline.md](data-pipeline.md).

## Trying the Saves view without a real save

`src/lib/save/__tests__/demo.ts` builds two made-up saves (a Platinum living dex and a SoulSilver playthrough). In the dev server's browser console:

```js
const { demoFiles } = await import("/src/lib/save/__tests__/demo.ts");
```

then give one of `demoFiles()` to the Saves view's file input. Nothing imports it; it is a hand-testing aid, kept on purpose.
