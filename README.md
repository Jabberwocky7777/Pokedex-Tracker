# Pokédex Tracker

A Gen III–IV Pokémon collection tracker with cross-device sync, a catch rate calculator, IV checker, learnset viewer, and route encounter browser. Built as a single-page React app — all data lives in your browser, with optional self-hosted sync.

---

## Features

- **Tracker** — Box view and list view for all 493 Gen I–IV Pokémon, with caught/pending toggles and progress bar
- **Game filtering** — Filter by Ruby, Sapphire, Emerald, FireRed, LeafGreen, Diamond, Pearl, Platinum, HG/SS, or any combination
- **Availability modes** — Show all, obtainable only, or directly catchable only
- **Regional dex** — Switch between National, Hoenn, and Kanto dex numbering
- **Catch rate calculator** — Gen III/IV formula with all Poké Balls, status conditions, and HP modifiers
- **IV checker** — Multi-level stat entry, IV range narrowing, stat projections, nature support, and PC Box session saves
- **Pokédex tab** — Base stat bars, side-by-side comparisons, and full learnset viewer (level-up, TM/HM, egg moves, tutors) via PokéAPI for both Gen III and Gen IV games
- **Route info** — Browse encounter tables by location, version, and method
- **Cross-device sync** — Optional self-hosted sync server (included in the Docker image) keeps progress in sync between PC and phone
- **Dark mode** — Enabled by default, no flash on load

---

## Tech Stack

| Tool | Version |
|------|---------|
| React | 19.x |
| TypeScript | 6.x |
| Zustand | 5.x (with `persist` middleware) |
| Tailwind CSS | 4.x (via `@tailwindcss/vite`) |
| Vite | 8.x |

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

### Step 1 — Generate your secrets

```bash
# Sync token (protects the API)
openssl rand -hex 32

# Pick a username and strong password for the login prompt
# e.g. username: brend   password: another openssl rand -hex 16
```

### Step 2 — Install the custom app

1. In TrueNAS, go to **Apps → Discover → Custom App**
2. Fill in the form:
   - **Application Name:** `pokedex-tracker`
   - **Image:** `ghcr.io/jabberwocky7777/pokedex-tracker`
   - **Tag:** `latest`
   - **Port:** Container port `80` → Host port `7777`
   - **Environment variables** (all three required):
     - `SYNC_TOKEN` = *(your generated token)*
     - `NGINX_USER` = *(your chosen username)*
     - `NGINX_PASSWORD` = *(your chosen password)*
   - **Storage:** Add a host path volume — mount path `/data`
3. Click **Install**

### Step 3 — Access the app

Open your browser and navigate to:

```
http://YOUR_TRUENAS_IP:7777
```

Your browser will show a login prompt — enter the `NGINX_USER` and `NGINX_PASSWORD` you set. This is what keeps the site private when exposed to the internet.

### Sync across devices

Once the app is running with a `SYNC_TOKEN` set, cross-device sync is automatic:
- On every page load the app pulls the latest snapshot from the server
- After any catch/release, the app pushes an update (debounced 2 s)
- A sync indicator appears in the header showing sync status

To use sync on your phone, just open the same URL on your phone's browser.

> **No token set?** Sync is silently disabled — the app works exactly as before, with data in browser localStorage only.

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
