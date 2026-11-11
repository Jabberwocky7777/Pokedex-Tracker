# Security policy

## Supported versions

Only the latest of each is maintained:

|              |                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker image | `ghcr.io/jabberwocky7777/pokedex-tracker:latest` (rebuilt on every push to `main`), and the newest release tag (`1.8`); `linux/amd64` and `arm64` |
| iOS app      | the version the AltStore / SideStore source offers                                                                                                |
| Web app      | whatever your instance serves — update the image                                                                                                  |

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's private reporting instead: the repository's **Security** tab → **Report a vulnerability**. Include what an attacker can do, how to reproduce it, and the image tag or app version.

Most relevant are problems in the sync server (`sync-server/server.js`), the nginx configuration (`deploy/nginx/`) and anything that would let a page or a save file run code or read the sync token.

## How the sync server is meant to be used

It's built for **one person or one household**: there is one login, no separate accounts, and anyone signed in can read and replace the synced data. Each sign-in is its own session that can be signed out from Settings; changing `SYNC_TOKEN` signs out every device (see [Rotating the token](../docs/self-hosting.md#rotating-the-token)). Put it behind HTTPS before exposing it to the internet. The login is rate-limited (10 attempts a minute per address) and locked for a while after 10 failures from anyone (see [Failed sign-ins](../docs/self-hosting.md#failed-sign-ins)). Settings left at their `.env.example` placeholders count as unset. These are design decisions rather than vulnerabilities, but reports about how they could be tightened without accounts are welcome.

### If a token leaks or a device is lost

Sign the device out under **Settings → Sync → Signed-in devices** on another device. If you don't know which device or token it was, change `SYNC_TOKEN` and restart: every device is signed out and signs in again with the password.

Save files are read entirely in the browser and never uploaded; please don't attach real saves or backups to a report.
