# Covaga ECAD Project Viewer

An open-source, browser-based viewer for **EPLAN** electrical CAD projects.
Open `.epdz` project exports and `.e3d` 3D parts directly in your browser —
no EPLAN installation, no server, no upload. Everything is parsed and
rendered locally on your device, on desktop and mobile.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/covagashi/ecad-view?sort=semver)](https://github.com/covagashi/ecad-view/releases)
[![CI](https://github.com/covagashi/ecad-view/actions/workflows/ci.yml/badge.svg)](https://github.com/covagashi/ecad-view/actions/workflows/ci.yml)
[![Web app](https://img.shields.io/badge/web%20app-view.covaga.dev-5b9dff)](https://view.covaga.dev)

▶ **Try it now — no install:** [view.covaga.dev](https://view.covaga.dev) ·
📥 **Downloads:** [Releases](https://github.com/covagashi/ecad-view/releases) ·
📖 **User guide:** [Wiki](https://github.com/covagashi/ecad-view/wiki) ·
**Source:** [github.com/covagashi/ecad-view](https://github.com/covagashi/ecad-view)

> **Disclaimer:** this is an independent community project. It is not
> affiliated with, endorsed by, or supported by EPLAN GmbH & Co. KG.
> EPLAN is a trademark of its respective owner.

| 3D models | Schematic pages |
| --- | --- |
| ![3D viewer](docs/screenshots/viewer-3d.png) | ![Schematics](docs/screenshots/schematics.png) |

| Project info (SQLite manifest) | Mobile |
| --- | --- |
| ![Project info](docs/screenshots/project-info.png) | ![Mobile](docs/screenshots/mobile.png) |

## Install

The easiest way is to **not** install anything: open
**[view.covaga.dev](https://view.covaga.dev)** in any modern browser (desktop or mobile).
It's a Progressive Web App, so you can also *Install / Add to Home Screen* for an
app window and **offline** use.

Prefer a native build? Grab one from the
[**Releases**](https://github.com/covagashi/ecad-view/releases) page:

| Platform | Download | Notes |
| --- | --- | --- |
| **Web / PWA** | [view.covaga.dev](https://view.covaga.dev) | Recommended. Works everywhere, installable, offline. |
| **Windows** | `.exe` (portable / NSIS) · `.msi` | Uses the built-in WebView2 (Win 10/11). |
| **macOS** | PWA, or build from source | No prebuilt `.dmg` yet; install the PWA from Safari or build the Tauri shell locally. |
| **Android** | `.apk` | Sideload; the release APK is self-signed (not from Play Store). |
| **iOS** | Xcode project | Build & sign in Xcode, or just install the PWA from Safari. |

See the [**user guide (Wiki)**](https://github.com/covagashi/ecad-view/wiki) for
how to open a project, navigate the 3D/schematics, and export a `.epdz` from
EPLAN. Packaging details live in
[`docs/native-shells.md`](docs/native-shells.md) and
[`docs/packaging.md`](docs/packaging.md).

## Features

- **`.epdz` support** — EPLAN project exports are opened fully client-side
  (they are 7-zip archives, extracted in the browser with WebAssembly).
- **3D viewer** — interprets the proprietary binary **E3D** format (versions
  1–4) and renders it with three.js: faces with per-group materials,
  transparency, edge/contour lines, textures and text labels. Orbit, zoom
  and part picking (with EPLAN `typeId` / `objectId` metadata).
- **2D schematics** — renders the project's SVG pages with pan, wheel zoom,
  pinch-zoom and double-tap refit. EPLAN's embedded scripting is sanitized
  and relative resources are resolved from inside the archive.
- **Cross-reference navigation** — the original `jumpToFunction` links in the
  schematics are turned into in-app navigation: click a symbol or cross
  reference to jump between the occurrences of a device, with the target
  framed and highlighted.
- **Device search** — a device index is built from the symbols of all pages;
  search a device and jump to (and cycle through) its occurrences.
- **Project tree** — hierarchical structure navigation (functional
  assignment, location…) built from the `manifest.db` structured
  identifiers, next to the flat page list.
- **Project metadata from SQLite** — reads the archive's `manifest.db`
  (via sql.js) to show the real project structure: structured page names
  and breadcrumbs, project properties (creator, company, EPLAN version…),
  functions, locations, and the mapping from installation spaces to 3D
  models.
- **Cross-platform by design** — one TypeScript codebase; responsive UI for
  desktop and mobile browsers. The app installs as a **PWA** (offline
  support via service worker), and thin native shells for desktop (Tauri)
  and mobile (Capacitor) wrap the same web core — see
  [`docs/native-shells.md`](docs/native-shells.md).
- **Made for reviews** — eight UI languages, light/dark themes, session
  restore, and an optional **keep-screen-awake** toggle so the display won't
  sleep during a long walkthrough (Settings → Display).
- **Privacy-friendly** — files never leave your device.

## Quick start

Requires Node.js ≥ 20.

```bash
npm install
npm run dev            # build the core and start the viewer (Vite dev server)
```

Then open the printed URL and drag in a `.epdz` or `.e3d` file, or open the
bundled demo files from **Settings → Sample files**.

Other commands:

```bash
npm run build          # full production build (packages/e3d-core + apps/web)
npm run test:samples   # parse the sample E3D files and validate the interpreter
```

## Getting a `.epdz` out of EPLAN

The viewer opens the **Smart Production** publication of a project (a `.epdz`
file): *File → Publish → Smart Production Collection* in EPLAN Electric P8
(2022 or newer), or run the
[`tools/eplan/PublishEpdz.cs`](tools/eplan/PublishEpdz.cs) script. Step-by-step
instructions (and what the export does and doesn't contain) are in the
[**wiki**](https://github.com/covagashi/ecad-view/wiki/Exporting-a-Project-from-EPLAN).

## Repository layout

```
packages/e3d-core/   The format library (TypeScript, no UI):
                       reader.ts    E3D binary parser (v1-v4)
                       epdz.ts      .epdz extraction (7z-wasm)
                       manifest.ts  manifest.db reader (sql.js / SQLite)
                       three/       E3D scene -> three.js builder
apps/web/            The viewer app (Vite + React + three.js). Installable
                     as a PWA (manifest + service worker).
apps/desktop/        Tauri desktop shell wrapping apps/web (Rust toolchain).
apps/mobile/         Capacitor mobile shell wrapping apps/web (own install).
samples/             Sample files: a .epdz project export (EPLAN demo
                     content) and a standalone .e3d part.
docs/                Format documentation and screenshots.
wiki/                User-facing guide (source of the GitHub Wiki).
scripts/             Development scripts (parser smoke test).
tools/eplan/         EPLAN-side helper scripts (publish a project as .epdz).
tools/asset-creator/ Tooling to author .e3d parts (geometry lib, writers).
reference/           Historical reverse-engineering material and early
                     prototypes. Not part of the build. See reference/README.md.
```

## File formats

Detailed notes live in [`docs/formats.md`](docs/formats.md):

- **`.e3d`** — little-endian binary scene format: header (version, view,
  background colors), then length-prefixed arrays of lights, textures
  (uncompressed BGRA), meshes (interleaved vertex buffer + face/edge groups
  with OpenGL-style primitive modes) and parts (mesh instance + 4x4
  transform + color + text labels). Z-up.
- **`.epdz`** — a **7-zip** archive containing `manifest.db` (SQLite project
  database), `packages/pages/**/*.svg` (schematic pages),
  `packages/installationspaces/**/*.E3d` (3D) and AutomationML.

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). 
