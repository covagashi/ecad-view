# Installing Covaga ECAD Viewer

The viewer is one web app wrapped in thin native shells. Pick whatever fits how
you work — they all render the same viewer.

## In the browser (nothing to install)

Just open **[view.covaga.dev](https://view.covaga.dev)**. Works on desktop and mobile
browsers. This is the recommended way for most people.

## As an installed app (PWA)

The web app is a **Progressive Web App**: install it for an app-like window,
a launcher/desktop icon and **offline** use.

- **Chrome / Edge (desktop)** — click the install icon in the address bar, or
  *menu → Install Covaga ECAD Viewer*.
- **Safari (iPhone / iPad)** — Share → **Add to Home Screen**.
- **Chrome (Android)** — menu → **Install app** / *Add to Home screen*.

Once installed it keeps working without a network connection.

## Native desktop & mobile builds

Tagged releases publish native builds on the
[**Releases**](https://github.com/covagashi/ecad-view/releases) page:

| Platform | Artifact | Notes |
| --- | --- | --- |
| **Windows** | `.exe` installer (NSIS) / `.msi` | Tauri shell, uses the system WebView2. |
| **Android** | `.apk` | Capacitor shell. |
| **iOS** | Xcode project | Capacitor shell; build & sign in Xcode. |

> **macOS:** there is no prebuilt `.dmg` yet. You can run the web app / PWA
> today, or build the Tauri desktop shell locally (requires the Rust
> toolchain) — see
> [`docs/native-shells.md`](https://github.com/covagashi/ecad-view/blob/main/docs/native-shells.md).

### Windows: "Windows protected your PC"

If the installer isn't signed yet, Windows SmartScreen may warn you. Click
**More info → Run anyway** if you trust the source (you can verify by building
from source).

## Build it yourself

Requires Node.js ≥ 20.

```bash
git clone https://github.com/covagashi/ecad-view
cd ecad-view
npm install
npm run dev      # start the viewer (Vite dev server), then open the printed URL
npm run build    # production build (packages/e3d-core + apps/web)
```

Native shells (Tauri desktop, Capacitor mobile) are documented in
[`docs/native-shells.md`](https://github.com/covagashi/ecad-view/blob/main/docs/native-shells.md).
