# Reference material

Historical material from the reverse-engineering phase. **Nothing in this
directory is part of the build**, and it is kept only as a research
reference.

- `prototype/` — the first JavaScript prototype of the E3D reader
  (`e3d_reader.mjs`), origin of the TypeScript port in `packages/e3d-core`.
- `dataportal/` — a small Python client for the EPLAN Data Portal API used
  to download `.e3d` macros during research. Requires a personal access
  token; unrelated to the viewer itself.
- `eplan-viewer-bundle-main.js` / `eplan-viewer-bundle-main-copia.js` —
  minified JavaScript bundles of EPLAN's own web viewer, studied to
  understand the E3D format. **These are proprietary EPLAN code and are not
  covered by this repository's MIT license.** They should be removed from
  the repository history before wide distribution; they remain here only
  until the format documentation in `docs/formats.md` no longer needs them.
