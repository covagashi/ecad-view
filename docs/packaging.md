# Packaging the Covaga ECAD Viewer

The web app (`apps/web`) is the single source; every platform package wraps the same
`apps/web/dist` build. Always run `npm run build` at the repo root first.

## Windows (Tauri)

Requirements: Rust toolchain, WebView2 runtime (preinstalled on Windows 10/11), Node.

```bash
npm run build                          # builds apps/web/dist
cd apps/desktop/src-tauri
npx @tauri-apps/cli build              # release exe + NSIS installer
```

Outputs (under `apps/desktop/src-tauri/target/release/`):

- `covaga-desktop.exe` + `WebView2Loader.dll` — portable pair (no install
  needed). With the GNU Rust toolchain the WebView2 loader is a DLL that must
  sit next to the exe; building with the MSVC toolchain
  (`x86_64-pc-windows-msvc`, requires VS Build Tools) links it statically,
  producing a true single-file exe.
- `bundle/nsis/Covaga ECAD Viewer_<version>_x64-setup.exe` — installer.

Icons live in `apps/desktop/src-tauri/icons/` and were generated from `icon.png`
with `npx @tauri-apps/cli icon icons/icon.png -o icons`.

## Android (Capacitor)

Requirements: JDK 21 and an Android SDK (platform 35, build-tools 35). Portable
copies are expected at `D:\3_workbench\tools\jdk21` and
`D:\3_workbench\tools\android-sdk` (see `apps/mobile/android/local.properties`).

```bash
npm run build
cd apps/mobile
npm install
npx cap sync android
cd android
JAVA_HOME=<jdk21> ./gradlew assembleDebug assembleRelease
```

Outputs (under `apps/mobile/android/app/build/outputs/apk/`):

- `debug/app-debug.apk` — signed with the debug key, directly installable (sideload).
- `release/app-release-unsigned.apk` — must be signed before installing:

```bash
keytool -genkeypair -keystore covaga.keystore -alias covaga -keyalg RSA -keysize 2048 -validity 10000
<build-tools>/35.0.0/apksigner sign --ks covaga.keystore --out app-release.apk app-release-unsigned.apk
```

## iOS (Capacitor)

The Xcode project is generated at `apps/mobile/ios/` (`npx cap add ios` +
`npx cap sync ios`), branded with the app icon and display name. Building the
`.ipa` requires macOS with Xcode and an Apple Developer signing identity — it
cannot be produced on Windows:

```bash
cd apps/mobile
npx cap sync ios
npx cap open ios          # opens Xcode: set the signing team, then Product > Archive
```

Alternative without a Mac: the web app is a PWA — on iOS Safari open the hosted
viewer and use "Add to Home Screen" for an installable, offline-capable app.
