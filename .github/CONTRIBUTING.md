# Contributing

Thanks for your interest in Pokédex Tracker. It is a hobby project, so the
process is light: open an issue for anything bigger than a small fix, then a
pull request.

## Setup

Node.js 22 or later.

```bash
git clone https://github.com/Jabberwocky7777/Pokedex-Tracker.git
cd Pokedex-Tracker
npm install
npm install --prefix sync-server   # once, for the sync server's tests
npm run dev                        # http://localhost:5173
```

Running the sync server locally and the app's controls are in
[docs/development.md](../docs/development.md). [CLAUDE.md](../CLAUDE.md) is the
full map of the code: stores, tabs, how sync merges, the data pipeline and the
save importer.

## Before you open a pull request

CI runs all of these; run them first:

```bash
npm run version:check   # package.json and the iOS version agree
npm run lint            # ESLint
npm run format:check    # Prettier (npm run format fixes it)
npm run knip            # unused files, dependencies and exports
npm run typecheck       # the app and the scripts
npm test                # Vitest, then the sync server's tests
npm run build
```

If you regenerated data, `npm run validate-data` must pass and the generated
files are committed together. If you changed where a view lives or how links
work, run `npm run e2e` too.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, …). User-visible changes get a line
under `## [Unreleased]` in [CHANGELOG.md](../CHANGELOG.md).

## Things that are easy to get wrong

- **Don't break stored data.** Persist keys, field names, the sync payload and
  the backup format are already on people's devices and servers, and older app
  versions keep syncing. Add a new field or section instead of changing an
  existing one, and add a migration and a test if a shape must change
  (`src/lib/__tests__/sync.test.ts` fails if a persisted field is missing from
  the payload).
- **Marks go through `toggleWithUndo()`** in `src/lib/dex-actions.ts`, never the
  store's toggles directly: that is what shows Undo and writes the change log.
- **Sync is pull → merge → push**, and the server has no merge logic.
- **Generation limits come from `src/lib/generation.ts`**, not `386` / `493`.
- **Nothing calls PokéAPI at runtime.** Move and learnset data comes from the
  generated `public/data/*.json`; new data belongs in the generators in `scripts/`.
- **Never commit a real save file or backup.** `*.sav` and `*.dsv` are
  git-ignored; tests build synthetic saves.
- **The save parser is written from the documented format.** PKHeX is GPL-3:
  compare behaviour with it if you like, but don't copy its code.
- **New runtime hosts** (images, fetches, fonts) must be added to the
  Content-Security-Policy in `deploy/nginx/security-headers.conf`.

## Style

Prettier formats everything (`printWidth` 120). Beyond that:

- Tailwind utility classes, no new CSS files; colours come from the theme
  variables, type colours from `src/lib/type-colors.ts`.
- Lucide icons, no emoji as icons.
- Comments say why, not what. Exported functions in `src/lib/` get a short doc
  comment when their behaviour isn't obvious from the name.
- "Pokédex Tracker" with the accent in anything people read; `pokedex` in
  identifiers, file names and URLs.
- Avoid `any`; use `unknown` and narrow it.

## Adding a generation

The app is built around Generations III and IV (`activeGenerations` in
`src/data/meta.json`): the pipeline pins types, stats and abilities to Gen IV,
and the calculators use the Gen III/IV formulas. A new generation needs at
least: versions, pairs and regional dexes in `scripts/constants.ts` (and
`TARGET_GENERATION` in `fetch-data.ts`), `npm run generate-data`,
`GAME_COLORS` / `GAME_LABELS` in `src/types/index.ts`, location names in
`src/lib/format-location.ts`, version groups in `src/lib/move-fetch.ts` with a
machine map like `src/components/pokedex/gen4-machines.ts`, and the catch and
damage formulas, which changed in Gen V. Open an issue first.

## Releases

Maintainers only: the steps are in [CLAUDE.md](../CLAUDE.md#full-release-steps).
In short, `npm run version:set -- 1.8`, move the changelog's Unreleased section
under `[1.8]`, push, then push the tag `v1.8`; the release workflow builds and
publishes everything.
