# Reference material

Historical material from the reverse-engineering phase. **Nothing in this
directory is part of the build**, and it is kept only as a research
reference.

- `prototype/` — the first JavaScript prototype of the E3D reader
  (`e3d_reader.mjs`), origin of the TypeScript port in `packages/e3d-core`.
- `dataportal/` — a small Python client for the EPLAN Data Portal API used
  to download `.e3d` macros during research. Requires a personal access
  token; unrelated to the viewer itself.

The minified bundles of EPLAN's own web viewer that were originally studied
to understand the E3D format have been removed from the repository (and its
history), since they were proprietary EPLAN code. Everything learned from
them now lives in `packages/e3d-core` and is documented in
`docs/formats.md`.
