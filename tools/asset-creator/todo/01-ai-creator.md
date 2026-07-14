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

## Phase 0 — CLI + agent skill (cheapest, do first)

No server, no protocol: two small scripts plus a skill document. This is
enough for any coding agent that can run shell commands.

- [ ] **Scene spec (JSON)**: a declarative list of ops mapping 1:1 to the
      `Scene` API. Keep it dumb on purpose:

      ```json
      {
        "name": "my-part",
        "items": [
          { "op": "box",  "center": [0,0,30], "size": [40,20,60], "color": [0.8,0.8,0.8] },
          { "op": "tube", "from": [0,-12,50], "to": [0,-18,50], "radius": 3, "color": [0.7,0.7,0.75] },
          { "op": "label", "text": "K1M", "position": [0,-22,50], "height": 10 }
        ]
      }
      ```

- [ ] `cli/create.mjs <spec.json> [--out dir] [--formats e3d,stl]` —
      validates the spec, builds the `Scene`, writes the outputs, prints a
      one-line summary (parts/tris/bytes). Always round-trip the `.e3d`
      through `parseE3d` before reporting success.
- [ ] `cli/preview.mjs <file.e3d> [--angles front,iso] [--size 800]` —
      renders PNG(s). Pragmatic first implementation: drive the built web
      viewer with playwright (load file via the `<input type="file">`,
      orbit, screenshot). Later: direct three.js offscreen rendering using
      `buildThreeScene` from `@byndr/e3d-core`, which drops the app build
      dependency and is much faster.
- [ ] `.claude/skills/asset-creator/SKILL.md` documenting the loop for
      agents working in this repo: spec format, commands, viewer gotchas
      (Z-up/-Y front, mm, avoid coplanar faces -> z-fighting).

## Phase 1 — MCP server

Wraps the same functions for editors/agents that speak MCP; only worth it
once Phase 0 works.

- [ ] stdio server (`@modelcontextprotocol/sdk`), tools:
      - `asset_create(spec) -> {path_e3d, path_stl, stats}`
      - `asset_preview(path, angles?) -> PNG(s)` (image content blocks)
      - `asset_validate(path) -> parse report`
      - `primitives_list() -> op reference with parameter docs`
- [ ] Expose generated files as MCP resources so clients can fetch them.
- [ ] Config snippet for `.mcp.json` in the README.

## Phase 2 — live viewer integration (nice to have)

- [ ] Dev mode where the web viewer watches an output directory (or gets a
      WebSocket ping) and hot-reloads the model after each `create` — turns
      the loop into "edit spec, glance at browser".
- [ ] Use part `objectId` picking (already in the viewer) to report which
      spec item the user/agent clicked.

## Open questions

- JSON spec vs. letting the agent write a `.mjs` against the `Scene` API
  directly. JSON is safer to validate and easier to diff; JS is more
  expressive (loops for screw rows). Phase 0 can support both: `create`
  accepts a `.json`, examples show the `.mjs` route.
- Where rendered previews land (`examples/out/` vs a temp dir) and whether
  they should ever be committed (probably never; keep `out/` gitignored).
