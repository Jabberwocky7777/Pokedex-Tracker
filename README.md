# Pokédex Tracker

A Gen III–IV Pokémon collection tracker with cross-device sync, save-file import, a catch rate calculator, team designer with IV checker, damage calculator, learnset viewer, and route encounter browser. Built as a single-page React app — all data lives in your browser, with optional self-hosted sync.

---

## Features

- **Tracker** — Box view and list view for all 493 Gen I–IV Pokémon, with caught/pending/shiny marks and a progress bar that expands into a per-game and per-dex breakdown
- **Quick mark and touch gestures** — With **Quick mark** on (the default on touch screens) a single tap marks a Pokémon caught; long-press (or right-click) marks it pending. With it off, a tap opens details and a double-click marks caught. See [Marking Pokémon](#marking-pokémon)
- **Undo** — Every caught, pending or shiny change shows an Undo button for 5 seconds; so does clearing a whole generation from Settings
- **Change log** — The **Changes** button lists what each save import, clear and run of hand-made marks changed, Pokémon by Pokémon ("Pending → Caught"), and lets you undo a whole entry or a single Pokémon later on — and redo it. Kept on the device (the last 100 entries); changes that arrive from another device by sync aren't listed
- **Search** — By name, dex number (`94`, `#094`), type (`ghost`), or `caught:no` / `shiny:yes` / `pending:yes`. See [Search syntax](#search-syntax)
- **What can I get next** — A tracker view (the **What's next** button) that ranks locations in your selected games by how many uncaught Pokémon are found there, grouped by encounter method
- **Evolution reminders** — When a caught Pokémon has an evolution you haven't caught, its detail panel says how it evolves and flags trade evolutions
- **Game filtering** — Filter by Ruby, Sapphire, Emerald, FireRed, LeafGreen, Diamond, Pearl, Platinum, HG/SS, or any combination
- **Availability modes** — Show all, obtainable only, directly catchable only, or only what needs attention; the (?) button next to the filter explains each
- **Offline mode** — "Use offline" on the login screen keeps everything on the device with no server; sign in later from Settings and the two copies are merged
- **Regional dex** — Switch between National and the game's own dex numbering (Hoenn, Kanto, Sinnoh for Diamond/Pearl, Sinnoh for Platinum, Johto for HG/SS)
- **Save import** — Read a `.sav` from Ruby, Sapphire, Emerald, FireRed, LeafGreen, Diamond, Pearl, Platinum, HeartGold or SoulSilver in the browser (the file is never uploaded): browse the boxes, review proposed caught/shiny marks before applying them, keep a living dex with a to-do list and transfer plan, search every Pokémon across saves, and see what changed since the last import
- **Gen III/IV data throughout** — Types, base stats, abilities and move power/accuracy/PP are shown as they were in the selected game, not as later games changed them
- **Catch rate calculator** — Gen III/IV formula with all Poké Balls (situational ones such as Dive, Repeat, Nest, Timer and Quick Ball take their conditions into account), status conditions, and HP modifiers
- **Designer** — IV range narrowing, stat projections, nature support, EV planning, PC Box slot management, and a move picker
- **Pokédex tab** — Base stat bars, side-by-side comparisons, full learnset viewer (level-up, TM/HM, egg moves, tutors), and a "Where to Find" encounter table with clickable route links
- **Attackdex** — Full move browser: search any move to see its type, power, accuracy, PP, effect, and which Pokémon learn it
- **Route info** — Search locations and browse their encounter tables by version and method, including time-of-day encounter differences (morning/day/night) for HGSS
- **Evolution item shopping list** — the **Items** button lists what you need to evolve the Pokémon you have caught into the ones you haven't ("2 Dawn Stones, 1 Razor Claw, 1 Metal Coat (trade)"), which Pokémon each item is for, and where to get it in the selected games
- **Progress over time** — the **Progress** button charts what you have caught against the date you marked it, for the generation or one regional dex, with milestones ("100th catch", "DP Pokédex complete") and a this-week count. It reads the timestamps the tracker already keeps, so un-marking a Pokémon and marking it again loses the earlier date
- **Available right now** — a **Right now** availability filter, and a toggle on What's next, that use your device's clock: Gen IV morning / day / night encounters and weekday events (Drifloon and Lapras on Fridays, the Bug-Catching Contest on Tuesdays, Thursdays and Saturdays). It assumes the game's clock is set like your device's
- **Breeding helper** — each Pokémon's detail panel and Pokédex page say its egg group and gender ratio, what its egg hatches into (incense babies included), and whether you can breed it now from what you've caught, with which partner or Ditto. In the Designer, the **Egg move finder** lists which Pokémon can pass a chosen egg move down, through chains of fathers where needed, with the ones you've caught first
- **Roaming legendary tracker** — the Daily view has a **Roaming legendaries** tab for the selected games (Latios and Latias, the legendary beasts, Mesprit and Cresselia, Platinum's birds): what unlocks each, whether you've met it (which puts it on the map) or caught it, and the usual tips. The met status syncs
- **Trade session** — in Saves, the **Trade** panel pairs two imported saves (or two games, or one of each) and gives one checklist of what to send each way: version exclusives (★), spares the other side lacks, and trade evolutions to send over and back
- **Notes** — a free-text note on any Pokémon, in the tracker's detail panel and the Pokédex, kept per generation. Notes sync, and merge note by note: editing different Pokémon on two devices loses nothing
- **Shiny hunt counter** — the **Shiny hunts** button keeps a counter per hunt (Pokémon and method: random encounters, soft resets, Masuda method, Poké Radar chain, fishing) with big +1 / −1 buttons and the Gen III/IV odds for that method. **Found it** marks the Pokémon shiny in the tracker. Hunts sync
- **Shareable progress card** — in Progress, **Create image** draws a picture of your completion per dex and the sprites of everything you've caught. It is made in your browser and never uploaded; save it with **Download** or send it through your device's share sheet
- **Everything links** — a Pokémon, route or move named anywhere opens in its own tab: locations in the tracker and Pokédex open in Routes, moves open in the Attackdex, TM/HM locations and daily-checklist places link to their area, and Pokémon in the Saves to-do list, plan and history open the tracker's detail panel
- **Cross-device sync** — Optional self-hosted sync server (included in the Docker image) keeps progress in sync between PC and phone; polls every 30 s so changes appear automatically without a page reload, and merges changes entry by entry so two devices can't erase each other's marks
- **Trainer lookup** — Browse Battle Tower trainer teams by category, with full Pokémon sets, held items, moves and stats at that trainer's IVs; send any Pokémon directly to the damage calculator. All 950 sets come from the game's own data
- **Damage calculator** — Gen IV damage formula with two Pokémon slots, weather (including sandstorm and hail chip damage), Reflect/Light Screen, Stealth Rock and Spikes, abilities, items, singles or doubles, and move-by-move damage ranges with KO chances
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
| `npm test` | Vitest unit tests (sync merge, backup, filter and search, calculators, save import) |
| `npm run generate-data` | Regenerate `public/data/pokemon.json` + `src/data/*.json` from PokéAPI, then validate |
| `npm run validate-data` | Sanity-check the generated data; exits non-zero on bad data |
| `npm run generate-moves` | Regenerate only `public/data/moves.json` and `learnsets.json` (no live API needed) |
| `npm run generate-save-tables` | Regenerate the lookup tables the save importer uses (`src/data/save-tables.json`) |
| `npm run e2e` | Build, then click through the app's cross-tab links in a real browser (needs Chrome or Edge; uses ports 4174 and 3001) |
| `npm run fetch-battle-tower` | Regenerate the 950 Battle Tower sets (`src/data/battle-tower-sets.json`) from the pret/pokeplatinum decompilation |

CI (`.github/workflows/ci.yml`) runs lint, `tsc -b` and the tests on every push and pull request.

### Marking Pokémon

| Action | Quick mark **on** | Quick mark **off** |
|--------|-------------------|--------------------|
| Tap / click a cell or list row | Toggle caught | Open the detail panel |
| Double-click a cell | — | Toggle caught |
| Long-press (~0.5 s, touch) or right-click | Toggle pending | Toggle pending |
| List view checkboxes | Toggle caught / pending | Toggle caught / pending |
| `Shift+C` (tracker tab) | Toggle caught on the selected Pokémon | Same |
| `Space` / `Enter` on a focused list checkbox | Toggle it | Same |

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
     - `TRUSTED_PROXIES` = *(optional — only matters behind a reverse proxy; see "Exposing to the internet")*
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

Every sync is *pull, merge, push*: the app never overwrites the server with its own copy. Caught, pending and shiny marks are merged one Pokémon at a time — each mark and un-mark carries a timestamp and the newer one wins — so marking different Pokémon on two devices, even while one is offline, loses nothing. Designer slots, saved IV sessions and PC box layouts are last-write-wins per section — the device that changed that section most recently wins, going by each device's own clock. Imported saves are merged per save, so two devices can each import a different one. The server only stores the merged blob.

All devices need to be on a version with this merge logic. An older client (for example an iOS build that hasn't been updated) still pushes whole snapshots without timestamps; newer devices will merge what it sends, but un-marks made on the old client won't propagate.

**Server snapshots.** Before a sync replaces the copy on the server, the server keeps the old one in `/data/snapshots`: one an hour for the last 24 hours, then one a day for 30 days (older ones are deleted). If something goes wrong — a "clear" you regret on another device, say — open **Settings → Sync → Server snapshots**, pick a time and restore it. The restore is checked like a backup file, replaces what's on that device, and then syncs to the others.

To use sync on your phone, open the same URL in your phone's browser and log in with your `APP_USER` and `APP_PASSWORD`.

### Offline mode

**Works without a connection.** In a browser the app installs a service worker the first time it loads. After that the app itself, the Pokédex data, moves and learnsets open with no network at all — on a phone with no signal, or when the server is down — and the sprites you have already seen are kept too. Changes made offline are stored on the device and sync the next time the server is reachable. A new version is picked up automatically the next time the app is opened online. Use your browser's **Add to Home Screen** / **Install app** to get it as an icon that opens full-screen. (Trainer portraits in Trainer Lookup come from Pokémon Showdown and need a connection.)

The login screen always offers **Use offline**, including when the server is unreachable. In offline mode nothing leaves the device: data lives in browser storage and no sync requests are made. On the iOS app that storage can be cleared when the app is updated through AltStore/SideStore, and only the sign-in details are kept in a second place — so on iOS, sign in to sync if the data matters. Settings → Sync shows which mode you're in. To start syncing later, choose **Sign in to sync** there — what's on the device is merged with what's on the server, and neither side is overwritten.

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

**Rate limits behind a proxy.** Behind a tunnel or reverse proxy, every request reaches the container from the proxy's address. The container therefore takes the visitor's address from the `X-Forwarded-For` header when the connection comes from a *trusted proxy* — otherwise all visitors would share one rate-limit bucket, and anyone guessing passwords would lock you out of signing in.

- **Default:** loopback and the private ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`). A proxy on the same machine or the same LAN (Cloudflare Tunnel, Nginx Proxy Manager, Traefik) works with no configuration.
- **`TRUSTED_PROXIES`** replaces the default: a comma-separated list of addresses or CIDR ranges, e.g. `TRUSTED_PROXIES=192.168.1.10`. Set it to `none` to trust nothing, which is right when no proxy is in front.
- The default means a device on your own network that connects straight to port 7777 could send the header itself and dodge the login limit. If you'd rather close that, set `TRUSTED_PROXIES` to your proxy's address only.
- The proxy has to send `X-Forwarded-For` (the ones above do). The visitor's address is the last one in the header that isn't a trusted proxy, so a visitor can't choose their own by adding the header.

**Content-Security-Policy.** The container sends a policy that only lets the page run its own scripts and talk to its own server, the sprite hosts (`raw.githubusercontent.com`, `play.pokemonshowdown.com`) and Google Fonts. If your proxy adds a policy of its own, both apply and the stricter one wins.

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
   - **Moves and learnsets** (`public/data/moves.json`, `public/data/learnsets.json`) come from the same pinned CSV dump: every Gen I–IV move as it was in each Gen III/IV game, and every Pokémon's learnset per version group. The app loads the two files the first time a move list is opened and never asks PokéAPI for anything while it runs. `npm run generate-moves` rebuilds just these two.
   - **Encounters** come from PokéAPI's CSV dump on GitHub at a **pinned commit**, so a re-run gives the same result until you choose to move the pin. The CSVs are cached under `node_modules/.cache/pokeapi-csv/<commit>/`.
   - **Species, stats, sprites, regional dexes and evolution chains** come from the live [PokéAPI](https://pokeapi.co/) (10 Pokémon per batch, 250 ms apart). Types, base stats and abilities are taken as of Generation IV (PokéAPI's past-generation data), hidden abilities are left out, and evolutions into Pokémon after #493 are dropped. If any request fails, the run fails.
   - `overrides.json` is merged on top: static legendaries and roamers (requirements, event items), plus gifts PokéAPI lacks. Outbreaks, Poké Radar, Slot 2, honey trees, the Great Marsh, the Trophy Garden, fossils and in-game trades are **not** overridden — they come straight from PokéAPI.
   - Known-bad data (the encounter denylist, unreachable Altering Cave Pokémon) is stripped last, after overrides.
   - Writes `public/data/pokemon.json`, `src/data/boxes.json`, `src/data/meta.json` (which records `dataSource.pokeapiCommit` and `generatedAt`) and `scripts/data/override-provenance.json`.
2. **`scripts/validate-data.ts`** (also `npm run validate-data`) prints encounter counts by version and method and fails if there aren't exactly 493 Pokémon, if a type, stat or ability is from a later generation, or if it finds placeholder outbreak rows, a Kanto starter with a wild encounter in Diamond/Pearl/Platinum, HeartGold or SoulSilver without headbutt encounters, or an override that duplicates a PokéAPI row with different levels.

A full run takes about two minutes.

### Updating the pinned PokéAPI commit

1. Pick a newer commit from [PokeAPI/pokeapi](https://github.com/PokeAPI/pokeapi/commits/master) and put its full SHA in `POKEAPI_COMMIT` in `scripts/constants.ts`.
2. Run `npm run generate-data`.
3. Compare the per-version method counts that `validate-data` prints with the previous run and skim `git diff --stat`; investigate anything surprising before committing.
4. Commit `scripts/constants.ts`, `public/data/pokemon.json`, `public/data/moves.json`, `public/data/learnsets.json`, `src/data/meta.json` and `scripts/data/override-provenance.json` together.

> **Note:** Run this locally and commit the result. Do not run it inside Docker — the script writes files to disk and needs network access to GitHub and PokéAPI.

---

## Data Credits

Pokémon data is sourced from [PokéAPI](https://pokeapi.co/), which is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Pokémon and all related names are trademarks of Nintendo / Game Freak / Creatures Inc.

This project is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.

---

## License

MIT — see [LICENSE](LICENSE)
