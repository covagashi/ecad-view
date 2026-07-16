# FAQ

### Do my files get uploaded anywhere?

No. Every `.epdz` / `.e3d` is extracted, parsed and rendered **on your device**.
Nothing is sent to a server — you can confirm by using the app offline.

### Do I need EPLAN installed to use the viewer?

No. You only need EPLAN (Electric P8 2022+) to **produce** the `.epdz` export in
the first place — see [[Exporting a Project from EPLAN]]. Opening and viewing it
needs nothing but a browser.

### The Project view is empty / greyed out.

That view is built from the archive's `manifest.db`. A standalone `.e3d` part or
a `.epdz` without a manifest won't have it. Make sure you exported via **Smart
Production** (not a bare model export).

### I don't see my parts lists / terminal diagrams.

Report pages (BOM, terminal diagrams, cable plans…) are only in the `.epdz` if
they were generated **as pages** in the project *before* publishing. Generate
them in EPLAN, then re-export.

### "View in schematics" is disabled for a 3D part.

That means the selected 3D object has no matching device in the 2D pages of this
export (or the pages weren't included). Parts without a schematic counterpart
can still be isolated, hidden and framed.

### Which browsers are supported?

Any modern browser (Chrome, Edge, Firefox, Safari). A couple of conveniences
depend on the engine:

- **Linking a folder / reopening recent files** works only in Chromium-based
  browsers (Chrome/Edge), which support the File System Access API. Elsewhere,
  use *Open file* or drag & drop.
- **Keep screen awake** appears only where the Screen Wake Lock API exists
  (most current browsers; not older Safari).

### How do I stop the screen from sleeping during a review?

**Settings → Display → Keep screen awake.** It holds a screen wake lock while
the tab is in the foreground, so the display won't dim or sleep. See
[[Navigating the Viewer]].

### Is there a macOS app?

Not a prebuilt one yet. Use the web app or install it as a PWA today, or build
the Tauri desktop shell from source. See [[Installing Covaga ECAD Viewer]].

### It's slow to open a big `.epdz`.

Large exports take a few seconds: the archive is decompressed (7-zip in
WebAssembly) and the SQLite manifest is read, all client-side. Subsequent
interactions are fast.

### Can I contribute / report a bug?

Yes — issues and pull requests are welcome on
[GitHub](https://github.com/covagashi/ecad-view). See
[CONTRIBUTING.md](https://github.com/covagashi/ecad-view/blob/main/CONTRIBUTING.md).

### Is this an official EPLAN product?

No. It's an independent, open-source community project, not affiliated with or
endorsed by EPLAN GmbH & Co. KG. EPLAN is a trademark of its respective owner.
