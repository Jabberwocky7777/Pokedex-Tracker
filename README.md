# Pokédex Tracker

A Gen III–IV Pokémon collection tracker with cross-device sync, a catch rate calculator, IV checker, learnset viewer, and route encounter browser. Built as a single-page React app — all data lives in your browser, with optional self-hosted sync.

---

## Features

- **Tracker** — Box view and list view for all 493 Gen I–IV Pokémon, with caught/pending/shiny marks and a progress bar that expands into a per-game and per-dex breakdown
- **Quick mark and touch gestures** — With **Quick mark** on (the default on touch screens) a single tap marks a Pokémon caught; long-press (or right-click) marks it pending. With it off, a tap opens details and a double-click marks caught. See [Marking Pokémon](#marking-pokémon)
- **Undo** — Every caught, pending or shiny change shows an Undo button for 5 seconds; so does clearing a whole generation from Settings
- **Search** — By name, dex number (`94`, `#094`), type (`ghost`), or `caught:no` / `shiny:yes` / `pending:yes`. See [Search syntax](#search-syntax)
- **What can I get next** — A tracker view (compass icon) that ranks locations in your selected games by how many uncaught Pokémon are found there, grouped by encounter method
- **Evolution reminders** — When a caught Pokémon has an evolution you haven't caught, its detail panel says how it evolves and flags trade evolutions
- **Game filtering** — Filter by Ruby, Sapphire, Emerald, FireRed, LeafGreen, Diamond, Pearl, Platinum, HG/SS, or any combination
- **Availability modes** — Show all, obtainable only, directly catchable only, or only what needs attention; the (?) button next to the filter explains each
- **Offline mode** — "Use offline" on the login screen keeps everything on the device with no server; sign in later from Settings and the two copies are merged
- **Regional dex** — Switch between National, Hoenn, and Kanto dex numbering
- **Catch rate calculator** — Gen III/IV formula with all Poké Balls, status conditions, and HP modifiers
- **Designer** — IV range narrowing, stat projections, nature support, EV planning, PC Box slot management, and move picker via PokéAPI
- **Pokédex tab** — Base stat bars, side-by-side comparisons, full learnset viewer (level-up, TM/HM, egg moves, tutors) via PokéAPI, and a "Where to Find" encounter table with clickable route links
- **Attackdex** — Full move browser: search any move to see its type, power, accuracy, PP, effect, and which Pokémon learn it
- **Route info** — Browse encounter tables by location, version, and method, including time-of-day encounter differences (morning/day/night) for HGSS
- **Cross-device sync** — Optional self-hosted sync server (included in the Docker image) keeps progress in sync between PC and phone; polls every 30 s so changes appear automatically without a page reload, and merges changes entry by entry so two devices can't erase each other's marks
- **Trainer lookup** — Browse Battle Tower trainer teams by category, with full Pokémon sets, held items, and moves; send any Pokémon directly to the damage calculator
- **Damage calculator** — Gen IV damage formula with two Pokémon slots, weather, Reflect/Light Screen, abilities, and move-by-move damage ranges
- **Mobile & tablet ready** — Bottom tab navigation, horizontally-scrollable filter controls, and touch-friendly tap targets for iPhone and iPad
- **Theme selector** — Switch between Dark and Burnished (warm sepia/gold) themes; selection persists across reloads with no flash on load

---

## Tech Stack

| Tool | Version |
|------|---------|
| React | 19.x |
| TypeScript | 6.x |
| Zustand | 5.x (with `persist` middleware) |
| Tailwind CSS | 4.x (via `@tailwindcss/vite`) |
| Vite | 8.x |
| Capacitor | 8.x (iOS native wrapper) |

---

## iOS App

The web app is wrapped as a native iOS app via [Capacitor](https://capacitorjs.com/). The Xcode project lives in `ios/` and targets iOS 15+.

### Building the IPA

You need a Mac with Xcode installed.

```bash
npm run build          # Build the web app
npx cap sync ios       # Sync web assets into the Xcode project
```

Then open `ios/App/App.xcodeproj` in Xcode and build/run on your device.

A GitHub Actions workflow (`.github/workflows/build-ios.yml`) can build an ad-hoc signed IPA on demand — trigger it manually from the **Actions** tab. The IPA is uploaded as a build artifact and can be sideloaded with [AltStore](https://altstore.io/) or similar tools.

> **Note:** The IPA workflow is manual-only (no automatic build on push) to avoid consuming macOS runner minutes on every commit.

---

## Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) 22+
- npm 10+

### Install and run

```bash
git clone https://github.com/Jabberwocky7777/pokedex-tracker.git
cd pokedex-tracker
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Testing sync locally

The sync server runs separately on port 3001. To test it during development:

1. Install its dependencies once: `cd sync-server && npm install`
2. In one terminal (pick any test values):
   `SYNC_TOKEN=dev-token APP_USER=dev APP_PASSWORD=dev-password DATA_DIR=./data node sync-server/server.js`
3. In another terminal: `npm run dev`, then sign in with the `APP_USER` / `APP_PASSWORD` you chose.

Vite proxies `/api/*` and `/health` to `localhost:3001` automatically. Without `APP_USER` / `APP_PASSWORD` the login form is not shown and the app offers offline mode only.

To see two devices converge, open the app in two separate browser profiles (or one normal and one private window), sign in on both, and mark different Pokémon in each.

### Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build → `dist/` |
| `npm run preview` | Serve the `dist/` build locally |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (sync merge, backup, filter and search, calculators) |
| `npm run generate-data` | Regenerate `public/data/pokemon.json` + `src/data/*.json` from PokéAPI, then validate |
| `npm run validate-data` | Sanity-check the generated data; exits non-zero on bad data |

CI (`.github/workflows/ci.yml`) runs lint, `tsc -b` and the tests on every push and pull request.

### Marking Pokémon

| Action | Quick mark **on** | Quick mark **off** |
|--------|-------------------|--------------------|
| Tap / click a cell or list row | Toggle caught | Open the detail panel |
| Double-click a cell | — | Toggle caught |
| Long-press (~0.5 s, touch) or right-click | Toggle pending | Toggle pending |
| List view checkboxes | Toggle caught / pending | Toggle caught / pending |
| `Shift+C` | Toggle caught on the selected Pokémon | Same |

Quick mark is the ⚡ button in the tracker filter bar. It defaults to on for touch screens (`pointer: coarse`) and off otherwise, and your choice is remembered per device. Shiny is toggled from the detail panel. Every change shows an **Undo** toast for 5 seconds.

### Search syntax

Terms are separated by spaces and must all match.

| Term | Matches |
|------|---------|
| `gengar` | Name contains "gengar" |
| `94`, `#094` | Dex number — the regional number when a regional dex is selected |
| `ghost` | Type |
| `caught:yes` / `caught:no` | Caught or not |
| `shiny:yes`, `pending:yes` | Marked shiny / pending (`:no` works too) |

Example: `ghost caught:no` lists the Ghost types you still need.

---

## Deploy to TrueNAS SCALE

The app ships as a single Docker image that includes both the web frontend and a lightweight sync server. Every push to `main` automatically builds and publishes a new `latest` image via GitHub Actions.

### Prerequisites
- TrueNAS SCALE 24.10 (Electric Eel) or later
- The "Apps" feature enabled

### Step 1 — Choose your credentials

Pick a username and password for the login screen, and generate a secret sync token:

```bash
# Generate a sync token (internal secret — users never see this)
openssl rand -hex 32
```

### Step 2 — Install the custom app

1. In TrueNAS, go to **Apps → Discover → Custom App**
2. Fill in the form:
   - **Application Name:** `pokedex-tracker`
   - **Image:** `ghcr.io/jabberwocky7777/pokedex-tracker`
   - **Tag:** `latest`
   - **Port:** Container port `80` → Host port `7777`
   - **Environment variables** (all three required):
     - `APP_USER` = *(your chosen username)*
     - `APP_PASSWORD` = *(your chosen password)*
     - `SYNC_TOKEN` = *(your generated token)*
     - `CORS_ORIGIN` = *(optional — extra origins allowed to call the sync API from another site, comma-separated. The app itself is served from the same origin and needs none; the iOS app's origin is always allowed)*
   - **Storage:** Add a host path volume — mount path `/data`
3. Click **Install**

### Step 3 — Access the app

Open your browser and navigate to:

```
http://YOUR_TRUENAS_IP:7777
```

You'll see a login screen — enter the `APP_USER` and `APP_PASSWORD` you set. The app remembers your session in the browser so you only need to log in once per device.

### Sync across devices

Once the app is running with a `SYNC_TOKEN` set, cross-device sync is automatic:
- **On page load, and whenever you come back to the tab** — syncs straight away
- **On every change** — syncs 2 seconds after the last change
- **Every 30 seconds** — polls for remote changes so if you catch something on your phone, your PC tab updates automatically without a reload
- A sync indicator in the header shows live status (syncing / synced / error)

Every sync is *pull, merge, push*: the app never overwrites the server with its own copy. Caught, pending and shiny marks are merged one Pokémon at a time — each mark and un-mark carries a timestamp and the newer one wins — so marking different Pokémon on two devices, even while one is offline, loses nothing. Designer slots, saved IV sessions and PC box layouts are last-write-wins per section. The server only stores the merged blob.

All devices need to be on a version with this merge logic. An older client (for example an iOS build that hasn't been updated) still pushes whole snapshots without timestamps; newer devices will merge what it sends, but un-marks made on the old client won't propagate.

To use sync on your phone, open the same URL in your phone's browser and log in with your `APP_USER` and `APP_PASSWORD`.

### Offline mode

The login screen always offers **Use offline**, including when the server is unreachable. In offline mode nothing leaves the device: data lives in browser storage (and iOS preferences in the app) and no sync requests are made. Settings → Sync shows which mode you're in. To start syncing later, choose **Sign in to sync** there — what's on the device is merged with what's on the server, and neither side is overwritten.

### Who the sync server is for

The sync server is meant for **one person or one household**:

- `SYNC_TOKEN` is a single shared secret. Logging in with `APP_USER` / `APP_PASSWORD` simply hands that token to the browser; every signed-in device holds the same one.
- There are no separate accounts. Everyone who signs in reads and writes the same Pokédex.
- Anyone holding the token can read and overwrite the synced data.

Don't share the login with people you wouldn't trust with all of that, and put the app behind HTTPS if you expose it outside your home network.

### Exposing to the internet (optional)

To access the app from outside your home network, put it behind HTTPS. Two easy options:

- **Cloudflare Tunnel** (recommended) — free, hides your home IP, no port forwarding needed. Install the Cloudflare Tunnel app on TrueNAS and point it at `http://localhost:7777`.
- **Cloudflare DNS proxy** — point your domain's A record at your home IP with the orange-cloud proxy enabled. Forward port 443 → 7777 on your router. Cloudflare handles TLS.

The app's pages and the Pokémon data file are public: anyone who finds the address can open the tracker in offline mode. Your own data is not — the sync API only answers requests that carry the token handed out by the login screen, and login attempts are rate-limited to 10 a minute per address.

### Updating to a new version

After pushing code changes to `main`, GitHub Actions rebuilds and pushes a new `latest` image automatically (takes ~3–5 minutes on first run, ~45 seconds with cache).

To update your TrueNAS installation:

1. Go to **Apps** in TrueNAS
2. Find **pokedex-tracker** → click the **⋮** menu → **Update** (or pull image)
3. The container restarts with the new image — your sync data in `/data` is preserved

---

## Regenerating Pokémon Data

The app ships with pre-generated data for all 493 Gen I–IV Pokémon in `public/data/pokemon.json`. To regenerate it:

```bash
npm run generate-data
```

The pipeline is one command with two steps:

1. **`scripts/fetch-data.ts`**
   - **Encounters** come from PokéAPI's CSV dump on GitHub at a **pinned commit**, so a re-run gives the same result until you choose to move the pin. The CSVs are cached under `node_modules/.cache/pokeapi-csv/<commit>/`.
   - **Species, stats, sprites, regional dexes and evolution chains** come from the live [PokéAPI](https://pokeapi.co/) (10 Pokémon per batch, 250 ms apart).
   - `overrides.json` is merged on top: static legendaries and roamers (requirements, event items), plus gifts PokéAPI lacks. Outbreaks, Poké Radar, Slot 2, honey trees, the Great Marsh, the Trophy Garden, fossils and in-game trades are **not** overridden — they come straight from PokéAPI.
   - Known-bad data (the encounter denylist, unreachable Altering Cave Pokémon) is stripped last, after overrides.
   - Writes `public/data/pokemon.json`, `src/data/boxes.json`, `src/data/meta.json` (which records `dataSource.pokeapiCommit` and `generatedAt`) and `scripts/data/override-provenance.json`.
2. **`scripts/validate-data.ts`** (also `npm run validate-data`) prints encounter counts by version and method and fails if it finds placeholder outbreak rows, a Kanto starter with a wild encounter in Diamond/Pearl/Platinum, HeartGold or SoulSilver without headbutt encounters, or an override that duplicates a PokéAPI row with different levels.

A full run takes about two minutes.

### Updating the pinned PokéAPI commit

1. Pick a newer commit from [PokeAPI/pokeapi](https://github.com/PokeAPI/pokeapi/commits/master) and put its full SHA in `POKEAPI_COMMIT` in `scripts/constants.ts`.
2. Run `npm run generate-data`.
3. Compare the per-version method counts that `validate-data` prints with the previous run and skim `git diff --stat`; investigate anything surprising before committing.
4. Commit `scripts/constants.ts`, `public/data/pokemon.json`, `src/data/meta.json` and `scripts/data/override-provenance.json` together.

> **Note:** Run this locally and commit the result. Do not run it inside Docker — the script writes files to disk and needs network access to GitHub and PokéAPI.

---

## Data Credits

Pokémon data is sourced from [PokéAPI](https://pokeapi.co/), which is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Pokémon and all related names are trademarks of Nintendo / Game Freak / Creatures Inc.

This project is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.

---

## License

MIT — see [LICENSE](LICENSE)
