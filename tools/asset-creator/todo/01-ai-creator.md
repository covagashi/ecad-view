# TODO: AI-facing creator/viewer

Goal: an AI agent (Claude Code or any tool-using model) can **create** an
asset from a declarative spec and **see** what it built, iterating until it
looks right — without hand-writing binary formats or three.js code.

The loop to enable:

```
agent writes spec -> generate .e3d/.stl -> render preview PNG -> agent looks
        ^                                                          |
        +---------------------- adjust spec ----------------------+
```

## Phase 0 — CLI + agent skill (done)

No server, no protocol: two small scripts plus a skill document. This is
enough for any coding agent that can run shell commands.

- [x] **Scene spec (JSON, layered)**: declarative list of layers and ops.
      Each layer maps to a `typeId` (10 + layer index) for part picking.
      Supports params (arithmetic expressions), `repeat` for loops, and all
      op types from Scene API (`box`, `tube`, `ball`, `cone`, `prism`,
      `ring`, `oriented`, `part`, `label`). See
      [`docs/spec.md`](../docs/spec.md) for the full reference and
      [`examples/spm3.spec.json`](../examples/spm3.spec.json) for a 7-layer
      example (31 parts, 876 triangles).

- [x] `cli/create.mjs <spec.json> [--out dir] [--formats e3d,stl]` —
      validates the spec, builds the `Scene`, writes `.e3d`/`.stl` and
      `.layers.json` sidecar, prints a one-line summary per layer
      (name, parts, triangles). Always round-trips the `.e3d` through
      `parseE3d` before reporting success.

- [x] `cli/preview.mjs <file.e3d> [--angles iso,front,side,top] [--size 800]
      [--isolate <layer>] [--only-layers a,b]` — renders PNG(s) headless
      using three.js + playwright-core (browser bundle cached in tmpdir).
      Supports layer isolation via the `.layers.json` sidecar. First run
      installs Chromium; subsequent runs hit the cache.

- [x] `.claude/skills/asset-creator/SKILL.md` documenting the loop for
      agents: spec format (20-line summary + reference link), exact
      commands, gotchas (Z-up/-Y front, mm, avoid coplanar faces for
      z-fighting, precalculate trig, typeId contract).

## Phase 1 — MCP server (pending)

Wraps the same functions for editors/agents that speak MCP; only worth it
once Phase 0 works.

- [ ] stdio server (`@modelcontextprotocol/sdk`), tools:
      - `asset_create(spec) -> {path_e3d, path_stl, stats}`
      - `asset_preview(path, angles?) -> PNG(s)` (image content blocks)
      - `asset_validate(path) -> parse report`
      - `primitives_list() -> op reference with parameter docs`
- [ ] Expose generated files as MCP resources so clients can fetch them.
- [ ] Config snippet for `.mcp.json` in the README.

## Phase 2 — live viewer integration (pending, nice to have)

- [ ] Dev mode where the web viewer watches an output directory (or gets a
      WebSocket ping) and hot-reloads the model after each `create` — turns
      the loop into "edit spec, glance at browser".
- [ ] Use part `objectId` picking (already in the viewer) to report which
      spec item the user/agent clicked.

## Technical notes — Phase 0

- **`preview.mjs` implementation:** bundles a three.js + `buildThreeScene`
  harness with **esbuild** into a self-contained IIFE, caches it in
  `tmpdir()` (never touches repo), and drives it headless with
  **playwright-core** + the system Chromium. First run installs Chromium to
  tmpdir if needed; subsequent runs reuse the cached bundle and browser.
  Avoids app-build dependencies and is much faster than driving the web
  viewer.

## Open questions

- JSON spec vs. letting the agent write a `.mjs` against the `Scene` API
  directly. JSON is safer to validate and easier to diff; JS is more
  expressive (loops for screw rows). Phase 0 can support both: `create`
  accepts a `.json`, examples show the `.mjs` route.
- Where rendered previews land (`examples/out/` vs a temp dir) and whether
  they should ever be committed (probably never; keep `out/` gitignored).
