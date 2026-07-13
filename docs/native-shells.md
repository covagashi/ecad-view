# Native shells

The viewer is a single web codebase (`apps/web`). The native shells are thin
wrappers around that same build — they add no viewer logic of their own.

```
apps/desktop/   Tauri 2 shell (Windows / macOS / Linux)
apps/mobile/    Capacitor 7 shell (iOS / Android)
```

Both shells load the production bundle from `apps/web/dist`, so always run
`npm run build` at the repository root first (the shell configs also do this
automatically where the tooling supports it).

## Desktop (Tauri)

Prerequisites: [Rust](https://rustup.rs) and the
[Tauri 2 system dependencies](https://tauri.app/start/prerequisites/) for your
platform.

```bash
cargo install tauri-cli --locked   # once

cd apps/desktop/src-tauri
cargo tauri dev        # develop against the Vite dev server
cargo tauri build      # production bundle (installer per platform)
```

The configuration lives in `apps/desktop/src-tauri/tauri.conf.json`:
`frontendDist` points at `apps/web/dist` and `beforeBuildCommand` triggers the
root web build. To regenerate the full platform icon set from the app icon,
run `cargo tauri icon icons/icon.png`.

## Mobile (Capacitor)

Prerequisites: Android Studio (Android) and/or Xcode (iOS).

```bash
npm run build                      # build the web core at the repo root

cd apps/mobile
npm install                        # Capacitor is not part of the root workspace
npx cap add android                # once per platform
npx cap add ios                    # (macOS only)
npx cap sync                       # copy apps/web/dist into the platforms
npx cap run android                # or: npx cap open android / ios
```

The generated `android/` and `ios/` projects are ignored by git; they are
recreated with `npx cap add`. The app id and web directory are configured in
`apps/mobile/capacitor.config.json`.

## Notes

- Everything keeps working fully offline in the shells: files are parsed
  locally by design, and the WebAssembly modules (7z, sql.js) ship inside the
  web bundle.
- The web app also installs as a PWA (manifest + service worker), which covers
  the "install on device" use case without any native toolchain.
