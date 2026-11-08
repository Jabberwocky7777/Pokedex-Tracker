# Navigation redesign — implementation plan

Status: proposed, 2026-11-07. Mockups: the "Tracker toolbar options" design canvas
(boards AB-Wide, P-Plan, X-Dex, N1–N3).

## What changes

| Today                                                                                                        | After                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10 header tabs + Settings                                                                                    | **Tracker · Plan · My games · Pokédex · Routes**, a **Tools ▾** menu (Catch Calc, Designer, Trainer, Damage Calc), Settings gear                                                                  |
| Tracker has 6 views (Pokémon, What's next, Daily, Items, Progress, Changes) in a segmented row               | Tracker keeps **Pokémon, Progress, Changes** — it is about the collection only                                                                                                                    |
| What's next, Daily, Items live in the tracker; Notes is its own tab                                          | **Plan** tab: _Do next_ — Today (Daily), Where to go (What's next → Catch), Level up (What's next → Level up), Items to get; _Keep track_ — Working on, Notes, Journal, Shiny hunts; recent trips |
| Pokédex and Attackdex are separate tabs; the Attackdex switches single / combo / HM with a segmented control | **Pokédex** tab: _Pokémon_ — Browse, Compare; _Moves_ — Browse, Who learns a combo, HM planner                                                                                                    |
| Dex + games + availability: three segmented rows                                                             | Game choice in the header (global: Tracker, Plan, Routes use it); Pokédex + Show in the tracker's sidebar (wide) or one scope button (narrow)                                                     |
| Filled pills everywhere                                                                                      | Underline for "where am I", one filled accent per row, borders on inputs only, one 32 px control height (44 px on touch)                                                                          |

**Nothing synced changes.** Every moved setting is in `useSettingsStore` (per device, never synced). Working on, trips,
notes, journal and hunts keep their stores and sync sections as they are, so an iPhone still on the old version keeps
syncing with no special handling.

## One layout system: `SectionLayout`

Plan, Pokédex and Tracker all become _section nav + content (+ optional side panel)_. Build that once
(`components/layout/SectionLayout.tsx`) and use it three times, so the three tabs behave the same at every size.

```
<SectionLayout
  sections={[{ group: "Do next", items: [{ id, label, Icon, badge? }] }, …]}
  active={id} onSelect={…}
  aside={<WorkingOnPanel compact/>}        // optional right column
>{content}</SectionLayout>
```

### Sizes (by window width and height, never by device)

The iOS app is universal (`TARGETED_DEVICE_FAMILY = "1,2"`) with every iPad orientation and no
`UIRequiresFullScreen`, so iPad Split View, Slide Over (320 px) and Stage Manager give it **any** width.
Decide from the window, not the device.

| Window    | Who                                                    | Header                                                              | Section nav                                                                                   | Side panel / detail                                                                 |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| < 768     | iPhone, Slide Over, narrow Split View                  | Phone top bar + bottom bar (Tracker, Plan, Pokédex, My games, More) | A "Section ▾" button under the top bar opening a sheet (like today's View sheet)              | Bottom sheet                                                                        |
| 768–1023  | iPad portrait (744–834), half Split View, small laptop | Full header, icons + active label                                   | Underline tabs that scroll sideways                                                           | Bottom sheet / overlay (today's `lg:hidden` path)                                   |
| 1024–1279 | iPad landscape (1133–1194), 13" iPad portrait (1024)   | Full header                                                         | Sidebar, **collapsible to a 56 px icon rail**; collapsed by default when a side panel is open | Overlay drawer from the right                                                       |
| ≥ 1280    | Laptops, 13" iPad landscape (1366), desktop            | Full header with labels                                             | Sidebar 240 px                                                                                | Docked column (320 / 384 px)                                                        |
| ≥ 1920    | Big monitors                                           | —                                                                   | —                                                                                             | Content gets `max-w` and the box grid goes to 4 boxes per row instead of stretching |

Gotchas this table answers:

- **iPhone landscape is 844–932 px wide but only ~390 tall.** Width alone would give it the tablet header plus section
  tabs plus toolbar: no room left. Add a short-window rule (`@media (max-height: 500px)`): phone chrome, header
  collapses, bottom bar stays.
- **Notch / Dynamic Island in landscape:** the sidebar and the bottom sheets need `env(safe-area-inset-left/right)`
  padding (only `top` and `bottom` are handled today).
- **iPad with a trackpad or Magic Keyboard is wide, fine-pointer _and_ touch.** Size targets with `pointer-coarse`, show
  hover-only affordances only under `@media (hover: hover)`, and never hide an action behind hover.
- **`title` tooltips don't exist on touch.** Icon-only buttons (collapsed rail, layout toggle, Quick mark) need a visible
  label somewhere or a long-press hint; `aria-label` alone isn't enough for sighted touch users.
- **Rotating an iPad mid-use** crosses 1024: section state lives in the store, so nothing resets; the side panel
  switches from docked to drawer without closing.

### iOS 15 WebKit limits

The app targets iOS 15.0. Don't build the layout on **container queries** (Safari 16), **`:has()`** (15.4) or
**`dvh/svh`** (15.4); use media queries and the existing `env()` + `vh` approach. Use `timeoutSignal` rules as before.
Check the oldest iPad/iPhone actually in use before relying on anything newer.

## Routing

`lib/url-route.ts` gains a section level: `#/<tab>/<section>/<item>`.

| Address                                                                                                        | Opens                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `#/tracker`, `#/tracker/progress`, `#/tracker/changes`                                                         | Tracker views (they become linkable — today `viewMode` isn't in the address)               |
| `#/plan/today`, `/where`, `/where/<area-slug>`, `/level`, `/items`, `/working`, `/notes`, `/journal`, `/hunts` | Plan sections; Where to go remembers the open place                                        |
| `#/pokedex/94`, `#/pokedex/compare/94/150`, `#/pokedex/moves`, `/moves/u-turn`, `/moves/combo`, `/moves/hm`    | Pokédex sections; `#/pokedex/94` keeps working                                             |
| `#/attackdex/u-turn` → `#/pokedex/moves/u-turn`; `#/notes/hunts` → `#/plan/hunts`                              | Old addresses (bookmarks, home-screen icons, links in notes) rewritten with `replaceState` |

`navigate.ts` keeps its function names so callers don't change: `openMove` → Pokédex/moves, `openNotes(section)` →
Plan, plus `openPlan(section, item?)`. Sections push history so browser Back walks them. The iOS app has no back
gesture in the web view (Capacitor default), so every section needs an in-app way back — the sidebar/tabs give that.

## Settings migration (`useSettingsStore` `merge`)

- `activeTab: "attackdex"` → `"pokedex"`, section `moves` (or `combo` / `hm` from `lastAttackdexMode`). Keep the
  `lastAttackdex*` fields — they become the Moves section's memory.
- `activeTab: "notes"` → `"plan"`, section from `notesSection`.
- `viewMode: "next" | "daily" | "items"` → `activeTab: "plan"`, section `where` / `today` / `items` (`nextPanel:
"level"` → `level`); tracker `viewMode` back to `box`.
- New per-device fields: `planSection`, `pokedexSection`, `sidebarCollapsed`, `planPlace` (transient, like
  `activeRoute`). Not synced; add them to `partialize` where they should survive a reload.
- Unit tests for each mapping next to `url-route.test.ts` (a `settings-migration.test.ts`).

## Things that look small and aren't

1. **Pokémon links from Plan.** What's next opens the _tracker's_ detail panel today (`to="tracker"`, e2e item 20).
   From a separate tab that would yank the user out of Plan. Make `DetailPanel` hostable outside `Layout` and show it
   as Plan's drawer / docked panel, so you can mark caught without leaving. `selectedPokemonId` is cleared on leaving
   the tracker today; it needs to become per-host (or a Plan-local id).
2. **The game choice becomes global.** Tracker, Plan (What's next, Daily, Items, Level up all read
   `activeGames` / `activeGeneration` only — checked) and Routes share it. It moves into the header as
   "SoulSilver ▾" (with "HeartGold + SoulSilver" and "All Gen 4 games" entries, and Gen 3 below), replacing the
   Gen 3/4 toggle and the Routes tab's own game row. Pokédex and Show stay tracker-only.
3. **Sidebar badges must be cheap.** "Where to go · 24" would run `buildNextLocations` on every mark. Use cheap counts
   only (Working on open items, today's events), compute heavy ones lazily once the section has been opened, or drop
   the badge.
4. **Keep-alive tabs.** `App.tsx` keeps every visited tab mounted. Plan and the merged Pokédex are lazy chunks like
   today; inside them, sections mount on first visit and stay mounted (so the move search box and the What's next scroll
   position survive switching). `moves.json` / `learnsets.json` stay unloaded until a Moves section opens.
5. **Keyboard shortcuts** (`useKeyboardShortcuts`) must keep checking `activeTab === "tracker"` _and_ the section; an
   iPad with a keyboard will hit them.
6. **Trip mode on a phone.** The bottom action bar ("3 places · Print") must sit above the bottom nav and the home
   indicator. In the iOS app Print is disabled (no `window.print()`), so the bar shows Save as image there.
7. **Print sheets** are portalled and unaffected, but their titles say "What's next" — rename to "Where to go" with the
   tab, and keep the print CSS block in step.
8. **Themes.** Use the `gray-*` / `indigo-*` utilities (which Burnished remaps) and `--theme-font-display` for section
   titles; no new hex colours. Check Dark and Burnished at each size.
9. **Accessibility.** Section nav is a `<nav aria-label>` with `aria-current`; the rail's collapse button has
   `aria-expanded`; switching section moves focus to the section heading; drawers use `useDialogFocus`; respect
   `prefers-reduced-motion` for the rail and drawers.
10. **First-run hint.** The tracker's blue banner moves into the empty part of the sidebar (wide) or a one-time
    toast (narrow), so it stops pushing the grid down.
11. **Known bug:** "Pokémon" stays highlighted after opening What's next. It disappears with the views row, but check
    `currentView()` in `FilterSubbar.tsx` in case it's a stale-state issue elsewhere.
12. **Deployment.** Every push to `main` publishes the Docker image to the TrueNAS deploy, so each phase below must be
    a complete, coherent app — no half-moved tabs between commits. The iOS app only changes on a tagged release.

## Phases (each one ships on its own)

**1. Foundations** — `SectionLayout` (all four size modes, rail collapse, safe areas, short-window rule), section-aware
`url-route.ts` with the old-address rewrites, settings fields + migration + tests. No visible change yet except the
rewrites.

**2. Pokédex + Moves** — the smallest real move. `AttackdexTab`'s three panels become Pokédex sections; Compare
becomes a section; `attackdex` leaves `APP_TABS`, `TAB_DEFS`, `MOBILE_PRIMARY_TABS`' More list. Old links redirect.

**3. Plan** — Notes tab becomes Plan; What's next, Level up, Daily and Items move in; What's next gets the list-and-detail
layout (N2) with one filter row (N1) and trip mode (N3); `DetailPanel` hosted in Plan; Working on as the right column
at ≥ 1280.

**4. Tracker and header** — header with underline nav, Tools ▾ menu, global game switcher; tracker sidebar (views +
Pokédex + Show with descriptions, replacing `AvailabilityHelp`'s `?`); scope button below 1024; Routes loses its game
row; phone bottom bar becomes Tracker, Plan, Pokédex, My games, More.

**5. Polish and release** — the declutter rules across the touched screens, e2e, screenshots, docs, changelog.

## Tests and docs to update

- `scripts/e2e-links.ts`: every `attackdex` check (~15), `viewMode: "next" | "daily"` checks (items 20, B3 and others),
  the `tool-row` / "View:" sheet check, Notes checks. Add an **820 px** (iPad portrait) and **1180 × 820** (iPad
  landscape) pass beside 1440 and 375, plus **844 × 390** for iPhone landscape.
- `scripts/capture-screenshots.ts`: `whats-next` shot moves to `#/plan/where`; add Plan and Moves shots; README images.
- Unit tests: `url-route.test.ts` (new addresses and rewrites), the migration tests; `npm run knip` for exports left
  behind by `AttackdexTab` / `FilterSubbar`.
- `CLAUDE.md`: Directory Structure, Application Tabs, the settings row in Zustand Stores, Cross-tab navigation, Tracker
  Interaction (Views), and a short "Layout sizes" section with the table above. `docs/features.md`, `README.md`.
- `CHANGELOG.md` `### Upgrade notes`: "Attackdex is now Pokédex → Moves; Notes and What's next are now the Plan tab.
  Old links still work."

## Manual checks per phase

Safari responsive mode at 375, 744, 820, 1024, 1180, 1366, 1920 and 844 × 390; the iOS app on an iPhone and an iPad
(both orientations, Split View half and Slide Over); a desktop browser at 1440 and 2560; Dark and Burnished themes;
keyboard only; VoiceOver on one section switch and one drawer.

## Decisions for you

1. Header game switcher (global) vs games in the tracker sidebar (A + B board). The plan assumes the header, because
   Plan and Routes need it too.
2. Phone bottom bar: Routes moves to More to make room for Plan. Alternative: Plan replaces My games.
3. Journal and Shiny hunts under Plan → Keep track, or under My games next to Game Progress.
4. One release at the end (iOS tag after phase 5) — the web deploy gets each phase as it lands.
