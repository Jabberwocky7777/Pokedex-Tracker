# Pokédex Tracker

A Gen III Pokémon collection tracker with a catch rate calculator, IV checker, learnset viewer, and route encounter browser. Built as a single-page React app with no account or server required — all data lives in your browser.

---

## Features

- **Tracker** — Box view and list view for all 386 Gen I–III Pokémon, with caught/pending toggles and progress bar
- **Game filtering** — Filter by Ruby, Sapphire, Emerald, FireRed, or LeafGreen (or any combination)
- **Availability modes** — Show all, obtainable only, or directly catchable only
- **Regional dex** — Switch between National, Hoenn, and Kanto dex numbering
- **Catch rate calculator** — Gen III/IV formula with all Poké Balls, status conditions, and HP modifiers
- **IV checker** — Multi-level stat entry, IV range narrowing, stat projections, nature support, and PC Box session saves
- **Pokédex tab** — Base stat bars, side-by-side comparisons, and full learnset viewer (level-up, TM/HM, egg moves, tutors) via PokéAPI
- **Route info** — Browse encounter tables by location, version, and method
- **Dark mode** — Enabled by default, no flash on load
- **Zero server** — All persistence is browser `localStorage`; no login, no cloud

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

The app ships as a Docker image hosted on GitHub Container Registry. Every push to `main` automatically builds and publishes a new `latest` image via GitHub Actions.

### Prerequisites
- TrueNAS SCALE 24.10 (Electric Eel) or later
- The "Apps" feature enabled (Settings → Apps → Enable)

### Step 1 — Install the custom app

1. In TrueNAS, go to **Apps → Discover**
2. Click **Custom App** (or "Install via YAML" depending on your version)
3. Paste the following YAML:

```yaml
services:
  pokedex-tracker:
    image: ghcr.io/jabberwocky7777/pokedex-tracker:latest
    container_name: pokedex-tracker
    restart: unless-stopped
    ports:
      - "7777:80"
```

4. Click **Install** / **Deploy**

### Step 2 — Access the app

Open your browser and go to:

```
http://YOUR_TRUENAS_IP:7777
```

### Updating to a new version

After pushing code changes to `main`, GitHub Actions will rebuild and push a new `latest` image automatically (takes ~3–5 minutes on first run, ~45 seconds with cache).

To update your TrueNAS installation:

1. Go to **Apps** in TrueNAS
2. Find **pokedex-tracker** → click the **⋮** menu → **Update** (or pull image)
3. The container restarts with the new image — your localStorage data is unaffected

---

## Regenerating Pokémon Data

The app ships with pre-generated data for all 386 Gen I–III Pokémon in `public/data/pokemon.json`. To regenerate from [PokéAPI](https://pokeapi.co/):

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
