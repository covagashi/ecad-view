# Wiki sources

These Markdown files are the **user-facing** GitHub Wiki for the project (the
`README` and `docs/` cover developer/format detail). They're kept here so the
wiki is versioned and reviewable alongside the code.

## Pages

| File | Wiki page |
| --- | --- |
| `Home.md` | Landing page |
| `Getting-Started.md` | First run, opening files |
| `Exporting-a-Project-from-EPLAN.md` | Producing a `.epdz` |
| `Navigating-the-Viewer.md` | 3D, schematics, cross-refs, settings |
| `Installing-Covaga-ECAD-Viewer.md` | Web/PWA, Windows, macOS, Android, iOS |
| `FAQ.md` | Common questions & troubleshooting |
| `_Sidebar.md` / `_Footer.md` | Wiki navigation chrome |

Wiki links use the `[[Page Name]]` syntax; images are referenced by absolute
`raw.githubusercontent.com` URLs so they render inside the wiki.

## Publishing to the GitHub Wiki

The wiki repo (`ecad-view.wiki.git`) only exists **after** the first page is
created once through the web UI:

1. Open **https://github.com/covagashi/ecad-view/wiki** and click
   **Create the first page** → Save (any content; it will be overwritten).
2. Push these files:

   ```bash
   git clone https://github.com/covagashi/ecad-view.wiki.git
   cp wiki/*.md ecad-view.wiki/
   cd ecad-view.wiki
   git add -A && git commit -m "Populate wiki" && git push
   ```

After that, editing a file here and re-pushing keeps the wiki in sync.
