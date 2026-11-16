# Android

Pokédex Tracker runs on Android as a signed APK built from the same web app as the browser and iOS versions (Capacitor 8). It installs and updates through [Obtainium](https://obtainium.imranr.dev/) from this repository's GitHub releases, opens from any launcher (including Cocoon on the AYN Thor) on either screen of a dual-screen handheld, and reads the save files your emulators write — linked once, then re-read in one tap.

## Install

### Obtainium (updates included)

1. In Obtainium, **Add app**, and enter `https://github.com/Jabberwocky7777/Pokedex-Tracker` as the app source URL.
2. Install. Android asks once to allow Obtainium to install apps.

Or open this link on the device with Obtainium installed:

```
https://apps.obtainium.imranr.dev/redirect?r=obtainium://app/%7B%22id%22%3A%22com.local.pokedextracker%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2FJabberwocky7777%2FPokedex-Tracker%22%2C%22author%22%3A%22Jabberwocky7777%22%2C%22name%22%3A%22Pok%C3%A9dex%20Tracker%22%7D
```

Each new release then shows as an update and installs over the top, keeping your data. Obtainium reads the release's APK and ignores the IPA and the web zip; if another APK ever joins a release, filter APKs in the app's Obtainium settings with `PokedexTracker\.apk$`. If Obtainium tracks many GitHub apps and hits GitHub's rate limit, add a fine-grained personal access token in its settings.

### By hand

Download `PokedexTracker.apk` from the [latest release](https://github.com/Jabberwocky7777/Pokedex-Tracker/releases/latest) and open it (allow installing from your browser or file manager once). Updates install over the top the same way.

### Things to know

- **The first release with an APK is 1.9.** Older tags have none.
- **Uninstalling removes this device's data.** Marks, saves and settings live in the app's storage. Sign in to your sync server, or use **Settings → Data → Export backup** (the share sheet lets you put the file anywhere), before uninstalling. In "Use offline" mode the app asks for a backup when there has been none for two weeks.
- **A signature mismatch means uninstalling.** Android only installs an update signed with the same key as the installed app. Every release is signed with one key (fingerprint below). If Android refuses an update, the installed copy came from somewhere else: back up, uninstall it, then install the release.
- **Debug builds are a separate app** (`com.local.pokedextracker.debug`, "Pokédex Tracker (debug)") with their own data, so they can sit beside the release.
- **Sync needs an HTTPS server.** The app's page is `https://localhost`, so a plain `http://` server address is blocked by the web view. Your server must allow the origin `https://localhost` — images from 1.9 on do; for an older image set `CORS_ORIGIN=https://localhost` in `.env` until you update it.
- **Android System WebView 99 or later** (Chromium) is needed; an older one shows a page saying to update it, with the version it found. 111 or later looks best (some colour blending is plainer before it).

## Save files

The Saves section of **My games** imports `.sav`, `.srm` and `.dsv` files — cartridge dumps and emulator saves alike. Games are recognised by their contents, never by file name. DeSmuME's `.dsv` footer and the few extra bytes some GBA emulators add are ignored; a RetroArch save written with SaveRAM compression gets a message saying to turn that off.

- **Import a save** opens Android's file picker, for a one-off file.
- **Link a save folder** keeps read access to a folder: its saves are listed by game, with what changed since the last import, and **Update all** re-reads them — no picker. Changes are looked for whenever you come back to the app. The app only ever reads; it never writes into a linked folder.
- **Open with / Share** from a file manager or a save editor hands one save to the app.

### Where emulators keep saves

Android doesn't let one app read another's private folder (`Android/data/…`), nor link the top of storage or the Download folder itself. Keep saves in an ordinary folder — the same one a save editor such as PKForge links:

| Emulator                                 | Setting                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| melonDS / MelonDualDS                    | Settings → Save files: turn off **Save next to ROM file** and pick a folder (for example `Saves/nds` on internal storage or the SD card). Games launched from a frontend such as Cocoon otherwise save under `Android/data/me.magnum.melonds/files/saves`, which no other app can read — move those out with the Files app or `adb pull`. MelonDualDS can write `.sav` or `.srm`; both work. |
| DraStic                                  | Saves are in `DraStic/backup` (`.dsv`).                                                                                                                                                                                                                                                                                                                                                      |
| RetroArch                                | Settings → Saving → **SaveRAM Compression** off. Saves are in `RetroArch/saves` (`.srm`).                                                                                                                                                                                                                                                                                                    |
| GBA emulators (mGBA, Pizza Boy, Linkboy) | Their saves folder; `.sav` or `.srm`.                                                                                                                                                                                                                                                                                                                                                        |

Save in the game (not just a save state) before updating: the app reads the battery save, and loading an older save state brings old data back.

## Controls

Touch works everywhere. With a controller (a handheld's built-in one):

| Control     | Does                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D-pad       | Moves between buttons and Pokémon (arrow keys walk the tracker's grid and list)                                                               |
| A           | Presses the focused button; on a Pokémon in the tracker, opens its details                                                                    |
| B           | Back: closes what is open (a dialog, a sheet, the detail panel, a menu), or goes back; at the first screen the app is minimised, never closed |
| X           | Toggles caught on the focused (or selected) Pokémon                                                                                           |
| Y           | Search everything                                                                                                                             |
| L1 / R1     | Previous / next tab                                                                                                                           |
| Start       | The open tab's sections                                                                                                                       |
| Right stick | Scrolls                                                                                                                                       |

System Back does what B does. **Settings → Appearance** also has, on Android only: **Display size** (fits more on a small screen), **Show the status and navigation bars** (off by default, so the page gets the height) and **Keep the controller on the game** (for a dual-screen handheld: touching the app doesn't take the controller from the game on the other screen; typing needs it off). Below them, **Screens** lists the screens Android reports, which one the app is on and the page size there, with **Copy** — include it when reporting a layout or keyboard problem.

## AYN Thor and Cocoon

The app is an ordinary Android app, so it needs no set-up in Cocoon beyond placing it:

1. In Cocoon, open the App Drawer from the dock and find Pokédex Tracker.
2. Press **Y**: add it to the dock, and to Home if you like.
3. **Y → Edit app**: set the launch display. Bottom suits using it beside a GBA game on top; top suits planning with the controller.
4. Optionally set the artwork from [`docs/android/cocoon/`](android/cocoon/) (a square icon, a 1920 × 1080 hero and the name). Leave "treat as a game" off unless you want playtime tracked.

On the stock AYN launcher: long-press the app, **Screen launch**: Auto, Top screen or Bottom screen. Launching the app again resumes it; moving it to the other screen re-lays it out without reloading. Long-press the icon for shortcuts to the Tracker, your saves and Where to go.

Layout: a window at least 600 px wide and at most 500 px tall (the top screen) puts the tabs in a rail down the left; a smaller, squarer one (the bottom screen) keeps the bottom bar, icons only. `E2E_ONLY=thor npm run e2e` and `SIZES=thor npm run screenshots` check and show both in a browser.

## Building

The Android project is `android/`, generated by Capacitor and committed. Its web content comes from `dist/`.

Needs Node 22+, JDK 21 and the Android SDK (platform 36, build-tools 36, platform-tools) with `ANDROID_HOME` set — Android Studio 2025.2.1 or later installs them.

```bash
npm run build && npm run android:sync
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb logcat -s Capacitor chromium
```

Open `chrome://inspect` on the computer for the web view's console (debug builds allow it).

Without a local SDK, CI builds one: every push to `main` that touches `android/`, `capacitor.config.ts` or `package.json` runs **Android build** (`.github/workflows/android-check.yml`), whose run has the debug APK as an artifact. **Build Android APK** (`build-android.yml`) builds a signed release by hand:

```bash
gh workflow run build-android.yml --repo Jabberwocky7777/Pokedex-Tracker
gh run download <run-id> --repo Jabberwocky7777/Pokedex-Tracker --name PokedexTracker-APK
```

- **Version:** `android/app/build.gradle` reads `package.json`: version name `1.9` (or `1.9.1`), version code `major × 1,000,000 + minor × 1,000 + patch` (1.9.0 → 1009000). `npm run version:set` needs no Android step, and `npm run version:check` fails if a literal version is written into the Gradle file.
- **Application id:** `com.local.pokedextracker`, the same as the iOS bundle id. It can never change: Android treats a new id as a different app.
- **Native code** (`android/app/src/main/java/com/local/pokedextracker/`): `MainActivity` (controller buttons), `SaveFoldersPlugin` (linked folders, Open with / Share; its scan rules mirror `src/lib/save/folder-scan.ts`) and `AppWindowPlugin` (keep the controller on the game, display info). The web side is `src/lib/android.ts`, loaded only in the Android app.
- **Sprites:** the app carries its 2,251 sprites (each Pokémon's default, Gen 3 FR/LG and Gen 4 HG/SS sprite and the two shiny sets, about 1.9 MB). `npm run fetch-sprites` downloads them from PokéAPI's sprites repository at `POKEAPI_SPRITES_COMMIT` (`scripts/constants.ts`) into `dist/sprites/` with a `manifest.json`; `npm run android:sync` runs it, and both Android workflows run it after the build, caching the downloads. When `pokemon.json` loads, `src/lib/bundled-sprites.ts` points each sprite at its bundled copy if the manifest has it, so the app needs no network for them. Browsers still load sprites from GitHub (the service worker keeps them), and the images are never committed. Without this, GitHub's 5-minute cache made the app download hundreds of sprites again on every visit to a big grid.
- **Icons:** `npm run generate:icon` writes the launcher icons (adaptive, with the Poké Ball inside the safe zone on `#030712`) and the Cocoon artwork.

## Signing

Every release APK is signed with one permanent key. It is created once, by the repository owner, on a trusted machine — never by CI and never committed.

On Windows, `scripts/android-signing-setup.ps1` does all of the below: it asks for the password (never shown or saved), creates `pokedex-tracker-release.jks` in your user folder, sets the three secrets and `ANDROID_RELEASES`, and writes `android/signing-cert-sha256.txt` for you to commit:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\android-signing-setup.ps1
```

By hand, anywhere:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ~/pokedex-tracker-release.jks \
  -alias pokedextracker -keyalg RSA -keysize 4096 -validity 36500 \
  -dname "CN=Pokedex Tracker, O=Jabberwocky7777"

keytool -list -v -keystore ~/pokedex-tracker-release.jks -alias pokedextracker | grep SHA256
```

Keep the keystore and its password in a password manager **and** an offline backup: losing either means every user has to uninstall and reinstall. **Never share either one** — not in an issue, a chat, a commit or a message to an assistant. Anyone with both can sign an update that installs over the real app. The fingerprint is the only public part.

Then give it to GitHub Actions and turn Android releases on:

```bash
base64 -w0 ~/pokedex-tracker-release.jks | gh secret set ANDROID_KEYSTORE_BASE64 --repo Jabberwocky7777/Pokedex-Tracker
gh secret set ANDROID_KEYSTORE_PASSWORD --repo Jabberwocky7777/Pokedex-Tracker
gh secret set ANDROID_KEY_ALIAS --repo Jabberwocky7777/Pokedex-Tracker --body pokedextracker
gh variable set ANDROID_RELEASES --repo Jabberwocky7777/Pokedex-Tracker --body true
```

(On macOS use `base64 -i` instead of `base64 -w0`.) A PKCS12 store uses one password for the store and the key. Commit the certificate's SHA-256 fingerprint — lower-case hex, no colons — as `android/signing-cert-sha256.txt`; it is public. `build-android.yml` fails if an APK is signed with any other key.

Until `ANDROID_RELEASES` is `true`, a tagged release builds no APK and is otherwise unchanged.

**Release signing fingerprint (SHA-256):** see [`android/signing-cert-sha256.txt`](../android/signing-cert-sha256.txt) once it exists. `apksigner verify --print-certs PokedexTracker.apk` on a downloaded APK must show the same.

## Device measurements

Phase 4's layout started from estimates (top screen about 640–730 × 360–410 CSS px, bottom about 410–470 × 360–410). Measure on the device and record the numbers here:

```bash
adb shell wm size
adb shell wm density
adb shell dumpsys display | grep -E "mDisplayId|mBaseDisplayInfo|DisplayDeviceInfo"
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell dumpsys package com.google.android.webview | grep versionName
```

With a debug build open, `chrome://inspect` → the web view's console: `innerWidth`, `innerHeight`, `devicePixelRatio` on each screen, with the system bars hidden and shown.

|                                                          | Top screen | Bottom screen |
| -------------------------------------------------------- | ---------- | ------------- |
| Physical (`wm size`)                                     |            |               |
| Density (`wm density`)                                   |            |               |
| CSS viewport, bars hidden                                |            |               |
| CSS viewport, bars shown                                 |            |               |
| `devicePixelRatio`                                       |            |               |
| Android version / API                                    |            |               |
| WebView version                                          |            |               |
| Controller key codes (A, B, X, Y, L1, R1, Start, sticks) |            |               |

## Device test log

Record each build tested on the device: the build (version, or the CI run), the date, and any row that didn't pass.

| Area              | Test                                                                            | Pass when                                                                |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Install           | `adb install -r` the CI-built APK                                               | Installs; label and icon correct                                         |
| First run         | Use offline                                                                     | Tracker shows 493 Pokémon; no blank screen                               |
| Persistence       | Mark five Pokémon, force-stop, reopen                                           | Marks are still there                                                    |
| Sync              | Sign in to the HTTPS server                                                     | Sync dot goes green; a mark made on another device appears               |
| Sync errors       | Enter an `http://` address                                                      | A clear message, no hang                                                 |
| Picker import     | Import a save through the file picker                                           | Import review opens; boxes browse correctly                              |
| Link a folder     | Link the saves folder                                                           | Saves listed by game; folder survives a restart                          |
| Refused folders   | Try the storage root and Download                                               | A plain explanation, no crash                                            |
| Change detection  | Save in-game, return to the app                                                 | "Changed" shown; Update all re-imports without a picker                  |
| Formats           | `.sav`, `.srm`, `.dsv`, GBA save                                                | All import; a compressed `.srm` gives the RetroArch message              |
| PKForge           | Edit a Pokémon in PKForge, return                                               | Change detected; History shows the difference                            |
| Revoked grant     | Remove the folder permission in Android settings                                | Folder disappears from the list; nothing breaks                          |
| Open with         | Open a `.sav` from a file manager                                               | The app opens on Saves and imports it                                    |
| Top screen        | Walk every tab                                                                  | No clipped or overlapping UI; the rail, not a bottom bar                 |
| Bottom screen     | Walk every tab by touch                                                         | Usable at the measured size; sheets fit                                  |
| Move displays     | Launch on one display, then the other                                           | App moves and re-lays out with state intact                              |
| Controller        | D-pad, A, B, L1/R1, X, Y, Start, right stick                                    | Each does what Controls says; focus ring always visible                  |
| Back              | B from a dialog, a detail panel, the first screen                               | Closes, closes, minimises; never a white screen                          |
| Share out         | Export a backup                                                                 | Share sheet opens with the file                                          |
| Offline           | Airplane mode, cold start                                                       | App opens and works; note which sprites are missing                      |
| Obtainium install | Add the repo URL                                                                | Version shown as 1.9 with detection on                                   |
| Obtainium update  | Publish `v1.9.1`                                                                | Update offered, installs over the top, data and linked folders kept      |
| Cocoon            | App Drawer, dock, Edit app display                                              | Launches on the chosen display; Home returns to Cocoon; relaunch resumes |
| Beside a game     | Gen III game on top, tracker on bottom                                          | Both stay responsive; updating the save doesn't disturb the game         |
| Device states     | Lid closed and reopened, bottom screen off, the Thor's BACK key mapping changed | Nothing lost; Back still works                                           |

## Not yet

- **Offline sprites:** sprites load from `raw.githubusercontent.com` and the service worker that keeps them is off in the apps, so sprites the web view's cache has dropped are missing offline.
- **Plain-HTTP servers:** would need mixed content and cleartext traffic allowed, limited to private address ranges.
- **Two-screen mode** (the list on one screen, the selected Pokémon on the other), a guided first run, and a home-screen widget come after the first release.
