# iOS app

## Install with AltStore or SideStore

1. In AltStore or SideStore, add this source:
   ```
   https://jabberwocky7777.github.io/Pokedex-Tracker/apps.json
   ```
2. Install **Pokedex Tracker** from it. Updates appear there when a new version is released.
3. On first launch, enter your sync server's address and sign in, or choose **Use offline**. On iOS, offline data lives only in the app's web storage, which an AltStore/SideStore update can clear — sign in to sync if the data matters (see [sync.md](sync.md#offline-mode)).

The IPA is ad-hoc signed by CI and attached to each [GitHub release](https://github.com/Jabberwocky7777/Pokedex-Tracker/releases); `apps.json` in the repository root is the source file.

The web app is wrapped as a native iOS app via [Capacitor](https://capacitorjs.com/). The Xcode project lives in `ios/` and targets iOS 15+.

## Building the IPA

You need a Mac with Xcode installed.

```bash
npm run build          # Build the web app
npx cap sync ios       # Sync web assets into the Xcode project
```

Then open `ios/App/App.xcodeproj` in Xcode and build/run on your device.

A GitHub Actions workflow (`.github/workflows/build-ios.yml`) can build an ad-hoc signed IPA on demand — trigger it manually from the **Actions** tab. The IPA is uploaded as a build artifact and can be sideloaded with [AltStore](https://altstore.io/) or similar tools.

> **Note:** The IPA workflow is manual-only (no automatic build on push) to avoid consuming macOS runner minutes on every commit.

## Releasing

The release steps (bump `MARKETING_VERSION`, build the IPA, create the release, update `apps.json` so its version matches exactly) are the checklist at the top of [CLAUDE.md](../CLAUDE.md#ios-release-checklist-altstoresidestore-source).
