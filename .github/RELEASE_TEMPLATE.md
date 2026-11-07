<!--
Release notes template. You don't fill this in by hand: write the version's
section in CHANGELOG.md, and `npm run release:notes -- <version>` (which the
release workflow runs) turns it into notes of this shape:

- the section's opening paragraph → Highlights
- its ### Added / Changed / Fixed / Removed / Security headings → ## headings
- an optional ### Upgrade notes → under Install / upgrade below

Everything from "## Install / upgrade" down is copied into every release;
{{VERSION}} and {{UPGRADE_NOTES}} are filled in.
-->

## Highlights

One or two sentences on what this release is about.

## Added

- New things people can do

## Changed

- Existing things that work differently

## Fixed

- Bugs that are gone

## Install / upgrade

{{UPGRADE_NOTES}}

- **iPhone / iPad (AltStore or SideStore):** the source `https://jabberwocky7777.github.io/Pokedex-Tracker/apps.json` offers {{VERSION}} as an update within a few minutes of this release; or install the `PokedexTracker.ipa` below by hand.
- **Docker:** `docker compose -f deploy/docker-compose.yml pull && docker compose -f deploy/docker-compose.yml up -d` (the image is `ghcr.io/jabberwocky7777/pokedex-tracker:latest`); on TrueNAS SCALE, **Update** the app. Sync data in `/data` is kept.
- **Web app:** an open tab updates itself the next time it is in the background or reopened.
- **Static files:** `pokedex-tracker-web-v{{VERSION}}.zip` is the built web app for any static host — sync needs the server in the Docker image.
