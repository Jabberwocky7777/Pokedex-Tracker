# Pokédex Tracker — code audit

Audited at commit `586ecfc` on 2026-10-10. No code was changed. Every finding
below was traced in the code; where I also ran something to confirm it, the
finding says **Verified by running**. Where I could not confirm (needs a
device, a real save, or a judgement call) it says so.

**Phase 2 status (2026-10-10):** every finding below now carries `fixed`,
`skipped (reason)` or `needs-owner-decision`. Where a status line adds detail it
starts with **Phase 2:**. Line numbers in the findings refer to commit `586ecfc`
and have moved since. The "After Phase 2" section at the end has the new
baseline, what was verified in a browser, and what is left for you to decide.

## Baseline

| Check | Result |
|---|---|
| `npx tsc -b` | clean |
| `npm test` | 13 files, 182 passed, 1 skipped (`real-save.test.ts`, needs a private fixture) |
| `npm run lint` | 0 errors, 1 warning: `src/App.tsx:92` unused `eslint-disable` (`react-hooks/set-state-in-effect`) |
| `npm run build` | OK. Warning: `index-*.js` is 1,242.78 kB (299.41 kB gzip), over the 500 kB limit. CSS 94.31 kB |
| `npm run validate-data` | passed, no warnings |
| `npx knip` | 4 unused files, 28 unused exports, 28 unused types, 2 unlisted dependencies (`sharp`, `geojson` types). Details under Low |

## Summary

| Severity | Count | Themes |
|---|---|---|
| Critical | 2 | "Restart server" button takes sync down; iOS offline data has no durable copy |
| High | 10 | Generated data is from current games, not Gen III/IV (types, stats, abilities, moves); damage-calc and catch-calc formula errors; Routes checkbox; baby availability; HM planner |
| Medium | 21 | Sync edge cases, server hardening, generation mix-ups, silent failures |
| Low | 24 | Dead code, duplication, docs drift, accessibility |
| Nit | 8 | |

---

## Critical

### C1. "Restart server" button stops the sync server until the container is restarted by hand — `fixed`
- **Phase 2:** button and `/api/restart` removed (your decision); the entrypoint now runs Node in a restart loop, so a crash recovers.
- **Where:** `sync-server/server.js:123-129`, `src/components/layout/Header.tsx:32-68` (rendered at `:190`), `docker-entrypoint.sh:11-14`.
- **What:** `POST /api/restart` calls `process.exit(0)`. In the published image, Node is a background child of the entrypoint shell (`node … &`) and nginx is PID 1 (`exec "$@"`). Docker's restart policy only reacts when PID 1 exits, so nothing brings Node back. The header shows the button to every desktop user, including in offline mode.
- **Failure:** click the ↻ button, confirm → the page reloads after 8 s, and from then on `/health`, `/api/login`, `/api/pull` and `/api/push` return 502 for every device. New devices cannot sign in. It stays that way until someone restarts the container in TrueNAS. The same happens if Node ever crashes on its own.
- **Also wrong:** the code comment and README ("makes the server process exit so the container restarts", "brings up the new image") describe behaviour the image doesn't have; a restart would not pull a new image anyway.
- **Fix (pick one, owner decision — it removes or changes a user-facing button):** (a) remove the button and the endpoint; or (b) keep them and make the entrypoint supervise Node (restart loop), or exit the container when Node exits so the restart policy applies. Either way add a restart loop/`wait` so a Node crash recovers.
- **Behaviour change:** yes.

### C2. iOS app in offline mode: tracker data has no durable copy and the export buttons probably do nothing — `skipped (you don't use offline mode on iOS)`
- **Phase 2:** nothing changed in the app. The README no longer claims the data is kept in iOS preferences and says to sign in on iOS if the data matters. Still true if anyone else uses the IPA offline.
- **Where:** `src/lib/sync.ts:46-58` (`initStorage`), `src/lib/backup.ts:79-87` (`triggerDownload`), `src/components/settings/SettingsTab.tsx:124-135`.
- **What:** `sync.ts` says in its own comment that iOS can wipe WKWebView `localStorage` after a SideStore/AltStore update, and mirrors three keys to Capacitor Preferences to survive that: token, server URL, offline flag. The tracker marks, designer slots, box slots and save profiles (all Zustand `persist` in `localStorage`) are not mirrored. Backup export uses `<a download>` on a blob URL, which WKWebView does not treat as a download, and the project has no Filesystem/Share plugin.
- **Failure:** offline-mode user on the iOS app updates through SideStore → storage is wiped → `initStorage` restores "offline mode" → the app opens with an empty tracker and there is no server copy. The one safety net (Export JSON) likely never produced a file on that device. Signed-in users get their marks back from the server but lose device-local data.
- **Not verified:** I can't run the IPA. The wipe is the code's own claim; the export behaviour is standard WKWebView behaviour.
- **Fix (owner decision):** mirror the persisted stores to Preferences (it is already a dependency) and restore them in `initStorage`; make export work on native (needs a Capacitor plugin = new dependency, or a copy-to-clipboard/"show JSON" fallback without one). README line "data lives in browser storage (and iOS preferences in the app)" is currently not true for the data itself.
- **Behaviour change:** yes (adds durability).

---

## High — wrong results users will see

### H1. Pokémon types are from current games: 20 species are Fairy — `fixed`
- **Phase 2:** data regenerated from PokéAPI `past_types`; `validate-data` rejects `fairy`; removed from `type-colors.ts` and the search parser.
- **Where:** `scripts/fetch-data.ts:710-712` (`pokemon.types` from the live API, no `past_types`); data in `public/data/pokemon.json`.
- **Verified by running:** Clefairy `["fairy"]`, Togepi `["fairy"]`, Marill `["water","fairy"]`, Gardevoir `["psychic","fairy"]`, Mawile `["steel","fairy"]`, Azurill `["normal","fairy"]`. Affected lines: Clefairy/Clefable/Cleffa, Jigglypuff/Wigglytuff/Igglybuff, Togepi/Togetic/Togekiss, Marill/Azumarill/Azurill, Snubbull/Granbull, Mr. Mime/Mime Jr., Ralts/Kirlia/Gardevoir, Mawile.
- **Failure:** type badges show Fairy in a Gen III/IV app; the damage calc's chart (`src/lib/damage-calc.ts:20-38`) has no Fairy, so Fighting vs Clefable shows 1× instead of 2× and Normal STAB is missed; tracker search for `fairy` returns results.
- **Fix:** use PokéAPI's past-type data (generation ≤ IV) in `fetch-data.ts`, regenerate, add a `validate-data` check that no type is `fairy`. Then `fairy` can be dropped from `type-colors.ts` and `pokemon-search.ts`.
- **Behaviour change:** yes (data correction).

### H2. Base stats are from current games — IV calculator and stat displays are wrong for the changed species — `fixed`
- **Phase 2:** `past_stats` applied (44 species changed); `validate-data` spot-checks known Gen IV values.
- **Where:** `scripts/fetch-data.ts:754-764`.
- **Verified by running:** Butterfree Sp. Atk 90 (Gen IV: 80), Pidgeot Speed 101 (91), Alakazam Sp. Def 95 (85), Raichu Speed 110 (100), Roserade Defense 65 (55), Staraptor Sp. Def 60 (50), Farfetch'd Attack 90 (65), Cresselia Def/Sp. Def 110/120 (120/130). Several dozen Gen I–IV species were changed in later generations.
- **Failure:** enter a real Pidgeot's Speed in Designer → IV Checker: the inferred IV is wrong or "No valid IVs found". Stat totals in Designer, the damage calc (designer/custom sources), the save card (`MonCard.tsx:87-95`) and the Pokédex bars are off for these species.
- **Fix:** apply PokéAPI's past-stats data for generation ≤ IV during generation; add a few known Gen IV values to `validate-data` as a guard.
- **Behaviour change:** yes (data correction).

### H3. Abilities are from current games — `fixed`
- **Phase 2:** `past_abilities` applied, hidden abilities and abilities introduced after Gen IV dropped (447 species changed). Not done: the Pokédex still lists a Gen IV ability (e.g. Clefable's Magic Guard) while Gen 3 is selected — see "Left to decide".
- **Where:** `scripts/fetch-data.ts:745-752`.
- **Verified by running:** Gengar's only ability is `cursed-body` (it has Levitate in Gen III/IV — `fetch-save-tables.ts:153-154` already special-cases this for saves). Every species also lists its hidden ability (introduced in Gen V), shown in the Pokédex and offered in the Designer ability dropdown (`StatBlock.tsx:115-119`).
- **Failure:** Designer can't select Levitate for Gengar, so the damage calc treats Earthquake as hitting it; hidden abilities appear as options in a Gen III/IV tool.
- **Fix:** use past-ability data, drop `isHidden` entries and abilities with id > 123 (> 76 for Gen III views).
- **Behaviour change:** yes (data correction). **Question:** do you want hidden abilities shown at all?

### H4. Move power, accuracy, PP and type come from the current games — `fixed`
- **Phase 2:** `moveForVersionGroup()` reads `past_values`; used by the Pokédex tables, Attackdex, Designer and damage calc. Unit test with recorded responses. Verified in the browser: Thunderbolt shows 95.
- **Where:** `src/lib/move-fetch.ts:131-150`, `src/lib/attackdex-fetch.ts:27-70`, used by the Pokédex move tables, Attackdex, Designer move grid and `src/lib/move-lookup.ts:33-52` (damage calc).
- **What:** the code reads `power`, `accuracy`, `pp`, `type` from the top level of PokéAPI's `/move/{slug}`, which is the latest generation. The response's `past_values` (per version group) is ignored.
- **Failure:** the Gen IV damage calc uses Thunderbolt/Flamethrower/Ice Beam/Surf at 90 (95 in Gen IV), Hydro Pump/Fire Blast/Blizzard/Thunder at 110 (120), Draco Meteor/Overheat/Leaf Storm at 130 (140), Knock Off 65 (20), Giga Drain 75 (60), and so on. Charm, Moonlight and Sweet Kiss show as Fairy.
- **Fix:** resolve the value for the selected version group from `past_values` (falling back to the current value). The functions already know the version group in most call sites; the damage calc is Gen IV.
- **Behaviour change:** yes (correction). Worth a unit test with a recorded response.

### H5. Damage calc: Doubles + Reflect/Light Screen always gives 0 damage — `fixed`
- **Phase 2:** exact 2/3 as a fraction; test added. Browser: Doubles + Light Screen gives 54.5–65.5 %, not 0.
- **Where:** `src/lib/damage-calc.ts:241-242`: `isSingles ? 0.5 : floorDiv(2, 3)` — `floor(2/3)` is 0. Reachable from `CalcFieldPanel.tsx:70-71,110-119` via `DamageCalcTab.tsx:38-47`.
- **Failure:** set Format = Doubles, turn on Reflect on the defender's side → every physical move shows no damage (the result strip disappears because all maxima are 0).
- **Fix:** use `2 / 3`. Add a test.
- **Behaviour change:** yes (bug fix).

### H6. Routes tab: the "caught" checkbox doesn't update, and a second click doesn't undo it — `fixed`
- **Phase 2:** subscribes to the caught list and goes through `toggleWithUndo`. Browser: checkbox, "1/6 caught" badge and Undo all update.
- **Where:** `src/components/route-info/RouteInfo.tsx:267-268` (`useDexStore((s) => s.isCaught)` selects a function whose identity never changes), `:410` (memo depends on it), `:518` (`setCaught(row.pokemonId, !caught, …)`).
- **Verified by running** (dev server, offline mode, Gen 3, Route 101): clicking "Mark Poochyena as caught" changed the store (`caughtByGen` → `{"3":[261]}`) but the checkbox stayed unchecked, the header stayed "0/6 caught" and no Undo toast appeared. Clicking again does nothing (it re-sends `true` from the stale closure). After switching tabs and back the checkbox was checked, but the "0/6 caught" badge was still stale.
- **Fix:** subscribe to the data (`caughtByGen[activeGeneration]`) instead of the getter, and route the change through `toggleWithUndo` as CLAUDE.md requires.
- **Behaviour change:** yes (bug fix; adds the Undo toast).

### H7. Breedable babies are shown as unobtainable in Gen 3 and under HeartGold/SoulSilver — `fixed`
- **Phase 2:** condition removed; test with a baby that has an encounter in another game.
- **Where:** `src/hooks/usePokemonFilter.ts:60-70` — the breeding rule requires `p.encounters.length === 0`, which counts encounters in every game of every generation.
- **Verified by running** `computeAvailability` on the real data: Gen 3, all games → Pichu, Cleffa, Igglybuff, Tyrogue, Smoochum, Elekid, Magby, Azurill are not obtainable. HG+SS → Pichu, Cleffa, Igglybuff, Smoochum, Elekid, Magby, Wynaut, Bonsly, Mime Jr., Happiny, Munchlax, Mantyke. Gen 4, all games → Wynaut.
- **Failure:** in the default "Obtainable" mode these are dimmed, and they are missing from the per-game "obtainable" totals in the progress breakdown, although `AvailabilityHelp.tsx:14` says babies you can breed from an obtainable evolution are included.
- **Fix:** drop the `encounters.length === 0` condition (the `!obtainable.has(p.id)` check already covers "has no encounter in the selected games"). The existing fixture test only uses a baby with no encounters at all; add one with an encounter in another game.
- **Behaviour change:** yes (bug fix). The "Needs attention" mode is unaffected.

### H8. HM planner lists Pokémon that can't learn the HM in Gen III/IV — `fixed`
- **Phase 2:** candidates are checked against the selected version group's machine learnset.
- **Where:** `src/components/pokedex/HmPlannerPanel.tsx:86-101`.
- **What:** results are the intersection of PokéAPI's `learned_by_pokemon`, which covers every generation and every learn method, filtered only by `id <= genMax`. The version selector only changes which HMs are listed. `MoveComboPanel.tsx:83-89` solves the same problem with a second pass against the per-version learnset, and its comment names the reason ("Gligar + Rock Climb in Gen IV").
- **Failure:** pick Flash, Defog or Strength → Pokémon that only learn the move as a later-generation TM/tutor/egg move appear as HM carriers.
- **Fix:** reuse the Move Combo validation pass (filter by the selected version group's learnset, method `machine`).
- **Behaviour change:** yes (bug fix).

### H9. Catch calculator: Nest Ball and Quick Ball use Gen V+ numbers; Dive and Repeat Ball are always "on" — `fixed`
- **Phase 2:** confirmed against Bulbapedia (via search; the site blocks direct fetches): Nest `(40 − level)/10`, Quick 4×. Dive and Repeat are behind checkboxes. Tests for `getDynamicBallBonus`.
- **Where:** `src/lib/catch-rate.ts:47,154-157` (Nest), `:51,173-175` (Quick), `:45,49` (Repeat, Dive); `CatchCalculator.tsx:64-74`.
- **What:** Nest Ball is `(41 − level) / 10` here; Gen III/IV use `(40 − level) / 10` (min 1). Quick Ball is 5× here; Gen IV is 4× (5× from Gen V). Dive Ball is a fixed 3.5× and Repeat Ball a fixed 3× with no toggle, although both are conditional; `getDynamicBallBonus` has an `inWater` option nothing passes.
- **Failure:** level 20 target, Nest Ball → 2.1× shown, 2.0× in game; Quick Ball turn 1 → 5× shown, 4× in game; Dive Ball on land → 3.5× shown, 1× in game.
- **Fix:** correct the two constants and notes; add "surfing/fishing" and "already registered" toggles (or make them 1× by default with a note). Please confirm against Bulbapedia before I change numbers — I'm confident of both but they are from memory. Add tests for `getDynamicBallBonus` (it has none).
- **Behaviour change:** yes.

### H10. Damage calc: three damaging Battle Tower moves never resolve and show no damage — `fixed`
- **Phase 2:** alias table for the Gen IV spellings; unresolved moves say "Move not found". Test: every Battle Tower move name resolves.
- **Where:** `src/lib/move-lookup.ts:16-30`.
- **Verified by running** the slug conversion over all 297 move names in `battle-tower-sets.json` against the move names in `save-tables.json`: "Hi Jump Kick" → `hi-jump-kick` (PokéAPI: `high-jump-kick`), "Faint Attack" → `faint-attack` (`feint-attack`), "Selfdestruct" → `selfdestruct` (`self-destruct`); also the status moves "Softboiled" and "SmokeScreen". 17 of 699 sets are affected. The file's own doc comment gives "hi-jump-kick" as a correct example.
- **Failure:** load one of those sets (from Trainer Lookup or the Battle Tower list) → the move keeps power 0 and is silently left out of the results.
- **Fix:** a small alias table for the Gen IV spellings; show "move not found" instead of hiding the row. Test: every tower move name resolves.
- **Behaviour change:** yes (bug fix).

---

## Medium — latent bugs, sync and edge cases

### M1. Damage formula applies modifiers in the wrong order — `fixed`
- **Phase 2:** rewritten in the Gen IV order with exact fractions; tests use hand-computed values (the rain case is now 54). Browser: Ampharos Thunderbolt vs Articuno gives 134–162, matching a hand calculation.
- **Where:** `src/lib/damage-calc.ts:248-300`; test `src/lib/__tests__/calculators.test.ts:88-93` encodes the current order.
- **What:** Gen IV is `floor(floor(floor(2L/5+2) × Power × Atk / Def) / 50)` × Mod1 (burn, screens, doubles, weather) **then** `+ 2`, then crit, Mod2 (Life Orb), **the random roll**, STAB, type, Mod3 (Expert Belt). The code adds 2 first, applies weather after it, and applies the random roll last. Type-boost items and Muscle Band/Wise Glasses are applied to final damage; in Gen IV they modify base power.
- **Failure:** results are off by 1–2 HP in many cases. The test's rain example expects 55 where the game gives 54. Borderline "Guaranteed OHKO/2HKO" labels can be wrong.
- **Fix:** reorder to the documented Gen IV sequence and update the tests with hand-computed values.
- **Behaviour change:** yes (small numeric changes).

### M2. Tracker keyboard shortcuts fire on every tab — `fixed`
- **Where:** `src/hooks/useKeyboardShortcuts.ts:19-78`, mounted in `Layout.tsx:100`; tabs stay mounted (`App.tsx:180-193`).
- **Failure:** on Designer or Damage Calc with focus outside an input, Shift+C toggles "caught" for whatever is selected in the hidden Tracker tab (an Undo toast does appear); Shift+arrows move the hidden selection; `?` opens a dialog you can't see.
- **Fix:** ignore the events unless `activeTab === "tracker"`.
- **Behaviour change:** yes (bug fix).

### M3. PC-box "Slot layout": after switching generation the boxes shown belong to a game of the other generation — `fixed`
- **Where:** `src/components/pc-box/PcBoxLayout.tsx:21,38-42,57,81-87`.
- **What:** `gameBoxes` reads `slotsByGen[gen][selectedGame]`, but the selector and all writes use `currentGame` (which falls back to `games[0]` when `selectedGame` isn't in the active generation).
- **Failure:** view slots in Gen 3 (Ruby), switch to Gen 4 in Settings, come back → the Diamond button is highlighted but the grid reads `slotsByGen[4]["ruby"]` (empty). Assign a Pokémon → it is saved under Diamond and doesn't appear until you click a game button.
- **Fix:** read with `currentGame`.
- **Behaviour change:** yes (bug fix).

### M4. Opening a Designer slot counts as an edit, which can overwrite another device's newer Designer changes — `fixed`
- **Phase 2:** inferred IVs are written only when they change.
- **Where:** `src/components/designer/IvSection.tsx:139-147` (effect writes `inferredIVs` on mount and on every range change, no equality check) → `useDesignerStore.updateSlot` always creates a new `slots` array → `src/lib/sync.ts:144` stamps the `designer` section with `Date.now()`.
- **Failure:** device B edits a team at 10:00:00 and pushes. Device A, which hasn't polled yet, merely opens a slot at 10:00:10. A's section stamp is now newer, so on its next sync `mergePayload` keeps A's stale Designer data and pushes it; B then accepts it and loses its edit. It also causes a push every time a slot is opened.
- **Fix:** only call `onUpdate` when the inferred values differ from what is stored (or derive `inferredIVs` instead of storing it). Test at the store/sync level: opening must not change `sectionUpdatedAt`.
- **Behaviour change:** no user-visible change; removes spurious writes.

### M5. Designer "Evolve" can turn a slot into a Pokémon that doesn't exist in the app — `fixed`
- **Phase 2:** evolutions above #493 are dropped in the data pipeline (`validate-data` checks), and the Designer and detail panel filter by the active generation. Browser: Primeape has no Evolve button.
- **Where:** `src/components/designer/DesignerPanel.tsx:142,178-181`; data: `evolvesTo` contains 15 post-Gen-IV evolutions.
- **Verified by running** (data): Primeape→Annihilape, Dunsparce→Dudunsparce, Stantler→Wyrdeer, Ursaring→Ursaluna, Girafarig→Farigiraf, Qwilfish→Overqwil, Corsola→Cursola, Farfetch'd→Sirfetch'd, Mr. Mime→Mr. Rime, Linoone→Obstagoon, Meowth→Perrserker, Wooper→Clodsire, Sneasel→Sneasler, Scyther→Kleavor, Eevee→Sylveon.
- **Failure:** Designer slot with Primeape → click Evolve (single evolution, no picker) → `pokemonId` becomes 979 → the slot renders as empty and the panel says "Select a slot above to start designing". In Gen 3 mode the button also offers Gen IV evolutions.
- **Related:** `DetailPanel.tsx:51` shows "↑ Evolves" for the same species, and the evolution chains show Gen IV evolutions in Gen 3 mode.
- **Fix:** filter `evolvesTo` by the generation's max id in the Designer and the detail panel; better, drop evolutions with `speciesId > 493` in `fetch-data.ts`.
- **Behaviour change:** yes (bug fix).

### M6. "Showdown" copy button does nothing on a plain-HTTP deployment — `fixed`
- **Phase 2:** `lib/clipboard.ts` falls back to `execCommand` and reports failure. Browser: "Copied ✓" on a real click.
- **Where:** `src/components/designer/DesignerPanel.tsx:127-134`.
- **What:** `navigator.clipboard` is undefined outside secure contexts. The documented install is `http://<NAS-IP>:7777`.
- **Failure:** click Showdown on the LAN URL → uncaught TypeError, nothing copied, no message.
- **Fix:** guard and fall back (hidden textarea + `execCommand("copy")`, or show the text to copy); catch rejections.
- **Behaviour change:** yes (bug fix).

### M7. Routes list mixes both generations when no game is selected — `fixed`
- **Phase 2:** browser: Gen 3 with no game selected lists 256 areas (was 559).
- **Where:** `src/components/route-info/RouteInfo.tsx:62-69`, `src/hooks/useRouteIndex.ts:131-135`; counts at `RouteInfo.tsx:401-410`, `HGSSMap.tsx:38-49`, `SinnohMap.tsx:28-39`.
- **Verified by running:** Gen 3, "All" games → "559 areas", including Route 201, Eterna Forest and Ilex Forest; opening Route 201 shows "No encounter data for selected games".
- **Also:** the "x/y caught" badge and map tooltips count species from versions that aren't displayed (e.g. FireRed species on a Kanto route while viewing HG/SS with no filter).
- **Fix:** when `activeGames` is empty, index only the active generation's versions.
- **Behaviour change:** yes (bug fix).

### M8. nginx rate limit is lower than normal sync traffic — `fixed`
- **Phase 2:** login 10/min, pull/push 120/min burst 40, `Access-Control-Max-Age` on the server. **Not tested locally** — Docker isn't installed on this machine; the image build now runs `nginx -t`, so a bad config fails the build. Not done: using the forwarded address behind a proxy (needs to know which proxy to trust).
- **Where:** `nginx.conf:1-4,32-33` (10 requests/minute, burst 5, per client IP).
- **What:** one sync is a pull plus a push (2 requests); the poll adds 2/minute; the comment itself says "at most 1 push every 2 s", which is already 3× the limit. In the iOS app every call is cross-origin with an `Authorization` header, so each also sends a CORS preflight (the server sends no `Access-Control-Max-Age`): 4 requests per sync. Behind a reverse proxy or Cloudflare tunnel, `$binary_remote_addr` is the proxy, so all devices share one bucket.
- **Failure:** mark a dozen Pokémon over a minute (or use two devices) → 503s → "Sync failed — retrying…", and the retry only comes with the next 30 s poll. Nothing is lost locally. Reasoned from the config, not observed.
- **Fix:** keep the strict limit for `/api/login` only; give pull/push a much higher rate (e.g. 60 r/m, burst 20); add `Access-Control-Max-Age` on the server; use the forwarded address when behind a proxy.
- **Behaviour change:** config only.

### M9. Backup restore (and sync apply) accept shapes that break the app until reload, or permanently — `fixed`
- **Phase 2:** `normalizeSlots()` on every path in; `validateBackup` checks `boxSlots`, `designer`, `saveSummaries`. Tests for a 30-slot backup and malformed sections.
- **Where:** `src/lib/backup.ts:210-255` (validates only tracker records and `ivChecker.savedSessions`), `:176-188`; `src/store/useDesignerStore.ts:148` (`setSlots` stores as-is; padding to 90 and default-filling only happens in `persist.merge` on load); `src/lib/sync-merge.ts:95` (`.every` on a non-array).
- **Failure:** restore an older backup with 30 Designer slots → boxes 2–3 are empty arrays until the page is reloaded; clearing or pasting into a missing index creates holes and throws. A file with a malformed `boxSlots` or `designer` is persisted and can crash the tab on every load (single app-wide error boundary).
- **Fix:** normalise in one place (`setSlots` pads/defaults like `merge` does) and validate `boxSlots`/`designer`/`saveSummaries` shapes in `validateBackup`. Tests for a 30-slot backup and malformed sections. No format change.
- **Behaviour change:** rejects malformed files it used to accept.

### M10. Login: non-ASCII credentials cause a 500 with a stack trace; passwords are compared on the first 128 characters only — `fixed`
- **Phase 2:** SHA-256 digests compared; JSON error handler; `NODE_ENV=production`. Checked with a scripted login: a long non-ASCII password works, its first 128 characters alone do not.
- **Where:** `sync-server/server.js:54-58,83-92`; `Dockerfile` (no `NODE_ENV=production`).
- **What:** `safeCompare` pads to 128 UTF-16 units and then builds UTF-8 buffers, so any multi-byte character makes the buffers different lengths and `timingSafeEqual` throws. Express's default handler then returns the stack trace (also for malformed JSON and bodies over 4 MB) because `NODE_ENV` isn't `production`. `.slice(0, 128)` means two passwords sharing their first 128 characters are equal.
- **Failure:** username `é` at the login screen → HTTP 500 with file paths in the body. A password containing `é` set in `APP_PASSWORD` can never be used.
- **Fix:** compare SHA-256 digests of both values with `timingSafeEqual` (fixed length, no truncation, still constant-time); require string inputs; add an error-handling middleware returning `{ error }`; set `NODE_ENV=production` in the image.
- **Behaviour change:** error responses only.

### M11. HeartGold/SoulSilver saves probably fail the checksum check — `fixed`
- **Phase 2:** confirmed with your SoulSilver save: the footer is 0x10 bytes and has no link field. The save now reads (17 Pokémon). HGSS is no longer flagged unverified; an optional real-save test runs when the fixture is present (git-ignored).
- **Where:** `src/lib/save/gen4.ts:25,108-113` (one `FOOTER_SIZE = 0x14` for all families).
- **What:** as far as I know the HGSS block footer is 0x10 bytes, not 0x14. The size and CRC fields happen to sit at the same absolute offsets, but the CRC would cover 4 more bytes than the code sums, so every real HGSS save would be rejected with "The save's checksums don't match", and `link` would be read from data bytes. HGSS is already documented as unverified and the synthetic tests build saves with the same assumption.
- **Confidence:** about 70 %. I did not copy from PKHeX; this is from memory of the format.
- **Fix:** verify against a real HG/SS dump (or the Project Pokémon documentation) and make the footer size per-family. **Question:** do you have an HG/SS save to test with?
- **Behaviour change:** only for HGSS files.

### M12. Daily checklist bypasses Undo — `fixed`
- **Where:** `src/components/tracker/DailyChecklist.tsx:15-18,125` (calls `useDexStore.toggleCaught` directly; CLAUDE.md: "Don't call the store's toggle functions directly from UI code").
- **Fix:** use `toggleWithUndo`. (The Routes checkbox has the same problem — H6.)
- **Behaviour change:** adds the Undo toast.

### M13. Damage calc field controls that do nothing — `fixed`
- **Phase 2:** implemented (your decision): Stealth Rock and Spikes damage on switch-in, sandstorm/hail chip and the Rock Sp. Def boost, and a larger set of abilities and items. KO labels take hazards and weather into account.
- **Where:** `src/components/damage-calc/CalcFieldPanel.tsx:95-108,128-141` and `:9-10`; `src/store/useBattleCalcStore.ts:10-13`.
- **What:** Stealth Rock and Spikes toggles are stored but never read by any calculation. Sand and Hail change nothing (no Rock Sp. Def boost, no chip damage). Only Levitate, Thick Fat, Wonder Guard, Intimidate and Adaptability are modelled; Battle Tower sets load with no ability at all (`CalcPokemonPanel.tsx:49`).
- **Question:** implement entry-hazard/weather effects, or remove the controls?

### M14. iOS: a failed Preferences read leaves a permanent blank screen — `fixed`
- **Where:** `src/App.tsx:80-89` (`initStorage().then(...)`, no `catch`/`finally`); `storageReady` gate at `:122`.
- **Failure:** if `Preferences.get` rejects (plugin not linked, storage error) the promise rejects, `storageReady` stays false and the app renders nothing. The committed `ios/App/CapApp-SPM/Package.swift` doesn't list the Preferences plugin; CI's `npx cap sync ios` regenerates it, so the built IPA is probably fine — the committed file is just stale.
- **Fix:** set `storageReady` in a `finally`.
- **Behaviour change:** no (robustness).

### M15. Data generation can silently drop Pokémon, and validation wouldn't notice — `fixed`
- **Phase 2:** any failed fetch fails the run; `validate-data` checks 493 entries, types, stats, abilities and evolutions.
- **Where:** `scripts/fetch-data.ts:455-483` (`Promise.allSettled`, failures only logged); `scripts/validate-data.ts` (checks encounters only).
- **Failure:** PokéAPI returns a 5xx for #212 during a run → `pokemon.json` has 492 entries, `meta.totalPokemon` is 492, validation passes.
- **Fix:** fail the run on any rejected fetch; `validate-data` asserts 493 entries with ids 1–493, non-zero base stats, known types, and no `evolvesTo` beyond 493. This is also where the H1–H3 guards go.
- **Behaviour change:** script only.

### M16. Designer and Damage Calc disagree on unknown IVs; clearing an IV stores 0 — `fixed`
- **Phase 2:** unknown IVs count as 0 in both places (your decision); an emptied IV box is "unknown" again.
- **Where:** `src/components/designer/StatBlock.tsx:42` (unknown IV → 15) vs `src/lib/calc-from-designer.ts:28` (→ 31); `StatBlock.tsx:61-64` (`parseInt("") || 0`).
- **Failure:** a slot with no IV data shows one Speed in Designer and a higher one after "Load from Designer". Deleting the number in an IV box sets a confirmed IV of 0 instead of "unknown".
- **Fix:** one shared default (owner's choice: 31 is the usual planning assumption); empty input → `null`.
- **Behaviour change:** yes.

### M17. Two devices importing different saves before syncing: one import disappears — `fixed`
- **Phase 2:** saves merge per profile with tombstones for removals; device data for removed profiles is deleted. Tests added. The payload gained an optional `saveSummaries.removed`; older clients ignore it.
- **Where:** `src/lib/sync-merge.ts:116-129` (`saveSummaries` is last-write-wins as a whole), `src/store/useSaveStore.ts:186-195` (`replaceAll`).
- **Failure:** import Platinum on the PC and SoulSilver on the phone within the same poll window → the later stamp wins and the other profile vanishes from the list on both devices. Its raw file, parsed save, history and revert point stay in IndexedDB on the importing device, orphaned (about 1 MB per save), because `replaceAll` never deletes storage for profiles that are gone.
- **Fix:** merge `saveSummaries` per profile id (newer `importedAt` wins; removals need a tombstone or the existing section stamp); delete or keep-and-reattach orphaned device data. The payload shape can stay the same.
- **Behaviour change:** yes (merge behaviour). Needs tests.

### M18. Save import: silent storage failures and no size check — `fixed`
- **Phase 2:** a notice when the save couldn't be stored; files over 2 MB are refused before reading.
- **Where:** `src/store/useSaveStore.ts:154-159` (every IndexedDB write ends in `.catch(() => {})`), `src/components/saves/SavesView.tsx:125-145`.
- **Failure:** quota exceeded or private mode → the import looks fine; after a reload the profile is listed with no Pokémon ("imported on another device"). Picking a `.nds` ROM by mistake reads the entire file (up to hundreds of MB) into memory before it is rejected.
- **Fix:** surface a "couldn't store this save on the device" notice; check `file.size` before reading.
- **Behaviour change:** adds messages.

### M19. Evolution chain in the tracker detail panel drops stages after a branch — `fixed`
- **Phase 2:** the chain is rebuilt to follow every branch and is limited to the active generation.
- **Where:** `src/components/detail-panel/EvolutionBadge.tsx:84-101` (the comment says "skip branches for now"; the `visited` set is never written to).
- **Failure:** open Beautifly or Dustox → the chain shows Wurmple → Silcoon, Cascoon and does not include the Pokémon you opened. The Pokédex tab has a second, correct implementation (`pokedex/EvolutionChain.tsx`).
- **Fix:** use the Pokédex tab's component in both places.
- **Behaviour change:** yes (display).

### M20. Great Marsh banner adds Pokémon that aren't Great Marsh encounters — `fixed`
- **Phase 2:** the four hand-added entries are removed (your decision); the banner shows only what PokéAPI lists.
- **Where:** `src/data/great-marsh.ts:17-23`, used by `GreatMarshBanner.tsx:59-67`.
- **What:** Bonsly, Mime Jr., Munchlax and Kangaskhan are added by hand with "approximate" rates. The file header says they are unverified and that PokéAPI's ROM data doesn't list them; the comment directly above the list says "Verified missing". Munchlax is a honey-tree Pokémon and Bonsly/Mime Jr. are Trophy Garden Pokémon. CLAUDE.md: "Don't add placeholder overrides".
- **Question:** remove the four extras?

### M21. README security statements that aren't true — `fixed`
- **Where:** `README.md` "Exposing to the internet" ("The nginx Basic Auth login prompt (`NGINX_USER` / `NGINX_PASSWORD`) protects the site…" — there is no Basic Auth; the SPA and `pokemon.json` are public, only the API needs the token); TrueNAS step 2 and `.env.example:13-16` ("CORS … defaults to `*`" / "Leave blank to allow all origins" — the server defaults to `http://localhost:5173` plus `capacitor://localhost`); "`POST /api/restart` … so the container restarts" (see C1).
- **Fix:** correct the text.

---

## Low — dead code, duplication, docs, accessibility

### Server and deployment
- **L1.** `/api/login` hands the shared `SYNC_TOKEN` to the browser (by design, documented in README). Flagged as requested: the token never rotates, signing out doesn't invalidate it, and anyone who has ever signed in keeps access until the env var is changed. No redesign proposed.
  - **Phase 2:** `skipped (by design, as the finding says)`
- **L2.** `nginx.conf:44-55`: `add_header` inside the asset and `pokemon.json` locations drops the server-level security headers for those responses (nginx inheritance). The `\.(js|css|png|svg|ico|woff2?)$` rule also gives un-hashed files (`/favicon.svg`, `/icons.svg`, `/maps/hgss-johto-kanto.png`) a one-year immutable cache. HSTS is sent even though the comment says to enable it later (harmless over HTTP).
  - **Phase 2:** `fixed` — security headers are an include used in every location; only `/assets/` (hashed files) is immutable. HSTS is still sent (ignored by browsers over plain HTTP). Not tested locally (see M8).
- **L3.** `Dockerfile`: container runs as root; `sync-server` dependencies are installed with `npm install` and no lockfile (not reproducible). `sync-server/Dockerfile` isn't used by any workflow. `docker-compose.yml:9` comment mentions only `SYNC_TOKEN`.
  - **Phase 2:** `fixed` in part — lockfile added and the image uses `npm ci`; compose comment corrected. `skipped`: running as non-root (nginx binds port 80 and `/data` ownership on TrueNAS would need care) and the unused `sync-server/Dockerfile` (kept in step, not removed).
- **L4.** `sync-server/server.js:109-121`: push accepts any object including arrays; no `fsync` before rename. Concurrent pushes are serialised by the synchronous write and clients converge through pull-merge-push, so this is fine in practice.
  - **Phase 2:** `fixed` — arrays are rejected. `skipped`: `fsync` (the finding itself says it is fine in practice).
- **L5.** `index.html:12-13`, `public/robots.txt`, `public/sitemap.xml` hard-code `pokedex.shrumslab.com` and invite indexing; anyone else's deployment advertises your domain. **Question:** intended?
  - **Phase 2:** `needs-owner-decision` — left as it is.

### Sync and stores
- **L6.** `useSyncEngine.ts:58-64`: the 30 s poll is skipped while any input/select is focused, so a desktop tab left with the cursor in the search box stops receiving remote changes until focus moves or the tab is re-shown.
  - **Phase 2:** `fixed` — at most two polls are skipped while typing.
- **L7.** `useDexStore.ts:220-248` (the `setTimeout` lead): **safe**. The delay is needed because the store constant isn't assigned yet during synchronous rehydration, and nothing can run before a 0 ms timer that matters (the first sync awaits the network). Minor: migrated marks get no timestamps (handled by the merge's "no timestamp = 0, mark wins on tie"), and the comment "no data loss" isn't accurate when gen 3 already has marks (the v1 key is deleted without migrating). **Question:** can the v1 migration be removed by now?
  - **Phase 2:** `fixed` (comments corrected). The migration itself is `needs-owner-decision` and is kept.
- **L8.** `useSettingsStore.ts:76-78,202-205`: the interface comment says `activePokedexId` is not persisted, but `partialize` persists it. `lastAttackdexQuery` is written and never read; `lastAttackdexVersionGroup` is restored at `AttackdexTab.tsx:39-42` and immediately overwritten by the mount effect at `:44-47`. The tab and view-mode lists at `:211,213` duplicate `ALL_TABS` (`App.tsx:26`) and the `ViewMode` type.
  - **Phase 2:** `fixed` — comment corrected; the Attackdex restores its search text and version group; `APP_TABS` / `VIEW_MODES` in `types` are the only lists.
- **L9.** `useIvStore.ts`: `saveSession`/`deleteSession` have no callers anywhere in `src/`; the store is still persisted, synced and backed up. **Question:** is the old IV-checker session list still wanted? (Stored-data field — not touching without your say.)
  - **Phase 2:** `needs-owner-decision` — stored data, untouched. CLAUDE.md now says nothing writes it.
- **L10.** `useBattleCalcStore` is persisted and device-local but missing from CLAUDE.md's store table. `sync.test.ts` covers the persisted-vs-payload check for the stores it lists.
  - **Phase 2:** `fixed` (CLAUDE.md).
- **L11.** Clock skew and stale offline devices can win last-write-wins sections; a tab closed within the 2 s debounce pushes on next open. Inherent to the design; worth one line in the docs.
  - **Phase 2:** `fixed` — one line in the README's sync section.

### iOS
- **L12.** `ios/App/App/Info.plist:52-56`: only `NSAllowsLocalNetworking` is set, so `http://` works for LAN addresses only, while the onboarding screen accepts any `http://` URL and reports "Cannot reach server". PC-box drag-and-drop and the hover-only "clear slot" button have no touch path (`PcBoxSlot.tsx`, `DesignerPcBox.tsx:161-169`).
  - **Phase 2:** `skipped` — needs a device to test; the touch path for PC-box drag and "clear slot" is a feature, not a clean-up.
- **L13.** `apps.json` 1.1 matches `MARKETING_VERSION` 1.1 in both configs; the v1.1 release asset is 1,417,773 bytes, matching `size`. **Fine.**
  - **Phase 2:** no action needed.

### Generation hard-coding (works today for gens 3/4; breaks the "follow `activeGeneration`/meta" rule)
- **L14.** `386`/`493` or `activeGeneration === 4 ? … : …` literals instead of `meta.generations` / `genConfigOf`: `useAttackdex.ts:80`, `HmPlannerPanel.tsx:74`, `MoveComboPanel.tsx:46`, `PokemonAssignPicker.tsx:29`, `DesignerPokemonPicker.tsx:37`, `EvTracker.tsx:165`, `Layout.tsx:139`, `DetailPanel.tsx:40,56`, `PokemonRow.tsx:56`, `PokedexTab.tsx:43,112,118,127,166`, `AttackdexTab.tsx:37,45`, `MoveGrid.tsx:22`, `pokemon-display.ts:5,10`. Real effects: `BoxBrowser.tsx:87` and `MonCard.tsx:48` call `speciesForSlot` without `maxSpecies`, so a Gen III living dex shows ghost Gen IV species in its last box ("this slot belongs to Turtwig"); `todo.ts:104` calls `homeSlot` without the Gen III box count; EV Tracker offers Power items in Gen 3 mode.
  - **Phase 2:** `fixed` — `lib/generation.ts` (`generationMaxId`, `generationVersions`, `pairedVersion`) replaces the literals; the Gen III living-dex and EV Tracker effects are fixed.

### Duplication (consolidate onto the existing helper)
- **L15.** Sprite URL built by hand instead of `Pokemon.spriteUrl` / `getGenSprite`: `EvolutionBadge.tsx:27`, `CalcPokemonPanel.tsx:189`, `TrainerLookupTab.tsx:358`, `CatchCalculator.tsx:145,170`, `DesignerTab.tsx:150`.
  - **Phase 2:** `fixed`.
- **L16.** `towerSetToCalcPokemon` exists twice with drift (`CalcPokemonPanel.tsx:38-61` default category "physical", `TrainerLookupTab.tsx:49-75` "special").
  - **Phase 2:** `fixed` — one `towerSetToCalcPokemon` in `lib/calc-from-tower.ts`.
- **L17.** Near-identical components: `MoveSearchBar.tsx` / `PokemonSearchBar.tsx` (plus the same combobox logic inline in `CatchCalculator.tsx` and `DesignerPokemonPicker.tsx`); `DesignerPokemonPicker.tsx` / `pc-box/PokemonAssignPicker.tsx`; the "unique species on this route / caught count / style" block four times across `HGSSMap.tsx` and `SinnohMap.tsx`; `PokemonRow.tsx:120-141` re-implements `TypeBadge`.
  - **Phase 2:** `fixed` in part — one `shared/PokemonPicker`; the map components are gone. `skipped`: merging `MoveSearchBar`/`PokemonSearchBar` and the `PokemonRow` badge (different markup and behaviour; a rewrite with no bug behind it).
- **L18.** Constants defined twice: `GEN3_PHYSICAL_TYPES` + `getGen3Category` (`move-fetch.ts:29-41` and `attackdex-fetch.ts:4-15`, which also re-fetches the same `/move` endpoint into a second cache); `NATURE_MODS` + `computeStat` in `damage-calc.ts:51-77,343-361` vs `NATURES`/`calcStat`/`calcHPStat` in `iv-calc.ts`; stat-key lists in `stat-calc.ts:14` and `save/mon-search.ts:103` vs `STAT_KEYS`; version pairs in `save/acquire.ts:21` and `scripts/constants.ts:34` vs `meta.generations[].versionPairs`; version-group→games in `AttackdexPanel.tsx:12`; `NpcTradeRow` in `LocationTable.tsx:16` vs `lib/npc-trades.ts`; yes/no token sets in `pokemon-search.ts` and `save/mon-search.ts`; `BACKUP_VERSION` (`backup.ts:49`) unused while `sync.ts:195` hard-codes `2`.
  - **Phase 2:** `fixed`, except `VG_TO_GAMES` in `AttackdexPanel.tsx` and `FAMILY_GAMES` in `save/acquire.ts`, which map different keys (version groups, save families) and are not duplicates of `meta.json`.
- **L19.** Your two leads: `CalcPokemonPanel.tsx:32` `STAT_LABELS` is **not** a drop-in duplicate — it uses the calc's keys (`spa`/`spd`) and short labels, while `iv-calc.ts` uses `spAtk`/`spDef` and long labels. I'd leave it (or rename it to avoid confusion). Local `GAME_ORDER` arrays: `LocationTable.tsx:96` and `RouteInfo.tsx:25` only concatenate the canonical `GEN3_GAME_ORDER`/`GEN4_GAME_ORDER`, which is fine.
  - **Phase 2:** no action needed (as the finding says). The `STAT_LABELS_SHORT` alias is removed.

### Dead code (provably unreachable unless noted)
- **L20.** Unused files: `controls/AvailabilityFilter.tsx`, `controls/DexModeSelector.tsx`, `controls/ProgressBar.tsx` (replaced by inline versions in `FilterSubbar.tsx`). `scripts/merge-stats.ts` + the `merge-stats` npm script (one-time migration for a file that no longer exists; it would write placeholder stats). `src/lib/save/__tests__/demo.ts` is a manual console helper not used by any test — **question:** keep?
  - **Phase 2:** `fixed` — the three components and `merge-stats` are deleted. `demo.ts` kept (`needs-owner-decision`).
- **L21.** Unused code inside files: `src/main.tsx:7-20` (reads a `darkMode` setting that no longer exists and always adds a class `index.html` and `applyTheme` already add); `gen4.ts:147-149` (unreachable branch with the stale message "Gen III saves aren't supported yet"); `HGSSMap.tsx:24-25,134-141,223-228` (coordinate-picker dev helper with `console.log`, disabled by a constant); `TrainerLookupTab.tsx` `!hasData` setup instructions; `FilterSubbar.tsx:81,167` `tab === "tracker"` checks that are always true; `useDesignerStore.duplicateSlot`; `iv-calc.projectStats` + `PROJECTION_LEVELS`; `damage-calc` `autoWeather`, `attackerStatMult` (always 1), `TYPES` export; `EncounterMethod` members `egg` and `rock-climb`; types `Gen1/2/5–9Version`; `scripts/constants.ts` `GEN3_VERSION_IDS`, `GEN4_VERSION_IDS`, `VERSION_PAIRS`; CSS `.scrollbar-none`, `--color-caught*`, and the undefined class `pixelated` used in six components; the other knip-listed exports are internal constants that only need `export` removed.
  - **Phase 2:** `fixed`, except the `egg` / `rock-climb` method names and the `Gen1/2/5–9Version` types, which are `skipped`: they are part of the shared type vocabulary the data and CONTRIBUTING refer to, and removing them gains nothing.
- **L22.** `overrides.json`: `version_exclusive_splits` (45 entries) and `learnset_corrections.*_move_tutors` are never read by `fetch-data.ts`; `learnsetNote` is written onto 5 Pokémon and never read by the app; `_meta.categories` names two categories that don't exist. 83 of 88 gift entries are no-ops by design (gap-fill). `scripts/generate-icon.mjs` relies on `sharp` being a transitive dependency; `geojson` types likewise.
  - **Phase 2:** `fixed` for `_meta`. `skipped`: `version_exclusive_splits`, the move-tutor notes and `learnsetNote` are unread reference data in a hand-maintained file — now labelled as such in `_meta`; say the word and I'll delete them. `sharp` left as a transitive dependency (adding it would be a new dependency).

### Other
- **L23.** `EvTracker.tsx`: vitamins add 10 EVs with no 252/510 check and without the in-game "stat already ≥ 100" rule (`:54-62`); "−" keeps subtracting EVs when the count is already 0 (`:89-94`); removing a log entry uses the multipliers active now. `StatBlock.tsx:19-27` speed-tier labels are wrong for four of seven rows (**verified against the data:** base 115 "Alakazam" is 120; base 95 "Heracross / Marowak" are 85/45; base 90 "Gyarados / Houndoom" are 81/95; base 80 "Lapras / Slowbro" are 60/30). `MovesSection.tsx:37-39` keeps only the lowest level when a move is learned twice. `src/lib/tm-locations.ts` is hand-typed and has at least one error (TM05 Roar in FR/LG listed as "Route 36"); I couldn't check all 960 lines.
  - **Phase 2:** `fixed` — vitamin limits, the minus button, speed-tier labels, Roar's location. `skipped`: `MovesSection` showing only the lowest level (display choice), and the rest of `tm-locations.ts` is still unchecked by hand.
- **L24.** Accessibility: `ShortcutModal`, `PokemonAssignPicker`, `DesignerPokemonPicker`, `MovePicker` and the mobile detail sheet (`Layout.tsx:231-248`) have no `role="dialog"`, focus trap or (some) Escape handling, and icon-only close buttons without labels (`DetailPanel.tsx:80`, `ShortcutModal.tsx:34`, pickers); list-view checkboxes are `<td role="checkbox">` with no keyboard access (`PokemonRow.tsx:168-214`); the sync dot is an 8×8 px button with "tap to retry"; `ThemeSelector` has no label. The Saves dialogs are done properly and can serve as the pattern.
  - **Phase 2:** `fixed` — dialog roles and labels, Escape, labelled close buttons, keyboard-operable list checkboxes, a 24 px hit area for the sync dot, a label on the theme selector. Not done: focus trapping inside the dialogs.

### Docs drift
- **CLAUDE.md** — your leads confirmed: `StatPanel`, `SlotAccordion`, `EvSection`, `PcBoxPanel`, `shared/StatBar`, `shared/NatureSelector`, `MoveDetailPanel` don't exist; the tabs table says `RoutesTab` (it is `RouteInfo`) and `AttackdexPanel` (the tab is `AttackdexTab`), and omits `trainer-lookup`, `damage-calc`, `settings`. Also: no `damage-calc/`, `trainer-lookup/`, `settings/` in the tree; `attackdex/` contents listed are actually in `pokedex/`; `src/data` "genMeta, npc-trades" don't exist; `lib/pokemon-filter.ts` doesn't exist (the logic is in `hooks/usePokemonFilter.ts`); scripts list omits `fetch-battle-tower.ts`, `merge-stats.ts`, `generate-icon.mjs`; `public/env.js` is described as runtime config in the tree and as "no longer read" further down; the lib table calls `gen3.ts` "unverified" while the Save-import section says partly verified; `useBattleCalcStore` missing.
- **README.md** — see M21; also no mention of save import or living dex; "Regional dex — National, Hoenn, and Kanto" (there are five); scripts table omits `generate-save-tables` and `fetch-battle-tower`.
- **CONTRIBUTING.md** — largely describes an earlier app: `iv-checker/`, `SyncIndicator`, `pullSync()/pushSync()` and `/api/sync`, `npc-trades.json`, `patch-slot2.ts`, "~1.2 MB … Compact JSON" (it is 9.5 MB pretty-printed), "version names and IDs for later generations" in `constants.ts`, and a pre-PR checklist without `npm test`.
- `scripts/fetch-data.ts:444` says "~10 min", docs say ~2 and 3–5.
- **Phase 2:** `fixed` — all three documents were brought in line with the code; CONTRIBUTING's structure section now points at CLAUDE.md instead of keeping a second copy.

---

## Nit
- **N1.** `src/App.tsx:92` — the unused `eslint-disable` (your lead; confirmed, safe to delete).
  - **Phase 2:** `fixed`.
- **N2.** `FilterSubbar.tsx:252` — desktop component named `MobileDexModeButtons`. `ev-search.ts:38` re-exports the long `STAT_LABELS` as `STAT_LABELS_SHORT`.
  - **Phase 2:** `fixed`.
- **N3.** `IvSection.tsx:63-77` — store update inside a `setState` updater (runs twice in StrictMode).
  - **Phase 2:** `fixed`.
- **N4.** `DamageCalcTab.tsx:61-107` renders the mobile and desktop layouts at once (CSS-hidden), so each panel and its effects exist twice; `CalcPokemonPanel.tsx:96-120` sends one PokéAPI request per keystroke while a move name is typed.
  - **Phase 2:** `fixed` — one set of panels placed by a grid; move lookups are debounced (400 ms).
- **N5.** `SettingsTab.tsx:55` and `DamageCalcTab.tsx:55` use `h-screen`; other tabs use `h-full`.
  - **Phase 2:** `fixed` (also `TrainerLookupTab`).
- **N6.** Effects that only derive state (suggestion lists in `AttackdexTab.tsx:76-84`, `MoveComboPanel.tsx:241-249`; highlight resets). Harmless.
  - **Phase 2:** `skipped` (harmless, as the finding says).
- **N7.** `backup.ts` CSV export doesn't escape quotes and reports one box slot per Pokémon; `triggerDownload` revokes the object URL immediately after `click()`.
  - **Phase 2:** `fixed` — quotes are escaped and the URL is revoked after a second. One box slot per Pokémon in the CSV is unchanged.
- **N8.** `real-save.test.ts:88-91` logs to the console (only runs with a private fixture).
  - **Phase 2:** `fixed`.

---

## `eslint-disable` review (react-hooks)

All checked; all safe in the sense that no stale value can cause a wrong result:
`App.tsx:88`; `useSyncEngine.ts:99,141` (your lead — stable Zustand setters and refs); `useAttackdex.ts:143`; `AttackdexTab.tsx:60,66`; `CalcPokemonPanel.tsx:119`; `MoveGrid.tsx:51` (cosmetic staleness noted in the designer findings); `HGSSMap.tsx:209`; `SinnohMap.tsx:177`; `RouteInfo.tsx:46`; `IvSection.tsx:146` (the disable is fine; the effect itself is M4). The `set-state-in-effect` disables are all "reset on change" patterns.

## Performance

- **`pokemon.json`:** 9,478,937 bytes pretty-printed (4,291,553 compact). Fetched once in `App.tsx:91-101`, held in React state and passed down; filtering and maps are memoised (`usePokemonFilter`, `BoxView`, `useRouteIndex`), so render cost is fine. **The real cost is transfer: `nginx.conf` enables no gzip**, so the published image sends 9.5 MB (328 KB gzipped) plus the 1.24 MB bundle uncompressed, with a 1 h cache on the data. Fix: `gzip on` with `gzip_types application/json application/javascript text/css image/svg+xml`, and write compact JSON (213 KB gzipped). I'd treat the gzip line as Medium priority.
- **Bundle (1,242 kB):** everything is in one chunk because `App.tsx:3-13` imports all nine tabs statically. Biggest avoidable parts: Battle Tower JSON (760 KB on disk, ~350 KB compact) imported by Trainer Lookup and Damage Calc; Leaflet (148 KB + CSS) and the Sinnoh GeoJSON imported by Routes; `tm-locations.ts`; the save parser and `save-tables.json` (49 KB). `React.lazy` per tab (the keep-alive wrapper already mounts tabs on first visit) would move all of these out of the first load.
- **Attackdex learners:** `useAttackdex.ts:85-86` downloads the full `/pokemon/{id}` document (hundreds of KB each) for every learner of a move — several hundred requests for a common TM. Pre-computing learnsets in the data pipeline would remove this and the app's runtime dependence on PokéAPI (the Pokédex moves, Attackdex, Designer moves and damage-calc move lookup don't work offline).
- **Third-party hosts at runtime:** PokéAPI, `raw.githubusercontent.com` sprites, Google Fonts (Burnished theme), `pkmnmap4.web.app` map tiles (`SinnohMap.tsx:17`, someone else's site) and `play.pokemonshowdown.com` trainer sprites. **Question:** is hot-linking the last two acceptable to you?
- Hidden tabs stay subscribed to the stores and re-render on changes; not a measurable problem today.

## Tests

- The existing tests are meaningful (no mock-only or assertion-free tests found). One test encodes wrong behaviour: `calculators.test.ts:88-93` (M1).
- **Untested logic worth covering in Phase 2:** `syncOnce` end-to-end with a fake server (pull → merge → push, edit during push, 401); `iv-calc.ts` (`calcStat`, `findIVs`, Hidden Power — no tests at all); `getDynamicBallBonus`; `move-lookup` name→slug; `backup` malformed `designer`/`boxSlots`; store migrations (`useSettingsStore.merge`, `useDesignerStore.merge`); `sync-server` (no tests: login, auth, push validation); `computeAvailability` with a baby that has encounters in another game (H7).

## Checked and found fine

- **Sync core** (`sync.ts`, `sync-merge.ts`, `useSyncEngine.ts`): always pull → merge → push; nothing pushes blindly; an edit made during a push is detected and synced; no push/pull loop (at most one redundant pull after a push); per-entry timestamps, tie-break "mark wins", un-marks, missing fields and old payloads are handled and tested; applying remote data doesn't stamp sections; `await hydrate()` before merging prevents "not loaded yet" being read as "deleted".
- **Token comparison** is constant-time for ASCII inputs (see M10 for the non-ASCII case); CORS only echoes configured origins; body limit 4 MB; writes are atomic (temp file + rename); no secrets in the repo, Dockerfile or workflows (`.env`, `env.js`, `*.sav` are git-ignored).
- **Persisted stores:** `partialize` matches what is stored; every persisted, synced field is in `buildPayload`/`applySnapshot` (the test enforces it); the settings and designer `merge` migrations are idempotent; older persisted shapes without `placedByGen`/`updatedAt.placed` load correctly.
- **Backup:** version 1 and 2 files and the old "Export JSON" key names restore; invalid JSON and bad tracker records are rejected with a message.
- **Stat and IV formulas** (`iv-calc.ts`, `stat-calc.ts`, `computeStat`): match Gen III/IV, including rounding; I checked that `floor(x × 1.1)` / `floor(x × 0.9)` in floating point equals the integer result for every value 1–1000. Hidden Power type and power are correct. Catch formula core (`a`, `b`, four shake checks, status multipliers) is correct; Timer, Net, Dusk, Level, Safari and Great/Ultra values are right.
- **Save import:** `pk4.ts`/`pk3.ts` offsets, block and substructure orders, encryption, checksums, IV/EV order, shiny and gender rules, level-from-EXP, Unown form, ball and origin codes match the documented formats; Gen III section sizes, footer fields, FR/LG vs R/S/E detection and PC buffer layout are right. Living-dex allocation, import planning (stale-dump and mass-removal rules), to-do list, transfer plan, best-copy ranking, history diff and box search: read in full, no logic errors found. Files are never written to or uploaded.
- **Data pipeline:** encounters are pinned to `POKEAPI_COMMIT` and cached per commit; overrides apply before the denylist and Altering Cave clean-up; the override-provenance check catches overrides that duplicate PokéAPI rows; none of the 86 static-legendary override entries is skipped, and the 112 provenance rows are consistent with the static, roaming and gap-fill gift entries; `save-tables.json` generation asserts its own invariants.
- **iOS release metadata** (L13) and safe-area handling in the header, bottom nav, toasts and dialogs.
- **Hooks:** no missing-dependency bugs beyond those listed; no selector returning a fresh object/array per render; no index keys on reorderable lists.

## After Phase 2

### Baseline now

| Check | Result |
|---|---|
| `npx tsc -b` | clean |
| `npm test` | 14 files, 210 passed, 1 skipped (`real-save.test.ts` needs the private Platinum fixture; the SoulSilver part ran against your save) |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run build` | OK, no chunk-size warning. Entry chunk 335 kB (was 1,243 kB); each tab other than the tracker is its own chunk |
| `npm run validate-data` | passed |
| `pokemon.json` | 4.3 MB compact (was 9.5 MB) |

### Performance and tests sections — status
- **gzip, compact JSON, lazy tabs:** `fixed`. **Leaflet and the map tiles:** gone with the maps.
- **Attackdex learners:** partly — requests are capped at 10 at a time and cached, but it still downloads a document per learner. Pre-computing learnsets in the data pipeline is a feature-sized change; `needs-owner-decision`.
- **Hot-linked trainer sprites** (`play.pokemonshowdown.com`): `needs-owner-decision`.
- **Tests added:** move values per game, move-name lookup, ball bonuses, damage formula (hand-computed), doubles screens, hazards, baby availability, backup with 30 slots and malformed sections, per-profile save merge, HGSS footer. **Still untested:** `syncOnce` end to end against a fake server, the store migrations, `findIVs`, and `sync-server` itself (checked by hand with scripted requests only).

### Verified in a browser (dev server, offline mode, Gen 3; 1440 px and 375 px)
- Tracker: caught (double-click, and single tap with Quick mark), pending (right-click), shiny (detail panel) — each with its Undo toast, and Undo restores the previous state. List-view checkboxes toggle with Space.
- Filters: All / Obtainable / Catchable / Needs Attn all render; babies are obtainable in Gen 3 (H7). The Needs Attention rules were not changed.
- PC box view: assigning a Pokémon to a slot works and is stored under the game that is shown.
- Designer: add a Pokémon, stats with unknown IVs, abilities list, Showdown copy.
- Damage calc: Battle Tower sets on both sides, Stealth Rock, hail, doubles with Light Screen; one set of panels at both widths.
- Catch calc, Routes (mark + undo from a route), Pokédex (Clefable is Normal; Thunderbolt 95), Attackdex, Trainer Lookup, Settings: all load without console errors.
- Backup: export → change data → restore brings everything back; exporting again gives the same file; a malformed section is refused. Done through the app's own export/restore functions in the page, not by saving a file to disk and picking it again.
- Found during this pass and fixed: at 375 px the damage-calc controls ran out past their panels (it did the same before Phase 2).
- **Not verified:** sync between two devices in the browser (this profile is in offline mode with no server running); the nginx config (no Docker here); anything on a real iPhone.

### Left to decide
1. **C2** — offline data on the iOS app has no second copy. Skipped because you don't use it.
2. **H3 follow-up** — `fixed` (2026-10-11). The Pokédex and Designer show only the abilities a species had in Gen III while Gen 3 is selected (`abilitiesInGeneration`). Checking this against PokéAPI's ability history also turned up four wrong entries in the Gen III save importer's ability table — Shiftry (missing Early Bird), Pelipper, Torkoal and Feebas (a second ability they did not have yet) — now fixed, with a test.
3. **L5** — `pokedex.shrumslab.com` hard-coded in `index.html`, `robots.txt`, `sitemap.xml`.
4. **L7 / L9 / L20** — remove the v1 tracker migration? Remove the unused IV-session store (stored and synced data)? Keep `save/__tests__/demo.ts`?
5. **L22** — delete the unread sections of `overrides.json`?
6. **Trainer sprites** hot-linked from Pokémon Showdown; **Attackdex learners** pre-computed in the data pipeline.
7. **iOS release** — released as v1.2 on 2026-10-11.

## Follow-up pass (2026-10-11)

A second list of work, done after this audit. Where it settles something the audit left open:

- **Attackdex learners / learnsets in the data pipeline** (Performance, "Left to decide" 6) — `fixed`. `scripts/moves-data.ts` generates `public/data/moves.json` and `learnsets.json` from the pinned CSVs; nothing calls PokéAPI at runtime.
- **M8, "using the forwarded address behind a proxy"** — `fixed`. `nginx-real-ip.conf` trusts `X-Forwarded-For` from loopback and the private ranges; `TRUSTED_PROXIES` replaces the list.
- **Tests, "still untested"** — `syncOnce` end to end and `sync-server` itself are now covered (`sync-once.test.ts`, `sync-server/server.test.js`). The store migrations and `findIVs` are still untested.
- **nginx "not tested locally"** — still true (no Docker here), but every push to `main` builds the image, which runs `nginx -t`; the builds with the new config passed.
- **Third-party hosts at runtime** — PokéAPI is gone. Sprites (`raw.githubusercontent.com`), Google Fonts and Showdown trainer sprites remain, and a Content-Security-Policy now limits the app to those.
- **L4** — still no `fsync`, but the server now keeps hourly/daily snapshots of `sync.json` and refuses a push built on an older copy (409).
- **New in this pass:** Capacitor 8.5.3 (GHSA-rvm3-566m-v7fv), Showdown export with a nickname, move names with their hyphens, request timeouts, a service worker and manifest for offline use in a browser, CI build/audit and Dependabot, and links between tabs for every Pokémon, route and move.
- **Still open:** C2 (iOS offline data), L5, L7/L9/L20, L22 and the hot-linked trainer sprites, as listed under "Left to decide".

## Questions for you (Phase 1 — answered)

1. **C1:** remove the Restart button and endpoint, or keep them and add a supervisor to the container?
2. **C2:** is offline mode on the iOS app something you rely on? Adding a working export there needs a Capacitor plugin (a new dependency) — OK, or should I do a no-dependency fallback?
3. **H1–H4:** OK to regenerate `pokemon.json` with Gen IV types, stats and abilities (large data diff, needs network), and to read per-version move values? Should hidden abilities be removed?
4. **H9:** OK to change the Nest/Quick Ball numbers after I confirm them against Bulbapedia, and add toggles for Dive/Repeat Ball?
5. **M11:** do you have a HeartGold/SoulSilver save to test with?
6. **M13:** implement Stealth Rock/Spikes/Sand/Hail in the damage calc, or remove the controls?
7. **M16:** unknown IVs default to 31 everywhere?
8. **M20:** remove the four hand-added Great Marsh entries?
9. **L9:** is the old IV-session store (`useIvStore`) still wanted? **L7:** can the v1 tracker migration go? **L20:** keep `demo.ts`?
10. **L5 / Performance:** keep the hard-coded `pokedex.shrumslab.com` metadata? Keep hot-linking map tiles and trainer sprites from third-party sites?
11. Lazy-loading tabs changes the first click on each tab from instant to a short load. Want it?
