# Self-hosting

The app ships as one Docker image (`ghcr.io/jabberwocky7777/pokedex-tracker`) with the web app and the sync server inside: nginx serves the app on port 80 and proxies `/api` to the sync server, which keeps its data in `/data`. Every push to `main` publishes a new `latest`.

How sync behaves once it is running is in [sync.md](sync.md).

## Docker Compose

From a clone of the repository:

```bash
cp .env.example .env          # then set APP_USER, APP_PASSWORD and SYNC_TOKEN
docker compose -f deploy/docker-compose.yml up -d
```

The app is then on port 7777. `docker compose -f deploy/docker-compose.yml build` builds the image from your checkout instead of pulling it. The files the image is made of are in [`deploy/`](../deploy).

**Link previews and search engines.** A build only knows its public address if you give it one: `docker build -f deploy/Dockerfile --build-arg SITE_URL=https://pokedex.example.com .` (or `args: { SITE_URL: … }` under `build:` in the compose file). With it, shared links get a preview image and `robots.txt` lets search engines in, with a sitemap; without it there are no absolute preview URLs and `robots.txt` asks crawlers to stay out — right for a private instance. The published `ghcr.io` image is built for `https://pokedex.shrumslab.com`.

**Inside the container** nginx serves the app and the sync server listens on `127.0.0.1:3001` only, as the unprivileged `node` user; on start the entrypoint hands `/data` to that user. If your volume doesn't allow that (some host paths and network shares), the log says so and the server runs as root instead, as older images did.

| Variable | |
|---|---|
| `APP_USER`, `APP_PASSWORD` | The login screen's username and password |
| `SYNC_TOKEN` | The sync API secret, handed to each device that signs in. Generate with `openssl rand -hex 32` |
| `CORS_ORIGIN` | Optional. Extra origins allowed to call the API from another site, comma-separated. The app itself and the iOS app need none |
| `TRUSTED_PROXIES` | Optional. Reverse proxies whose `X-Forwarded-For` is trusted — see [Rate limits behind a proxy](#exposing-to-the-internet-optional) |

## TrueNAS SCALE

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

## Who the sync server is for

The sync server is meant for **one person or one household**:

- `SYNC_TOKEN` is a single shared secret. Logging in with `APP_USER` / `APP_PASSWORD` simply hands that token to the browser; every signed-in device holds the same one.
- There are no separate accounts. Everyone who signs in reads and writes the same Pokédex.
- Anyone holding the token can read and overwrite the synced data.

Don't share the login with people you wouldn't trust with all of that, and put the app behind HTTPS if you expose it outside your home network.

## Exposing to the internet (optional)

To access the app from outside your home network, put it behind HTTPS. Two easy options:

- **Cloudflare Tunnel** (recommended) — free, hides your home IP, no port forwarding needed. Install the Cloudflare Tunnel app on TrueNAS and point it at `http://localhost:7777`.
- **Cloudflare DNS proxy** — point your domain's A record at your home IP with the orange-cloud proxy enabled. Forward port 443 → 7777 on your router. Cloudflare handles TLS.

The app's pages and the Pokémon data file are public: anyone who finds the address can open the tracker in offline mode. Your own data is not — the sync API only answers requests that carry the token handed out by the login screen, and login attempts are rate-limited to 10 a minute per address.

**Rate limits behind a proxy.** Behind a tunnel or reverse proxy, every request reaches the container from the proxy's address. The container therefore takes the visitor's address from the `X-Forwarded-For` header when the connection comes from a *trusted proxy* — otherwise all visitors would share one rate-limit bucket, and anyone guessing passwords would lock you out of signing in.

- **Default:** loopback and the private ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`). A proxy on the same machine or the same LAN (Cloudflare Tunnel, Nginx Proxy Manager, Traefik) works with no configuration.
- **`TRUSTED_PROXIES`** replaces the default: a comma-separated list of addresses or CIDR ranges, e.g. `TRUSTED_PROXIES=192.168.1.10`. Set it to `none` to trust nothing, which is right when no proxy is in front.
- The default means a device on your own network that connects straight to port 7777 could send the header itself and dodge the login limit. If you'd rather close that, set `TRUSTED_PROXIES` to your proxy's address only.
- The proxy has to send `X-Forwarded-For` (the ones above do). The visitor's address is the last one in the header that isn't a trusted proxy, so a visitor can't choose their own by adding the header.

**Content-Security-Policy.** The container sends a policy that only lets the page run its own scripts and talk to its own server, and the sprite hosts (`raw.githubusercontent.com`, `play.pokemonshowdown.com`); fonts are served by the container itself. If your proxy adds a policy of its own, both apply and the stricter one wins.

## Updating to a new version

After pushing code changes to `main`, GitHub Actions rebuilds and pushes a new `latest` image automatically (takes ~3–5 minutes on first run, ~45 seconds with cache).

To update your TrueNAS installation:

1. Go to **Apps** in TrueNAS
2. Find **pokedex-tracker** → click the **⋮** menu → **Update** (or pull image)
3. The container restarts with the new image — your sync data in `/data` is preserved
