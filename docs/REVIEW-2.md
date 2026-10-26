# Pokédex Tracker — second review (2026-10-25)

A fresh pass at commit `2edd527`, after everything in [REVIEW.md](REVIEW.md) was fixed. Report only: nothing was changed to write this. I started with the code I wrote in Phases 4–5 (the newest and least proven), then went back over the areas the first review only skimmed: the save parsers, undo and the change log, the sign-in screens, snapshot restore, the components' listeners and timers, and CI.

## Baseline

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npx tsc -b`, `npx tsc -p scripts/tsconfig.json` | clean |
| `npm test` | 40 files, 480 passed, 1 skipped; sync server 21/21 |
| `npm run build` | OK; main chunk 404 kB (122 kB gzip); precache 79 entries / 7.3 MB |
| `npm audit` | 0 in what ships; 3 moderate in dev tooling (`uuid` via `@capacitor/cli`, unchanged) |
| `npm outdated` | patch/minor only — all of it is in the open Dependabot PR #13 |
| CI on `main` | **red on the latest commit** (`2edd527`, a `.gitignore` change): the e2e job failed while `check` and `publish` passed — see R4 |

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 5 |
| Low | 5 |
| Nitpick | 3 |

**Status: all fixed (2026-10-25)** — see [Fixes](#fixes-2026-10-25) at the end.

---

## High

### R1. "Revert last import" throws away every mark made since the import, on every device
- **Status:** `fixed`. **Where:** `src/components/saves/SavesView.tsx:159-168` → `restoreGenLogged()` (`src/lib/dex-actions.ts:66`) → `useDexStore.restoreGen()`.
- **What:** the revert point is the *whole generation's* marks from just before the import, and it is kept until the next import of that save — days or weeks. Reverting makes the generation equal to that snapshot: every caught, pending, shiny and placed mark changed since — by hand, from another import, or synced in from another device — is undone too. `restoreGen` stamps every change as now, so the next sync pushes the loss to every device. There is no confirmation; the Undo toast lasts 5 seconds.
- **Why it matters:** one click, worded as "revert the import", silently erases unrelated progress everywhere. It can be recovered (the change log has a `revert` entry, and the server keeps snapshots), but only if you notice.
- **Fix:** revert only what the import changed. `applyImportWithUndo()` already logs the import as a change-log entry; keep that entry's id in the revert point and revert with `undoLogEntry(entryId)`, which puts a mark back only while it still has the value the import gave it and reports the rest as skipped ("Reverted 42 marks; 3 changed since were left alone"). Fall back to today's behaviour only for revert points saved before the change, behind a confirmation.

## Medium

### R2. The sync indicator turns "stale" after an hour without edits, while sync is working fine
- **Where:** `src/hooks/useSyncEngine.ts:42` (`setLastSynced(new Date(result.savedAt))`), `src/components/layout/SyncDot.tsx:39-41`.
- **What:** `savedAt` is when *anyone last pushed* to the server, not when this device last synced. A device that polls successfully every 30 s but where nobody has edited for an hour shows the stale state: "Last synced 2 hours ago — tap to retry". It's also compared with the device clock, so a clock that's off moves it further.
- **Fix:** on every successful sync, set `lastSynced` to the time of that sync (now), and show the server's `savedAt` separately if wanted ("data last changed …").

### R3. Signing in on an iOS 15 device always fails with "Cannot reach server"
- **Where:** `src/components/auth/NativeOnboardingScreen.tsx:46,63` (`AbortSignal.timeout(…)`).
- **What:** the app targets iOS 15.0 (`IPHONEOS_DEPLOYMENT_TARGET`), but `AbortSignal.timeout` only exists from Safari/WebKit 16. On iOS 15 it throws a `TypeError` inside the `try` around the health check, which is reported as the server being unreachable — so onboarding can never succeed there. `lib/sync.ts` already has a fallback (`timeoutSignal`, written for exactly this) that onboarding doesn't use.
- **Fix:** export `timeoutSignal()` from `sync.ts` and use it in onboarding.

### R4. A flaky e2e check turns CI — and the README's CI badge — red
- **Where:** `scripts/e2e-links.ts:1202-1208` (the two-device sync check's sign-in); the `e2e` job in `ci.yml`.
- **What:** on `2edd527`, which changed only `.gitignore`, the check timed out because the "Sign in" button stayed disabled — the username or password field was empty by the time of the click. The same check passed on the two runs before it and locally. The script fills `input[type="text"]` right as the form appears and clicks without checking the fields kept their values. Because `e2e` is part of the CI workflow, a flake makes the run — and the README badge — red even though `publish` went ahead.
- **Fix:** wait for the form (`getByLabel("Username")`), fill, then `expect(button).toBeEnabled()` (refilling once if not) before clicking. And/or run the e2e step with one retry.

### R5. A sync after a future shape change could delete the newer data (from my H4 fix)
- **Where:** `sanitizeRemote()` in `src/lib/backup.ts`, and the "always push when something was dropped" rule in `syncOnce()`.
- **What:** to repair a bad server copy, a sync that drops anything pushes a copy without it. That's right for genuinely broken data, but if a future version of the app changed the *type* of an existing field (a note's `text` becoming an object, say), a device still on this version would treat every new-style entry as malformed and push them off the server. New fields and new sections are safe — they're kept and passed through — so this only bites on an incompatible change, and only once such a version exists.
- **Fix (cheap):** add the rule to CLAUDE.md's "Adding a synced field": never change an existing synced field's type or meaning; add a new field instead. **(Thorough):** don't apply dropped entries locally, but carry them through unchanged in the pushed copy instead of deleting them.

### R6. The dependency update PR is waiting
- **Where:** [Jabberwocky7777/Pokedex-Tracker#13](https://github.com/Jabberwocky7777/Pokedex-Tracker/pull/13) — 9 patch/minor updates (React 19.3.1, Vite 8.3.5, Vitest 5.0.5, Zustand 5.0.16, lucide-react 1.61, ESLint 10.13, typescript-eslint 8.72, Playwright 1.64.1).
- **What:** all its checks passed, including the new Docker smoke test. It was opened before the Phase 5 lockfile changes, so it probably needs a rebase before it can merge.
- **Fix:** comment `@dependabot rebase` on it, then merge once it's green.

## Low

- **R7. The Undo toast for "clear generation" and for an import can undo synced-in marks too** — `dex-actions.ts:75-93`. Same mechanism as R1, but only within the toast's 5 seconds: a mark another device made in that window is reverted along with the clear/import. Fix: undo through the change-log entry, as in R1.
- **R8. A server snapshot with one bad entry can't be restored at all** — `ServerSnapshots.tsx:41` → `restoreBackupData()` → the strict `validateBackup()`. Sync now tolerates such data (it drops the bad entry), restore rejects the whole snapshot. Fix: run `sanitizeRemote()` first, restore the rest, and say what was left out.
- **R9. iOS onboarding misreports some server answers** — `NativeOnboardingScreen.tsx:66`. The login response is parsed as JSON before its status is checked, so nginx's HTML rate-limit page (503) or a wrong address (an HTML 404) shows "Connection timed out". Fix: check the status first, with messages for 503 ("too many attempts, wait a minute") and 404 ("that address isn't a Pokédex Tracker server").
- **R10. The sync server still decompresses request bodies** — `server.js` (`express.json({ limit: "4mb" })`). No client sends compressed bodies; `inflate: false` removes the whole class of compressed-body bugs H1 was one of.
- **R11. Listing snapshots parses every snapshot file** — `GET /api/snapshots` reads and `JSON.parse`s up to ~65 files of the full payload size just to get each `savedAt`. Fine at today's sizes; with many imported saves it is tens of MB per click. Fix: read `savedAt` from the first bytes of the file, or keep a small index.

## Nitpick

- **N1.** `DesignerPcBox`: moving straight from one slot's menu to another's (without closing the first) leaves the focus handling bound to the first, because `useDialogFocus` only re-runs when `open` changes. Pass `menuSlot` in a key or a dependency.
- **N2.** The version lives in three places now (`MARKETING_VERSION`, `apps.json`, `package.json`). `pages.yml` checks the first two match; it could check `package.json` too.
- **N3.** TypeScript 7 is still held back by typescript-eslint's peer range — unchanged, still right.

---

## Checked and fine

- **Save parsing** (`gen3.ts`, `gen4.ts`, `pk3.ts`, `pk4.ts`): fixed-size reads inside the 512 KB / 128 KB image, block and record checksums, species validated, bad slots counted rather than fatal, files over 2 MB refused before reading. Nothing found.
- **URL routing** (`url-route.ts`): unknown tabs, bad items and malformed escapes all fall back safely.
- **Listeners and timers**: every `addEventListener`/`setInterval` in components and hooks is removed on cleanup (the one extra in `main.tsx` removes itself after use); object URLs are revoked.
- **My Phase 4–5 code** apart from R5: the clock offset only moves stamps forward relative to a device's own earlier edits; `?since` falls back to a full pull on any doubt (local edits, a retry, sign-in, an old server); the scheduler matches the old hook's behaviour, including dropping a waiting push when the stores match the server again; the entrypoint falls back to root rather than failing; the smoke test exercises the real container.
- **Repository hygiene**: no stray `TODO`s or `console.log`s; old worktrees and branches are gone; git is clean and level with GitHub.

## Suggested order

R1 (data loss) → R3 (iOS 15 sign-in) → R2 (misleading indicator) → R4 (red badge) → R6 (merge the PR) → R5's CLAUDE.md rule → the Lows. R1, R2, R3 and R9 are client code, so they reach the iPhone only in a new build — a good set to ship as v1.5.1.

---

## Fixes (2026-10-25)

| | Status | What changed |
|---|---|---|
| **R1** | fixed | A revert point now keeps the changes the import made (`RevertPoint.changes`), and "Revert last import" takes back only those — and only marks that still have the import's value (`revertChangesLogged()` in `dex-actions.ts`), logged as a `revert` with an Undo. The toast says how many were reverted and how many changed since were left alone. Revert points saved by the old code use the import's change-log entry instead; if that has been pruned, the button refuses and points to Changes or a server snapshot. Tested: a mark un-caught by hand and a new catch made after the import both survive the revert, and the revert's Undo puts back exactly what it took. |
| **R2** | fixed | `lastSynced` is the time of this device's last successful sync. |
| **R3** | fixed | `timeoutSignal()` is exported from `sync.ts` and used by onboarding; CLAUDE.md says never to use `AbortSignal.timeout`. No `AbortSignal.timeout` is left outside that helper. |
| **R4** | fixed | The e2e sign-in fills by label and clicks only once the button is enabled (refilling up to twice). The CI e2e step retries once, with a warning in the log, so one hiccup doesn't turn the badge red. |
| **R5** | fixed (thorough) | `sanitizeRemote()` now separates entries that are *broken* (null, no stamp — dropped, and the push repairs the server) from entries that are *stamped but in an unknown shape* (`passThrough`): those aren't applied locally, but `withPassThrough()` puts them back into every push, so an older device never deletes a newer one's data. CLAUDE.md has the rule: never change an existing synced field's type. Tested with a "rich text" note a future version might write: it stays on the server through both a pull and a later push. |
| **R6** | fixed | Dependabot rebased #13; it passed every check (including the Docker smoke test) and was squash-merged as `52d8877`: React 19.3.1, Vite 8.3.5, Vitest 5.0.5, Zustand 5.0.16, lucide-react 1.61, ESLint 10.13, typescript-eslint 8.72, Playwright 1.64.1. |
| **R7** | fixed | The Undo of a clear and of an import go through their change-log entry (`undoLogEntry`), so marks set after them are left alone. Tested both. |
| **R8** | fixed | `restoreBackupData(raw, { lenient: true })` for server snapshots: malformed sections and entries are left out and listed in the result message; backup files stay strict. Tested. |
| **R9** | fixed | Both sign-in screens parse the body without assuming JSON, prefer the server's own message, and otherwise say "too many sign-in attempts" (503/429) or "doesn't look like a Pokédex Tracker server" (404, or no token). |
| **R10** | fixed | `express.json({ inflate: false })`: a gzip body gets 415 and is never decompressed. Tested. |
| **R11** | fixed | `GET /api/snapshots` reads `savedAt` from the last 256 bytes of each file, falling back to a full parse for any other layout. Tested, including a decoy `"savedAt"` inside the data and a file in another layout. |
| **N1** | no change needed | Can't happen: while a slot menu is open, a full-screen overlay catches the click on any other slot and closes the first menu, and Tab is kept inside the open one. |
| **N2** | fixed | `pages.yml` also checks `package.json`'s version (`1.5` → `1.5.0`). |
| **N3** | unchanged | Still right. |

**Verification:** on `main` with #13 merged — `npm ci`, `npm run lint` clean, `npx tsc -b` and the scripts' type-check clean, `npm test` **485 passed** (40 files) and the sync server **23/23**, `npm run build` OK, `npm audit --omit=dev` 0 for the app and the server, `npm run validate-data` passed, `npm run e2e` **113/113** (including the two-device sync sign-in R4 fixed). CI on the push: CI_RESULT.

**For you:** R1, R2, R3, R7, R8 and R9 are app code, so the iPhone gets them in the next build — together with Phase 5's sync changes, a good reason to cut **v1.5.1** (CLAUDE.md release checklist; `package.json` goes to `1.5.1` too, which `pages.yml` now checks). The server-side fixes (R10, R11) reach TrueNAS with the next `latest`.
