# Changelog

What changed in each release of Pokédex Tracker. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are the app
version shown in AltStore / SideStore and used for the `v*` tags.

Each version's first paragraph is its highlights; `npm run release:notes -- <version>`
turns a section into GitHub release notes (see [RELEASE_TEMPLATE.md](.github/RELEASE_TEMPLATE.md)).

## [Unreleased]

HG/SS encounter rates now add up the way the games do, and any encounter can go
straight onto your Working on list.

### Added

- Every encounter row with a rate (Routes, the detail panel, the Pokédex's "Where to find", What's next, the Great Marsh banner) has a button that adds "Catch Feebas on Route 119 (Super Rod, 5%)" to Working on, linked to the Pokémon, the route and its games.
- What's next: **Second copies to evolve** — a Pokémon you've caught whose evolution you haven't (and isn't pending) is listed as one to catch again, tagged with what it's for ("for Houndoom"), so you keep both. On by default; only the nearest caught stage is asked for, and evolving at a Sinnoh place (Leafeon, Magnezone…) only when a Sinnoh game is selected. The print marks them "+"; in **Check off a trip** tapping one marks its evolution pending (your first one stays caught); **Add to Working on** makes "Catch another Houndour … for Houndoom", finished when Houndoom is caught.
- What's next: turning off Show → Pending leaves out Pokémon you've marked pending, so only what still has to be caught is listed.
- What's next → Level up: the pending Pokémon in your imported saves that only need levels, which copy to level (the one needing the least EXP, across all your saves), the EXP and levels each needs, who should hold the Exp. Share, and how many runs that takes at a chosen spot — with Lucky Egg and traded-Pokémon bonuses.
- Where to get EXP in each game (Emerald, FR/LG, D/P/Pt, HG/SS): what players recommend, with the EXP per League run, rematch or wild battle worked out from the games' own trainer parties and encounter tables. Some common tips don't hold up — Gabby & Ty give a fraction of a Wally rematch, and Kindle Road about half of Cerulean Cave. The spot you can reach (from Game Progress) is used for the estimates, and the ones you haven't reached are marked.
- HG/SS gym leader and phone rematches as a week: who to call on which day and time of day (the game turns you down otherwise), today first, with "call now". The leaders all meet you at the Saffron Fighting Dojo once you have 16 badges.

### Changed

- A new **Plan** tab gathers what to do next and what you keep track of: **Today** (the daily checklist), **Where to go** (was What's next), **Level up** and **Items to get** moved out of the tracker, and **Working on**, **Notes**, **Journal** and **Shiny hunts** from the Notes tab. Tapping a Pokémon in Plan opens its details beside what you're doing instead of switching to the tracker. On a phone Plan is in the bottom bar and Routes moved to More. Old `#/notes/…` links still work.
- Where to go is calmer: the ranking sits beside the title and the other options fold behind **Options**; printing and trip check-off are behind **Plan a trip**; on a wide screen the places are a list beside the one you open.
- The tracker is the collection only: its views are Pokémon, Progress and Changes, in a sidebar with the Pokédex and Show choices — each with a line saying what it does, so the **?** button is gone. Narrower screens get one "National · Obtainable" button for them, and a phone a two-row toolbar.
- The header: the games you're playing are one switcher beside the logo (pick one, several to compare versions, or a whole generation; it replaces the Gen 3 / Gen 4 toggle and the rows of game buttons in the tracker and Routes). The main tabs are Tracker, Plan, My games, Pokédex and Routes; the calculators and lookups are in a **Tools** menu.
- An iPhone on its side gets the phone layout (bottom bar, short header) instead of a squeezed tablet one.
- The Attackdex is part of the Pokédex tab: **Moves**, **Who learns a combo** and the **HM planner** sit beside **Pokémon** in a sidebar (underline tabs on an iPad in portrait, a section button on a phone). Old `#/attackdex/…` links open the same move.
- The app is called "Pokédex Tracker" everywhere, including the iOS home screen and AltStore listing (it was "Pokedex Tracker" there).
- What's next's options are one tidy panel (Show, Include, Methods, then Rank by / Game / Not reached yet), folded behind an Options button on a phone.

### Fixed

- Wurmple is counted towards the line it will really become (Silcoon or Cascoon, from its personality value) wherever the full save is on the device — in pending marks, the to-do list and the transfer plan as well as Level up.
- The living-dex to-do list's evolve steps use the same copy as Level up: the one that needs the least EXP, not the first one found.
- HG/SS encounter rates are added up one table at a time: headbutt trees (common / rare / secret), water swarms per rod, the radio's Hoenn and Sinnoh Sound, Safari Zone blocks and the Bug-Catching Contest's days are separate tables, instead of totals of 200–500%. Every regular table now matches the game's data.
- What's next with the Safari Zone & Bug-Catching Contest left out says which Pokémon you still need are found only there (Trapinch, Scyther in HG/SS), with a button to include them — before, they just disappeared.
- HG/SS Rock Smash is 80/20; Lake of Rage's surfing and fishing Gyarados are back; gifts, trades and fossils show as one-time instead of adding to a rate.

## [1.7] - 2026-11-04

The iOS app can now save exports and images through the share sheet.

### Added

- Working on items can link several things at once (a route, Pokémon and a game).
- The Pokédex shows the whole evolution family, every branch.
- What's next has a toggle for the HG/SS Safari Zone and Bug-Catching Contest.

### Changed

- Tablet layout improvements.

### Fixed

- iOS: Export JSON / CSV / notes, the progress card and Save as image open the share sheet (Save to Files, Save Image); before, they did nothing in the app.
- DS clock times are correct across daylight saving changes.

## [1.6] - 2026-10-27

What's next learns to filter by encounter method and to save itself as images.

### Added

- What's next: Methods chips to show only Grass, Surfing, Fishing (all three rods), Rock Smash, Headbutt, Honey trees, Gifts & one-time and more; the view, the print and the trip check-off follow them.
- What's next: Save as image draws the selection as phone-sized pictures to save to Photos from the share sheet (the iOS app's alternative to printing).

## [1.5.1] - 2026-10-25

Sync, safety and sign-in fixes.

### Changed

- Changes are timestamped on the server's clock, so a device whose clock runs fast can't win every conflict.
- A poll that finds nothing new transfers a few bytes instead of the whole Pokédex.
- Data the server sends in a damaged shape is ignored and repaired instead of breaking sync; data from a newer app version is kept instead of deleted.
- Server snapshots (Settings → Sync) include the copies replaced by the last 10 syncs, and a snapshot with a damaged entry can still be restored.
- The Burnished theme's font is built in, so it works offline.

### Fixed

- Revert last import takes back only what that import changed. Before, it reset the whole generation to how it was before the import, undoing everything marked since, on every synced device.
- Undo after clearing a generation or importing a save no longer undoes marks that synced in from another device meanwhile.
- Signing in on iOS 15 works (it always reported "Cannot reach server").
- Sign-in errors say what went wrong (too many attempts, a wrong address, a server that isn't a Pokédex Tracker) instead of "Connection timed out".
- The sync indicator shows when this device last synced, so it no longer turns "stale" after an hour without edits.
- Escape closes the Designer and damage-calculator pop-up menus.

### Security

- CSV export can't run spreadsheet formulas.

### Upgrade notes

Works with the current server image; an older server still works too, without the clock correction and the cheaper polls.

## [1.5] - 2026-10-23

New navigation and a Notes tab.

### Added

- Notes tab: a Working on list (linked to Pokémon, routes and games, finished automatically when you catch a linked Pokémon), all notes searchable, and a run journal with "Today's catches". Synced like your marks.
- Back / Forward, and links that open a specific Pokémon, move, route or Notes section.
- Tracker: a sortable list view (caught date, games, note), `note:yes` and `cutecharm:no` searches.
- Pokédex: gender ratio and the Gen IV Cute Charm note; browse all Pokémon when none is open.
- Attackdex: browse moves by type.
- Routes: a legend for the coloured dots and "View map on Bulbapedia".

### Changed

- Every tab is in the header on iPad; on iPhone there are four main tabs plus a More sheet.
- Gen 3 / Gen 4 switch in the header; sign-out moved to Settings, with a confirmation.
- One Views control in the tracker, and the counter in words.
- CSV export has caught date, games and notes; in the app use Copy notes (Settings).
- Larger tap targets, readable small text, pinch-zoom and better contrast in Burnished.
- Printing is offered only in Safari, not in the app.

### Fixed

- What's next adds encounter rates up correctly per time of day, and marks the daily Trophy Garden / Great Marsh Pokémon as daily.
- The daily checklist's Trophy Garden and Great Marsh lists.

## [1.4] - 2026-10-14

Battle Tower data from the game, and a batch of planning tools.

### Added

- Evolution item shopping list, progress over time with a shareable progress card, "available right now", a breeding helper, a roaming legendary tracker, trade sessions, per-Pokémon notes and a shiny hunt counter.
- Links between tabs for every Pokémon, route and move.
- Trainer Lookup: all 950 Battle Tower sets from the game data, with stats at each trainer's IVs.

### Changed

- Sync waits up to 30 s for a slow server instead of 15 s, and keeps data sections a newer version added.
- "Synced" only appears when changes were actually sent or received.
- Evolution item locations checked against Bulbapedia.

### Security

- Capacitor 8.5.3 (GHSA-rvm3-566m-v7fv).

## [1.3] - 2026-10-11

A change log for every mark.

### Added

- Change log: the Changes button lists what each save import, clear and run of marks changed, Pokémon by Pokémon ("Pending → Caught"), with undo for a whole entry or one Pokémon, and redo.

### Changed

- What's next and Saves are labelled buttons instead of icons in the box / list / slots toggle.

## [1.2] - 2026-10-11

Gen III/IV accuracy and clean-up.

### Added

- HeartGold / SoulSilver saves import.
- Catch calculator: Dive and Repeat Ball conditions.

### Changed

- Types, base stats, abilities and move power / accuracy / PP are as they were in Gen III/IV (no Fairy type, no hidden abilities); with Gen 3 selected, only Gen III abilities are listed.
- Imported saves merge per save across devices.
- Breedable babies count as obtainable.
- Each tab loads on first use, so the app starts faster.

### Removed

- The route maps; the location search stays.

### Fixed

- Damage calculator: the Gen IV formula, Stealth Rock, Spikes, sandstorm and hail, more abilities and items, doubles screens.
- Catch calculator: Nest and Quick Ball.
- Gen III save abilities for Shiftry, Pelipper, Torkoal and Feebas.
- Routes: the caught checkbox and Undo; Designer, PC box and HM planner fixes.

## [1.1] - 2026-10-10

Sync that merges instead of overwriting.

### Added

- Offline mode, Quick mark and long-press, undo, richer search, a "What can I get next" view and evolution reminders.

### Changed

- Sync merges changes from several devices (shiny marks included) instead of overwriting.

### Fixed

- Gen IV encounter data: real outbreaks and HG/SS headbutt.

## [1.0.1] - 2026-05-17

### Added

- Shiny tracking per generation: box cells show the shiny sprite and a ✦ badge, with a toggle in the detail panel and a shiny preview in the Pokédex.
- A second progress counter: caught plus pending.

### Fixed

- iOS: the sign-in token and server address survive AltStore / SideStore updates.

## [1.0.0] - 2026-05-17

First release, with the iOS app on an AltStore / SideStore source.

### Added

- Tracker for all 493 Pokémon of Gen I–IV across the ten Gen III/IV games, in box, list and PC-box views, with game and availability filters and a daily events checklist.
- Pokédex, Attackdex (single move, move combos, HM planner) and route encounter tables with day / night encounters.
- Catch calculator, team Designer with IV / EV tools, Battle Tower Trainer Lookup and a Gen IV damage calculator.
- Dark and Burnished themes.
- Self-hosted sync server in one Docker image, with a login screen.
- iOS app built with Capacitor.

[Unreleased]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.7...HEAD
[1.7]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.6...v1.7
[1.6]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.5.1...v1.6
[1.5.1]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.5...v1.5.1
[1.5]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.4...v1.5
[1.4]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.3...v1.4
[1.3]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.2...v1.3
[1.2]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.1...v1.2
[1.1]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.0.1...v1.1
[1.0.1]: https://github.com/Jabberwocky7777/Pokedex-Tracker/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Jabberwocky7777/Pokedex-Tracker/releases/tag/v1.0.0
