# Security policy

## Supported versions

Only the latest of each is maintained:

| | |
|---|---|
| Docker image | `ghcr.io/jabberwocky7777/pokedex-tracker:latest` (rebuilt on every push to `main`) |
| iOS app | the version the AltStore / SideStore source offers |
| Web app | whatever your instance serves — update the image |

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's private reporting instead: the repository's **Security** tab → **Report a vulnerability**. Include what an attacker can do, how to reproduce it, and the image tag or app version.

Most relevant are problems in the sync server (`sync-server/server.js`), the nginx configuration (`deploy/nginx/`) and anything that would let a page or a save file run code or read the sync token.

## How the sync server is meant to be used

It's built for **one person or one household**: there is a single shared sync token, no separate accounts, and anyone signed in can read and replace the synced data. Put it behind HTTPS before exposing it to the internet. The login is rate-limited (10 attempts a minute per address) — see [docs/self-hosting.md](../docs/self-hosting.md) for running it behind a proxy. These are design decisions rather than vulnerabilities, but reports about how they could be tightened without accounts are welcome.

Save files are read entirely in the browser and never uploaded; please don't attach real saves or backups to a report.
