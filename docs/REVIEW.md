# Pokédex Tracker — review (2026-10-25)

Reviewed at commit `b57830c` (main). Phase 1 is report-only: nothing in the
codebase was changed to produce this file. `AUDIT.md` (2026-10-10 → 10-14) was
read first; anything it already fixed or deliberately skipped is not repeated
here unless the situation has changed. Every finding below was traced in the
code; **Verified** means I also ran something to confirm it.

Contents: [Baseline](#baseline) · [Summary](#summary) · [Critical](#critical) ·
[High](#high) · [Phase 4 fixes](#phase-4--fixes-2026-10-25) · [Medium](#medium) · [Low](#low) · [Nitpick](#nitpick) ·
[Tests](#tests) · [Dependencies](#dependency-health) ·
[Phase 2 — folder layout proposal](#phase-2--folder-layout-proposal) ·
[Phase 3 — GitHub presentation checklist](#phase-3--github-presentation-checklist)

---

## Baseline

| Check | Result |
|---|---|
| `npm run lint` | clean (0 errors, 0 warnings) |
| `npx tsc -b` | clean |
| `npx tsc -p tsconfig.app.json --noEmit --strict` | clean (TS 6 already defaults to `strict`) |
| `npx tsc -p tsconfig.scripts.json` | **1 error** — `TS5101: Option 'baseUrl' is deprecated`, which stopped the check there (see M4). Not run by CI. With `baseUrl` removed in Phase 2, **3 real type errors** appear |
| `npm test` | Vitest: 38 files, **455 passed, 1 skipped** (`real-save.test.ts` needs a private fixture). Sync server: 15/15 passed |
| `npm run build` | OK in ~1 s. Main chunk `index-*.js` 401 kB (121 kB gzip), CSS 89 kB; no chunk-size warning. Service worker precaches **72 entries / 7.2 MB** |
| `dist/index.html` modulepreloads | none for `save-tables` / `parse` / `move-names` ✔ (CLAUDE.md rule holds) |
| `npm audit` (app, all deps) | **18 vulnerabilities: 2 critical, 10 high, 4 moderate, 2 low** — all in dev tooling (see Dependencies) |
| `npm audit --omit=dev` (app) | 0 |
| `npm audit` (sync-server) | **1 high: body-parser** — this is what fails CI (H1) |
| `npm outdated` | only patch/minor bumps (React 19.3.1, Vite 8.3.5, Vitest 5.0.5, Zustand 5.0.16, …); TypeScript 7.0.2 held back on purpose |
| `npx knip` | 20 unused exports, 68 unused exported types, unlisted `sharp`; details under Nitpick |
| `docker compose build` | **not run** — Docker is not installed on this machine, and `docker-compose.yml` has no `build:` section anyway (M9) |

## Summary

| Severity | Count | Themes |
|---|---|---|
| Critical | 0 | — |
| High | 4 — **all fixed** (Phase 4) | CI red because of a sync-server dependency; images ship from red commits; login rate limit can be bypassed; sync trusts the server copy blindly |
| Medium | 11 | Server reachable around nginx; clock skew decides merges; full-blob polling; scripts and JS not type-checked/linted; dev-dependency vulnerabilities; build hygiene; overrides silently optional |
| Low | 13 | Snapshot granularity, CI duplication, hard-coded domain, Pages publishing the repo root, CSV formula injection, … |
| Nitpick | 10 | Unused exports, naming, pins |

---

## Critical

None found. No path loses synced data or exposes it without the token.

---

## High

### H1. CI has been red for the last 5 commits: high-severity `body-parser` advisory in the sync server — **Verified** — `fixed`
- **Where:** `sync-server/package-lock.json` (`body-parser` 2.0.0–2.3.0, pulled in by `express` ^5.3.0); failing step `ci.yml:45-48`.
- **What:** `npm audit --omit=dev --audit-level=high --prefix sync-server` reports GHSA-27r3-jxmh-p828 (DoS via trailing bytes after a compressed request body). The CI log for run 40061973661 ends with `1 high severity vulnerability … exit code 1`. Every CI run since `842d972` (2026-10-24 02:32) failed on this step only; lint, tsc, tests and build pass.
- **Why it matters:** this is the sync server that ships in the image. `express.json()` inflates gzip/deflate bodies, so an unauthenticated POST can hit it (body parsing runs before `requireAuth`). The entrypoint's restart loop limits the damage, but it is a remotely triggerable crash/hang, and a permanently red CI hides the next real failure.
- **Fix:** `npm audit fix --prefix sync-server` (stays inside `express@^5`, lockfile-only change), commit `sync-server/package-lock.json`. Optionally also set `express.json({ inflate: false })` — no client sends compressed bodies.

### H2. The Docker image is published from commits whose CI failed — `fixed`
- **Where:** `.github/workflows/build-and-push.yml:3-7` (runs on every push to `main`, independent of `ci.yml`).
- **What:** the five commits above all pushed `ghcr.io/…:latest` while CI was red. Nothing gates the publish on lint/tests/audit.
- **Why it matters:** the TrueNAS deployment follows `latest`; a commit that breaks tests (or, as now, ships a vulnerable dependency) goes to the server on the next update.
- **Fix:** move the publish into `ci.yml` as a third job with `needs: check` and `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` (the existing `docker` job already covers other branches), and delete `build-and-push.yml`. Alternative: keep the file but trigger it `on: workflow_run` of CI with `conclusion == 'success'` and check out `workflow_run.head_sha`.

### H3. The 10-per-minute login limit can be bypassed with `/api/Login` or `/api/login/` — **Verified** — `fixed`
- **Where:** `nginx.conf:50` (`location = /api/login`, exact and case-sensitive) vs `sync-server/server.js:112-141` (Express defaults: case-insensitive, non-strict routing).
- **What:** I ran the server and POSTed valid credentials to four paths — `/api/login`, `/api/login/`, `/API/LOGIN`, `/api/Login` all returned **200**. In nginx, `/api/login/` and `/api/Login` don't match the exact `= /api/login` location; they fall through to `location /api/`, which allows 120 requests/minute with a burst of 40 instead of 10/minute with a burst of 5.
- **Why it matters:** README and AUDIT both present the login limit as the brute-force control for an internet-exposed instance; it is 12× weaker than documented.
- **Fix (both, so neither layer depends on the other):**
  1. `server.js`: `app.set("case sensitive routing", true); app.set("strict routing", true);` right after `express()`. The client only ever calls exact lower-case paths.
  2. `nginx.conf`: replace `location = /api/login` with `location ~* ^/api/login/?$`.
  3. Add a server test that `/api/Login` and `/api/login/` are 404.

### H4. Sync merges and applies the server copy without validating it — `fixed`
- **Where:** `src/lib/sync.ts:351-359` (`pullData()` → `mergePayload()` → `applySnapshot()`); compare `src/lib/backup.ts:127` (`validateBackup`, used only for file and snapshot restore).
- **What:** whatever `/api/pull` returns goes straight into the merge and then into the persisted stores. Examples traced through the code: an entry section containing `null` makes `mergeEntries` throw on `theirs.at` (`entries.ts:276`) — every sync from then on fails with "Sync failed — retrying…"; a note whose `text` is a number, or an `ivChecker` without `savedSessions`, is written to the store as-is (`applySnapshot`, `sync.ts:290-309`), persisted to localStorage, and breaks the screens that read it, surviving reloads. `designer` is the only section normalised on the way in.
- **How it could happen:** an older or buggy client build, a hand-edited `sync.json`, or anyone holding the token — and once on the server, every device pulls it.
- **Why it matters:** one bad push corrupts persisted state on every signed-in device; the CLAUDE.md rule "Normalise on the way in" is only half-applied.
- **Fix:** add a lenient `sanitizeRemote(raw): BackupData | null` next to `validateBackup` that reuses its shape checks per section but **drops** an invalid section (and invalid entries) instead of rejecting the whole payload, logging what it dropped; call it on `pulled.data` before `mergePayload`. Dropped sections then merge as "absent remotely", so the local copy is kept and the next push repairs the server. Tests in `sync-once.test.ts` for a `null` entry, a wrong-typed note and a missing `ivChecker`.

---

## Phase 4 — fixes (2026-10-25)

The four High findings are fixed; Medium and below are untouched, waiting for your call.

| | What changed | Test |
|---|---|---|
| **H1** | `npm audit fix` in `sync-server/`: `body-parser` 2.3.0 → 2.4.0 (lockfile only, `express` stays 5.3.0). `npm audit --omit=dev` now reports 0 for the app and the server — the step that failed CI. | CI audit step |
| **H2** | The publish moved into `ci.yml` as a `publish` job with `needs: check`, run on pushes to `main` and on a manual run (`workflow_dispatch`, which the old file had). `build-and-push.yml` is deleted. Tags, cache and platform are as before. A red commit can no longer reach `latest`. | Next push to `main` |
| **H3** | `server.js`: `case sensitive routing` and `strict routing` on, so only the exact paths answer. `deploy/nginx/default.conf`: the login location is `~* ^/api/login/?$`, so any spelling gets the 10/minute limit. Every path the app calls was checked to be exact (`/api/login`, `/api/pull`, `/api/push`, `/api/snapshots[/id]`, `/health`; server URLs have their trailing slash trimmed). | `server.test.js`: `/api/Login`, `/API/LOGIN`, `/api/login/`, `/api/Pull`, `/api/pull/` and `/API/push` are all 404 |
| **H4** | New `sanitizeRemote()` in `lib/backup.ts`, called by `syncOnce()` on every pull before the merge. It reuses the restore checks but drops instead of rejecting: a malformed section, or a single malformed entry of an entry section, is left out and logged (`console.warn`). A tracker field's marks and timestamps are dropped together, so newer remote timestamps without valid marks can't un-mark anything locally. When anything was dropped the sync always pushes, so the server copy is repaired. A payload that isn't an object counts as an empty server. | `sync-once.test.ts`, 5 new: a `null` and a wrong-typed note (good one kept, server repaired), a wrong-shaped `ivChecker` with a newer stamp (local kept), malformed marks with future timestamps (no un-marks), a non-object payload, and what `sanitizeRemote` reports |

**Verification after the fixes:** `npm run lint` clean · `npx tsc -b` clean · `npm test` 38 files, **460 passed**, 1 skipped; sync server **17/17** · `npm run build` OK, no `save-tables` preload · `npm audit --omit=dev --audit-level=high` 0 for the app and `sync-server/` · `npm run validate-data` passed · `npm run e2e` **113/113 checks passed** (both widths, offline, CSP, and two devices syncing through a real local server). **Docker build** not run locally (no Docker here); the `publish` job builds it after `check` passes. **CI run 40221852294 on `577ac9b`: `check` passed (the first green run since 2026-10-23), then `publish` built the image — including `nginx -t` on the new login location — and pushed `latest`.**

### Deferred — your call

Everything Medium, Low and Nitpick. The ones I'd do next, in order: **M1** (bind the sync server to 127.0.0.1 — one line), **M10** (a missing `overrides.json` should fail the data run), **M4** (fix the 3 script type errors, then type-check `scripts/` in CI), **M8** (`.dockerignore`), **M7** (pinned Capacitor CLI in the IPA build), **M6** (`npm audit fix` for dev tooling; dropping `@capacitor/assets`). **M2** (clock skew) and **M3** (poll without downloading the blob) change sync behaviour and want a decision first.

### Things you need to do

- **iOS:** H4 is client code, so the iOS app only gets it in a new build. Suggest cutting **v1.5.1** (CLAUDE.md release checklist). Until then the iOS app syncs as before — it's no worse off, just not protected.
- **TrueNAS:** update the app to pull the new `latest` (H1's fixed `body-parser`, H3's routing and nginx change).
- The GitHub UI items from Phase 3 (description, topics, social preview).

## Medium

### M1. The sync server listens on every interface, so it can be reached around nginx
- **Where:** `sync-server/server.js:239` (`listen(port)` → `0.0.0.0:3001`); `docker-entrypoint.sh:52`.
- **What:** nginx proxies to `127.0.0.1:3001`, but Node also accepts connections on the container's network interface. Port 3001 isn't published, yet any other container on the same Docker network (or the host, depending on network mode) can reach it directly — with no login rate limit at all, since that lives only in nginx.
- **Fix:** `listen(port, process.env.HOST || "127.0.0.1")` and keep `HOST` unset in the image. Dev keeps working (Vite proxies to `localhost`).

### M2. Device clocks decide every merge; a device whose clock runs ahead wins every conflict
- **Where:** `src/store/useDexStore.ts:63`, `src/store/createEntryStore.ts:25,29`, `sync.ts:143` (all `Date.now()`); compared in `sync-merge.ts:90` and `entries.ts:276`.
- **What:** marks, entries and section stamps use the local clock. A phone or PC set an hour ahead (or one with a dead RTC that reset to a future date) makes its changes win until real time catches up; un-marks made elsewhere in that window are silently reverted.
- **Why it matters:** silent "my change came back" bugs that can't be reproduced on a correct clock.
- **Fix (keeps the server dumb):** `/api/pull` also returns `serverTime: Date.now()`; the client keeps `offset = serverTime − (request start + end)/2` and stamps with `Date.now() + offset`. Changes behaviour slightly, so I'd ask before doing it.

### M3. Every 30-second poll downloads the whole sync blob
- **Where:** `src/hooks/useSyncEngine.ts:68-80` → `sync.ts:206`; `server.js:162-166`.
- **What:** each poll transfers the full payload (all marks with timestamps, notes, journal, and ~15 KB per imported save) even when nothing changed. nginx gzips it, but a visible tab still pulls it 120 times an hour, and the merge + `payloadsEqual` (two full `JSON.stringify` passes) runs each time.
- **Fix:** send the last-seen version: `GET /api/pull?since=<version>` returns `{ ok: true, unchanged: true, version }` when it matches (a single integer compare — still no merge logic on the server). `syncOnce()` skips the merge when unchanged and nothing local is pending.

### M4. Scripts aren't type-checked by CI, and their tsconfig won't survive TypeScript 7 — **Verified**
- **Where:** `tsconfig.json:2-5` (references only `app` and `node`); `tsconfig.scripts.json:11` (`baseUrl`).
- **What:** `tsc -b` never sees `scripts/`. Running `npx tsc -p tsconfig.scripts.json` today fails with `TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`. `tsx` doesn't type-check, so a type error in the data pipeline is only found when someone runs it.
- **Update after Phase 2:** with `baseUrl` gone (the config is now `scripts/tsconfig.json`) the check gets past the options error and finds **3 type errors that were always there**: `scripts/e2e-links.ts:1292` (`closeAllConnections` on a server typed as HTTP/2), and `scripts/fetch-data.ts:479` and `:592` (the raw fetch result and the built Pokémon passed to each other's function types). The scripts still run (`tsx` doesn't type-check), so these are type bugs, not runtime failures — but they show what the gap hides.
- **Fix:** fix the three errors, then add `npx tsc -p scripts/tsconfig.json` as a CI step (or a project reference).

### M5. ESLint only lints `.ts`/`.tsx`, so `sync-server/server.js` and `scripts/*.mjs` are never linted
- **Where:** `eslint.config.js:14` (`files: ['**/*.{ts,tsx}']`).
- **Fix:** add a second config block for `**/*.{js,mjs,cjs}` with `js.configs.recommended` and `globals.node` (CommonJS for `sync-server/`).

### M6. 2 critical and 10 high advisories in dev dependencies
- **Where:** root `package-lock.json`. Critical: `handlebars` (JS injection), `tar` (path traversal, via `@capacitor/cli` and `@capacitor/assets`). High: `@xmldom/xmldom`, `brace-expansion`, `minimatch`, `sharp` (libvips/libheif, **no fix available**), `tmp`, `zod`.
- **Why it matters:** none of this ships in the web bundle or the image (`--omit=dev` is clean), but it runs on your machine and on the macOS runner that builds the IPA, where `tar` extracts downloaded archives.
- **Fix:** `npm audit fix` (non-breaking, covers most). `@capacitor/assets` is the sole path for `sharp`'s unfixable advisory and is only used by the `ios:icons` script — `scripts/generate-icon.mjs` already writes the iOS icon — so I'd remove it and add `sharp` as an explicit devDependency (it's an unlisted dependency today; see Nitpick). Asking first, as it removes a script.

### M7. The IPA workflow installs the latest Capacitor CLI globally instead of the locked one
- **Where:** `.github/workflows/build-ios.yml:26-30`.
- **What:** `npm install -g @capacitor/cli` takes whatever version is newest on the day; `npx cap sync` then may run that rather than the locked `@capacitor/cli@^8.5.3`. Not reproducible, and an unpinned global install is a supply-chain foothold. The workflow also has no `permissions:` block (defaults apply).
- **Fix:** delete the "Install Capacitor CLI" step (`npm ci` already installed it); add `permissions: { contents: read }`.

### M8. `.dockerignore` sends personal files into the build context
- **Where:** `.dockerignore` (whole file) and `Dockerfile:7` (`COPY . .` in the builder).
- **What:** not excluded: `src/lib/save/__tests__/fixtures/` (your real `.sav` files), `*.sav`/`*.dsv`, `notes-and-print-deliverables/` (a CSV export with notes), `ux-review-screenshots/`, `ipa-download/`, `ios/`. A local `docker build` uploads them to the daemon and copies them into the builder stage. They don't reach the final image (only `dist/` is copied), but they do sit in the local build cache, and the IPA/iOS folders slow every build.
- **Fix:** add those paths plus `*.sav`, `*.dsv` and `docs/` to `.dockerignore` (the image build needs none of them). CI checkouts don't contain the untracked ones, so this is about local builds.

### M9. `docker-compose.yml` can't build the image
- **Where:** `docker-compose.yml:3` (`image:` only).
- **What:** `docker compose build` is a no-op and `docker compose up` always pulls `latest` — there is no way to run a local change through compose.
- **Fix (Phase 2):** add `build: { context: .., dockerfile: deploy/Dockerfile }` alongside `image:`.

### M10. A missing `overrides.json` silently drops every static legendary, roamer and gift
- **Where:** `scripts/fetch-data.ts:604-611`.
- **What:** if the file isn't found the step logs "overrides.json not found — skipping (run won't corrupt data)" and carries on. That is exactly what would happen if the file were moved (Phase 2) without updating this path, and the resulting `pokemon.json` lacks 86 static/roaming/gift rows. Whether `validate-data` catches every loss depends on which species happen to have no other row.
- **Fix:** make a missing file an error (`throw`), like every other failed input in the pipeline (CLAUDE.md: "A failed fetch fails the run — nothing is skipped").

### M11. `pruneSnapshots` and the snapshot hour: a bad push late in an hour can only be undone to the start of that hour
- **Where:** `sync-server/server.js:81-92`.
- **What:** the hourly snapshot is taken on the **first** push of an hour. If you sync normally at 14:05 and an accidental "Clear generation" lands at 14:50, the newest snapshot is from before 14:05; restoring it loses the 45 minutes of good edits in between (they're still recoverable by hand from the change log on the device that made them, but not from the server).
- **Fix:** additionally keep the last N push-replaced copies (e.g. 10, `snapshots/recent-<n>.json`) and list them in the same endpoint. Small server change, no merge logic.

---

## Low

- **L1. CI runs twice per change and on tags** — `ci.yml:3-5` (`push` with no filter + `pull_request`). Each Dependabot PR and each release tag (`v1.5` run 40054782750) gets a duplicate run. Fix: `push: branches: [main]` plus `pull_request`.
- **L2. Actions pinned to major tags, not SHAs** — all workflows. Fine for first-party `actions/*`; for `docker/*` consider SHA pins (Dependabot keeps them current).
- **L3. A self-hosted image advertises your domain** — `index.html:16-22` (og/twitter URLs), `public/robots.txt` (`Sitemap: https://pokedex.shrumslab.com/…`, `Allow: /`), `public/sitemap.xml`. Everyone who deploys the image serves your URL in link previews and invites crawlers to index their private instance. Fix: `robots.txt` → `Disallow: /` by default and drop the sitemap from the image, or generate both at build time from an env var; keep the OG tags (they need an absolute URL) but document them.
- **L4. GitHub Pages publishes the whole repo root** — Pages is a legacy Jekyll build from `main` `/` (checked with `gh api …/pages`). `https://jabberwocky7777.github.io/Pokedex-Tracker/` serves the *unbuilt* Vite `index.html` (a blank page that requests `/src/main.tsx`), and `AUDIT.md`, `CLAUDE.md`, `public/data/*.json` are all published as site pages. Only `apps.json` needs to be there. Fix: see the `apps.json` decision in Phase 2.
- **L5. CSV export doesn't neutralise formulas** — `src/lib/backup.ts:133` (`csvText`). A note starting with `=`, `+`, `-` or `@` becomes a live formula when the CSV is opened in Excel/Sheets. It's your own data, so low risk. Fix: prefix such values with `'`.
- **L6. Container runs as root** — `Dockerfile` (carried over from AUDIT L3, skipped then). nginx needs port 80; the usual route is `listen 8080` + `USER nginx` + publishing `7777:8080`, and `/data` ownership on TrueNAS. Still worth doing eventually.
- **L7. Precache is 7.2 MB on the first visit** — `vite.config.ts:62` precaches every tool chunk plus `moves.json` and `learnsets.json` (1.5 MB) that many visits never open. Deliberate for full offline use; if mobile data matters, move those two files and the Battle Tower chunks to a `StaleWhileRevalidate` runtime cache.
- **L8. The Burnished theme loads Google Fonts** — `src/themes/index.ts:44`. A third-party request from a self-hosted app (your visitors' IPs go to Google), and the font is missing offline. Fix: self-host the two font files in `public/fonts/` and drop the two Google hosts from the CSP.
- **L9. `theme-init.js` throws when storage is blocked** — `public/theme-init.js:5`. `localStorage.getItem` throws in Safari with storage disabled; the theme then isn't set before first paint (the app recovers once React loads). Fix: wrap in `try`.
- **L10. CORS defaults to `http://localhost:5173` in production** — `server.js:118-121`. With `CORS_ORIGIN` unset, production responses carry `Access-Control-Allow-Origin: http://localhost:5173`. Harmless (bearer token, no cookies), but surprising; default to no header unless configured.
- **L11. `sync-server/Dockerfile` is unused** — no workflow or doc builds it (AUDIT L3 kept it "in step"). Candidate for deletion (listed in Phase 2, needs your OK).
- **L12. Untested sync scheduling** — see Tests.
- **L13. Some overlay menus have no Esc / focus handling** — e.g. the slot menu in `DesignerPcBox.tsx:185-187`, the Battle Tower picker in `CalcPokemonPanel.tsx:273`: a full-screen click-catcher `div` but no keyboard way out. `hooks/useDialogFocus.ts` already exists for this.

---

## Nitpick

- **N1.** knip: 20 unused exports, e.g. `GEN3_VERSIONS`/`GEN4_VERSIONS` (`types/index.ts:24,28`), `locationNote`/`rateText` (`what-next.ts:50,123`), `nameToSlug` (`move-names.ts:10`), `decryptPk4` (`pk4.ts:69`), `CAN_PRINT` (`Print.tsx:37`), `TOWER_LEVEL`, `INCENSE_BABIES`, `HUNT_METHODS`, `newHuntId`, `orderAtEnd`, `openItemsFor`, `laterStages`, `normalizeSlots`, `getToken`, `getSectionUpdatedAt`, `pullData` (several are used inside their own file — only the `export` is dead). 68 exported types are unused outside their file (mostly fine as documentation).
- **N2.** `src/lib/save/__tests__/demo.ts` is unused (AUDIT: `needs-owner-decision`, still open).
- **N3.** `sharp` is used by `scripts/generate-icon.mjs` and `generate-og-image.mjs` but not listed in `package.json`; it only resolves through `@capacitor/assets`.
- **N4.** `package.json` is `"name": "pok-dex"`, `"version": "0.0.0"` while the app is 1.5. Consider `pokedex-tracker` / `1.5.0`.
- **N5.** No `engines` field or `.nvmrc` at the root; CI and Docker use Node 22, README says 22+.
- **N6.** `key={index}` on static lists in `DesignerPcBox.tsx:101,116,139`, `IvSection.tsx:243`, `MonCard.tsx:285` — harmless (fixed-length, never reordered).
- **N7.** `nginx.conf:54,67` set `X-Real-IP`, which the sync server never reads.
- **N8.** `Dockerfile` base images are tags (`node:22-alpine`), not digests.
- **N9.** Repo description on GitHub still says "IV checker" and "React + Vite SPA" (see Phase 3).
- **N10.** `README.md` says CI runs "lint, `tsc -b` and the tests" — it also builds and audits.

---

## Tests

**What's covered well:** sync merge (`sync-merge`, `sync`, `sync-once` — including 409 retries, entry sections, saves merge and a full backup round-trip), every calculator, availability/filtering, search, URL routing, navigation, the change log, notes/journal/working-on, and the save importer (Gen III/IV synthetic saves, living dex, to-do, history, best copy, box search). The server has 15 `node --test` cases (auth, snapshots, version conflicts, JSON errors).

**Critical paths without tests:**
1. **`useSyncEngine`** — debounce, poll pause while typing, the single queued rerun, hidden-tab pause, and the 401 sign-out. All scheduling, no tests. Testable with fake timers and a mocked `syncOnce`.
2. **Malformed server payload** in `syncOnce` (H4).
3. **`lib/save/storage.ts` + `useSaveStore.hydrate()`** — the IndexedDB failure path (`storageFailed`) and an import landing while hydration is still running.
4. **Login path variants** on the server (H3).
5. **nginx config** — only `nginx -t` runs; nothing checks which location a path lands in. A tiny smoke test in the CI docker job (`curl` a few paths against the built image) would have caught H3.
6. `calc-from-designer.ts`, `stat-calc.ts`, `evolution-status.ts` — no direct tests (partly covered through callers).
7. `npm run e2e` (Playwright, both widths, two-device sync) exists but isn't in CI; it needs an installed Chrome — `npx playwright install chromium` in CI would make it runnable.

---

## Dependency health

- **Runtime (shipped):** app 0 advisories. Sync server: `body-parser` (H1).
- **Dev:** 18 advisories, see M6. `sharp`'s advisory has no fix while `@capacitor/assets` pins it.
- **Outdated:** patch/minor only — eslint 10.13, lucide-react 1.61, playwright 1.64.1, react/react-dom 19.3.1, typescript-eslint 8.72, vite 8.3.5, vitest 5.0.5, zustand 5.0.16. Dependabot's weekly group will bring these.
- **TypeScript 7.0.2** is held back by typescript-eslint's peer range (`dependabot.yml:18-22`); still correct.

---

## Phase 2 — folder layout proposal

> **Status: done (2026-10-25).** Approved as written, with `apps.json`/`pokeball.png` left at the root (option A) and `sync-server/Dockerfile` deleted. Verified after the move: no old path left outside `docs/AUDIT.md` (kept as written, a historical record); `npm run lint`, `npx tsc -b`, `npm test` (455 + 15 passed), `npm run build`, `npm run validate-data` all pass; `vite preview` still sends the CSP read from `deploy/nginx/security-headers.conf`. `docker compose build` was not run locally (no Docker here) — by your choice the CI publish build of this commit is the check. Below is the proposal as approved.

### Root today (tracked files)

```
.dockerignore  .env.example  .gitignore  AUDIT.md  CLAUDE.md  CONTRIBUTING.md
Dockerfile  LICENSE  README.md  apps.json  capacitor.config.ts  docker-compose.yml
docker-entrypoint.sh  eslint.config.js  index.html  nginx-real-ip.conf
nginx-security-headers.conf  nginx.conf  overrides.json  package-lock.json
package.json  pokeball.png  tsconfig.app.json  tsconfig.json  tsconfig.node.json
tsconfig.scripts.json  vite.config.ts
.github/  ios/  public/  resources/  scripts/  src/  sync-server/
```

Untracked or git-ignored folders also sit at the root on your machine:
`Start PokeDex Tracker.exe`, `Start PokeDex Tracker.vbs`, `launcher/`, `ipa-download/`,
`notes-and-print-deliverables/`, `ux-review-screenshots/`, `dist/`. They aren't in
the repo, so they don't affect GitHub; I won't touch them unless you say so.

### Proposed

```
.
├── .github/
│   ├── workflows/            (paths updated)
│   ├── ISSUE_TEMPLATE/       bug_report.yml, feature_request.yml, config.yml   ← new (Phase 3)
│   ├── pull_request_template.md                                               ← new (Phase 3)
│   ├── CONTRIBUTING.md       ← moved
│   └── dependabot.yml
├── deploy/
│   ├── Dockerfile
│   ├── docker-compose.yml    (+ build: context ..)
│   ├── docker-entrypoint.sh
│   └── nginx/
│       ├── default.conf
│       ├── security-headers.conf
│       └── real-ip.conf
├── docs/
│   ├── AUDIT.md              ← moved (history)
│   ├── REVIEW.md             ← this file (moved here after Phase 4)
│   ├── self-hosting.md       ← from README (TrueNAS, proxies, CSP, updating)   (Phase 3)
│   ├── sync.md               ← from README (how sync merges, snapshots, offline mode)
│   ├── development.md        ← from README (scripts, local sync, marking, search syntax)
│   ├── data-pipeline.md      ← from README (regenerating data, pinned commit)
│   ├── ios.md                ← from README + CLAUDE.md release checklist pointer
│   ├── screenshots/          ← new (Phase 3)
│   └── social-preview.png    ← new (Phase 3)
├── ios/  public/  resources/  src/
├── scripts/
│   ├── data/
│   │   ├── overrides.json            ← moved
│   │   └── override-provenance.json
│   ├── tsconfig.json                 ← was tsconfig.scripts.json
│   └── …
├── sync-server/              (Dockerfile removed — see deletions)
├── .dockerignore  .env.example  .gitignore
├── apps.json  pokeball.png   ← stay (see decision below)
├── CLAUDE.md  LICENSE  README.md
├── capacitor.config.ts  eslint.config.js  index.html  vite.config.ts
├── package.json  package-lock.json
└── tsconfig.json  tsconfig.app.json  tsconfig.node.json
```

Root goes from 27 tracked files to 17 (15 if `apps.json`/`pokeball.png` move).

### Before → after, every moved file

| Before | After | References to update |
|---|---|---|
| `Dockerfile` | `deploy/Dockerfile` | its own `COPY` lines (paths stay relative to the repo-root context); `build-and-push.yml` + `ci.yml` (`file: deploy/Dockerfile`); README, CLAUDE.md |
| `docker-compose.yml` | `deploy/docker-compose.yml` | `env_file: ../.env`; add `build: { context: .., dockerfile: deploy/Dockerfile }`; README |
| `docker-entrypoint.sh` | `deploy/docker-entrypoint.sh` | `Dockerfile` COPY; comments in `nginx-real-ip.conf`; CLAUDE.md |
| `nginx.conf` | `deploy/nginx/default.conf` | `Dockerfile` COPY; comment in `server.js:22-24`; CLAUDE.md |
| `nginx-security-headers.conf` | `deploy/nginx/security-headers.conf` | `Dockerfile` COPY; **`vite.config.ts:11`** (reads the CSP from it); comment in `public/theme-init.js`; CLAUDE.md |
| `nginx-real-ip.conf` | `deploy/nginx/real-ip.conf` | `Dockerfile` COPY; comments in `docker-entrypoint.sh`; CLAUDE.md |
| `CONTRIBUTING.md` | `.github/CONTRIBUTING.md` | README link; GitHub picks it up automatically from `.github/` |
| `AUDIT.md` | `docs/AUDIT.md` | comments that cite "AUDIT.md C2" (`src/lib/backup.ts`, others found by grep); CLAUDE.md |
| `overrides.json` | `scripts/data/overrides.json` | **`scripts/fetch-data.ts:604`** (plus making a missing file an error, M10); README, CONTRIBUTING, CLAUDE.md |
| `tsconfig.scripts.json` | `scripts/tsconfig.json` | every `tsx --tsconfig` in `package.json` scripts; its `include` paths become `["./**/*", "../src/lib/**/*", "../src/types/**/*"]`; drop `baseUrl` (M4) |

The Docker build context stays the repo root, so `.dockerignore` stays at the root and works unchanged.

### Not moved, and why

- **`apps.json` and `pokeball.png` — your decision needed.** Users added the source as `https://jabberwocky7777.github.io/Pokedex-Tracker/apps.json`, served by Pages from `main` `/`. `pokeball.png` is referenced by `raw.githubusercontent.com/…/main/pokeball.png` inside `apps.json` (both `iconURL`s).
  - **A (recommended): leave both at the root.** Zero risk; costs two root files.
  - **B: move both to `docs/` and switch Pages to "main / docs".** The source URL stays exactly the same (Pages serves `docs/apps.json` at `/apps.json`), and it fixes L4 (the repo root stops being published). But it needs a manual Pages setting change timed with the push (a minute or two of 404s for anyone refreshing then), and `iconURL` changes to the new path — AltStore re-reads it on the next refresh, but a cached copy shows a broken icon until then. To avoid that I'd keep a copy of `pokeball.png` at the root anyway, which defeats half the point.
- **`resources/` vs `public/`:** no overlap. `resources/icon.svg` is the single master; `public/` holds what `generate-icon.mjs` produces from it plus the web-only files. `pokeball.png` is a different picture (the AltStore icon). Keep as is.
- **`tsconfig.node.json`** stays: it covers `vite.config.ts` under Node types, which the scripts config doesn't. Merging it with the scripts config would put `src/lib` under Node types and the `vite.config.ts` rules.
- **`ios/`, `sync-server/`, `src/`, `public/`** — unchanged.

### Deletions (need your OK — nothing is deleted without it)

| File | Why |
|---|---|
| `sync-server/Dockerfile` | Built by nothing (L11); the combined image is the only deployment |

### Verification after the move

`grep` for every old path (including docs and comments), then `npm run lint`, `npx tsc -b`, `npx tsc -p scripts/tsconfig.json`, `npm test`, `npm run build`, `npm run preview` (checks the CSP still loads from its new path), and `npm run validate-data`. **`docker compose build` can't run here** (Docker isn't installed on this machine): the CI `docker` job only runs on PRs and non-main branches, and you push straight to `main`. Options: install Docker Desktop and I run it, or I push the restructure to a short-lived branch so the CI `docker` job builds it before it lands on `main` (an exception to the main-only rule — your call).

---

## Phase 3 — GitHub presentation checklist

Done in the repo (2026-10-25):

- [x] **Screenshots** → `docs/screenshots/` (15 WebP files + `quick-mark.gif`, 1.9 MB in all): tracker (box, list, detail), What's next, Progress, Pokédex, Routes and Settings → Sync at 1440 px; tracker, detail and Pokédex at 390 px (2×); tracker and Pokédex also in Burnished. There is no light theme — every theme is dark-based — so "light and dark" is Dark and Burnished. Made by `npm run screenshots` (`scripts/capture-screenshots.ts`) from deterministic made-up marks and two invented notes, in offline mode: no account, no save file, no real data. The GIF (marking nine Pokémon with Quick mark, ending on the Undo toast) was recorded once with a throw-away script and a pure-JS GIF encoder outside the repo, since there is no ffmpeg here; it isn't regenerated by a project script.
- [x] **Social preview**, 1280×640 → `docs/social-preview.png` (`npm run generate:social`).
- [x] **Issue templates** (`.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, `config.yml`) and **PR template** (`.github/pull_request_template.md`). The bug form asks people not to attach real saves.
- [x] **README** rewritten: icon, tagline, badges (CI, license, latest release, platforms), hero screenshot, short feature list, GIF, screenshot grid, Install (web / Docker / AltStore), Sync server, Development, Contributing, License. The long material moved, unchanged apart from headings, into `docs/features.md`, `docs/self-hosting.md` (plus a new Docker Compose section), `docs/sync.md`, `docs/development.md` (plus the two new scripts and a corrected CI sentence — N10), `docs/data-pipeline.md` and `docs/ios.md` (plus AltStore install steps). All relative links checked.

Needs you in the GitHub UI:

- [ ] **Description** — suggested: *"Track a Gen III–IV living dex across devices: save-file import, encounters by route, catch and damage calculators, team designer. React PWA + iOS app, self-hostable sync."* (the current one mentions the removed "IV checker")
- [ ] **Topics** — `pokemon`, `pokedex`, `living-dex`, `react`, `typescript`, `vite`, `pwa`, `capacitor`, `self-hosted`, `docker`, `zustand`, `tailwindcss`, `altstore`
- [ ] **Website** — `https://pokedex.shrumslab.com` only if that instance is meant to be public (it's already the OG URL in `index.html`). The README does *not* point people at it; say if you want a "try it" link there too
- [ ] **Social preview** — upload `docs/social-preview.png` in Settings → General → Social preview
- [ ] **Release** — `v1.5` already exists (2026-10-24) with the IPA, and `apps.json` points at it. Recommendation: no new release for the docs/layout work. After Phase 4, cut **v1.5.1** only if a fix changes the iOS bundle (H4 does — it's client code), with release notes listing the fixes.
