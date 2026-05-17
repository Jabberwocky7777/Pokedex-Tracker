# Pokédex Tracker

A Gen III–IV Pokémon collection tracker with cross-device sync, a catch rate calculator, IV checker, learnset viewer, and route encounter browser. Built as a single-page React app — all data lives in your browser, with optional self-hosted sync.

---

## Features

- **Tracker** — Box view and list view for all 493 Gen I–IV Pokémon, with caught/pending toggles and progress bar
- **Game filtering** — Filter by Ruby, Sapphire, Emerald, FireRed, LeafGreen, Diamond, Pearl, Platinum, HG/SS, or any combination
- **Availability modes** — Show all, obtainable only, or directly catchable only
- **Regional dex** — Switch between National, Hoenn, and Kanto dex numbering
- **Catch rate calculator** — Gen III/IV formula with all Poké Balls, status conditions, and HP modifiers
- **Designer** — IV range narrowing, stat projections, nature support, EV planning, PC Box slot management, and move picker via PokéAPI
- **Pokédex tab** — Base stat bars, side-by-side comparisons, full learnset viewer (level-up, TM/HM, egg moves, tutors) via PokéAPI, and a "Where to Find" encounter table with clickable route links
- **Attackdex** — Full move browser: search any move to see its type, power, accuracy, PP, effect, and which Pokémon learn it
- **Route info** — Browse encounter tables by location, version, and method, including time-of-day encounter differences (morning/day/night) for HGSS
- **Cross-device sync** — Optional self-hosted sync server (included in the Docker image) keeps progress in sync between PC and phone; polls every 30 s so changes appear automatically without a page reload
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

1. Create `public/env.js` (gitignored — do not commit):
   ```js
   window.__ENV__ = { SYNC_TOKEN: "dev-token" };
   ```
2. In one terminal: `SYNC_TOKEN=dev-token DATA_DIR=./data node sync-server/server.js`
3. In another terminal: `npm run dev`

Vite proxies `/api/*` to `localhost:3001` automatically.

### Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build → `dist/` |
| `npm run preview` | Serve the `dist/` build locally |
| `npm run lint` | ESLint |
| `npm run generate-data` | Fetch fresh data from PokéAPI → `public/data/pokemon.json` + `src/data/*.json` |

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
     - `CORS_ORIGIN` = *(optional — restrict CORS to your app's origin, e.g. `http://192.168.1.50:7777`; defaults to `*` if unset)*
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
- **On page load** — pulls the latest snapshot from the server
- **On every change** — pushes an update 2 seconds after the last catch/release
- **Every 30 seconds** — polls for remote changes so if you catch something on your phone, your PC tab updates automatically without a reload
- A sync indicator in the header shows live status (syncing / synced / error)

To use sync on your phone, open the same URL in your phone's browser and log in with your `APP_USER` and `APP_PASSWORD`.

> **No token set?** Sync is silently disabled — the app works exactly as before, with data in browser localStorage only.

### Exposing to the internet (optional)

To access the app from outside your home network, put it behind HTTPS. Two easy options:

- **Cloudflare Tunnel** (recommended) — free, hides your home IP, no port forwarding needed. Install the Cloudflare Tunnel app on TrueNAS and point it at `http://localhost:7777`.
- **Cloudflare DNS proxy** — point your domain's A record at your home IP with the orange-cloud proxy enabled. Forward port 443 → 7777 on your router. Cloudflare handles TLS.

The nginx Basic Auth login prompt (`NGINX_USER` / `NGINX_PASSWORD`) protects the site from random visitors — they can't reach the sync API or see any data without your credentials.

### Updating to a new version

After pushing code changes to `main`, GitHub Actions rebuilds and pushes a new `latest` image automatically (takes ~3–5 minutes on first run, ~45 seconds with cache).

To update your TrueNAS installation:

1. Go to **Apps** in TrueNAS
2. Find **pokedex-tracker** → click the **⋮** menu → **Update** (or pull image)
3. The container restarts with the new image — your sync data in `/data` is preserved

---

## Regenerating Pokémon Data

The app ships with pre-generated data for all 493 Gen I–IV Pokémon in `public/data/pokemon.json`. To regenerate from [PokéAPI](https://pokeapi.co/):

```bash
npm run generate-data
```

This fetches encounters, evolution chains, regional dex entries, catch rates, and base stats. The script batches 10 Pokémon per request with a 250ms delay to respect PokéAPI rate limits. A full run takes **3–5 minutes**.

> **Note:** Run this locally and commit the updated `public/data/pokemon.json`. Do not run it inside Docker — the script writes files to disk and needs network access to PokéAPI.

---

## Data Credits

Pokémon data is sourced from [PokéAPI](https://pokeapi.co/), which is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Pokémon and all related names are trademarks of Nintendo / Game Freak / Creatures Inc.

This project is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.

---

## License

MIT — see [LICENSE](LICENSE)
