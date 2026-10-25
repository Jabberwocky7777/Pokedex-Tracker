# Sync, snapshots and offline mode

Setting up the server is in [self-hosting.md](self-hosting.md).

## Sync across devices

Once the app is running with a `SYNC_TOKEN` set, cross-device sync is automatic:
- **On page load, and whenever you come back to the tab** — syncs straight away
- **On every change** — syncs 2 seconds after the last change
- **Every 30 seconds** — polls for remote changes so if you catch something on your phone, your PC tab updates automatically without a reload
- A sync indicator in the header shows live status (syncing / synced / error)

Every sync is *pull, merge, push*: the app never overwrites the server with its own copy. Caught, pending and shiny marks are merged one Pokémon at a time — each mark and un-mark carries a timestamp and the newer one wins — so marking different Pokémon on two devices, even while one is offline, loses nothing. Designer slots, saved IV sessions and PC box layouts are last-write-wins per section — the device that changed that section most recently wins, going by each device's own clock. Imported saves are merged per save, so two devices can each import a different one. The server only stores the merged blob.

All devices need to be on a version with this merge logic. An older client (for example an iOS build that hasn't been updated) still pushes whole snapshots without timestamps; newer devices will merge what it sends, but un-marks made on the old client won't propagate.

**Server snapshots.** Before a sync replaces the copy on the server, the server keeps the old one in `/data/snapshots`: one an hour for the last 24 hours, then one a day for 30 days (older ones are deleted). If something goes wrong — a "clear" you regret on another device, say — open **Settings → Sync → Server snapshots**, pick a time and restore it. The restore is checked like a backup file, replaces what's on that device, and then syncs to the others.

To use sync on your phone, open the same URL in your phone's browser and log in with your `APP_USER` and `APP_PASSWORD`.

## Offline mode

**Works without a connection.** In a browser the app installs a service worker the first time it loads. After that the app itself, the Pokédex data, moves and learnsets open with no network at all — on a phone with no signal, or when the server is down — and the sprites you have already seen are kept too. Changes made offline are stored on the device and sync the next time the server is reachable. A new version is picked up automatically the next time the app is opened online. Use your browser's **Add to Home Screen** / **Install app** to get it as an icon that opens full-screen. (Trainer portraits in Trainer Lookup come from Pokémon Showdown and need a connection.)

The login screen always offers **Use offline**, including when the server is unreachable. In offline mode nothing leaves the device: data lives in browser storage and no sync requests are made. On the iOS app that storage can be cleared when the app is updated through AltStore/SideStore, and only the sign-in details are kept in a second place — so on iOS, sign in to sync if the data matters. Settings → Sync shows which mode you're in. To start syncing later, choose **Sign in to sync** there — what's on the device is merged with what's on the server, and neither side is overwritten.
