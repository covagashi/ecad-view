# Asset creator — roadmap

Working notes for turning the core library into a full creator/viewer
pipeline. Each area has its own document under [`todo/`](todo/).

## Done

- [x] Geometry library: unit primitives (sphere, cone, cylinder, box,
      torus), flat-shaded meshing, vector helpers, composable `Scene` API
      with per-part transforms, colors, transparency and text labels
      (`lib/geometry.mjs`)
- [x] E3D v4 binary writer, symmetric to `packages/e3d-core`'s reader;
      validated by round-tripping through `parseE3d` (`lib/e3d-writer.mjs`)
- [x] Binary STL writer: bakes part transforms, rebuilds face normals,
      flips winding on mirrored bases (`lib/stl-writer.mjs`)
- [x] First parametric electrical component: DIN-rail contactor exporting
      both formats (`examples/contactor.mjs`)

## Planned

| Area | Doc | Summary |
| --- | --- | --- |
| AI creator/viewer | [`todo/01-ai-creator.md`](todo/01-ai-creator.md) | **Phase 0 done (CLI + skill).** Phase 1 (MCP) and Phase 2 (hot-reload + picking) pending. |
| Electrical STL catalog | [`todo/02-stl-electrical.md`](todo/02-stl-electrical.md) | Parametric generators for common panel components, STL quality notes |
| 2D game engines | [`todo/03-2d-engines.md`](todo/03-2d-engines.md) | Render generated assets to sprite sheets usable from 2D engines such as Phaser.js |

## Housekeeping (small, anytime)

- [ ] Smoke test in `scripts/` that runs every example and round-trips the
      `.e3d` output through `parseE3d` (mirror of `parse-samples.mjs`)
- [ ] Decide whether `lib/` should become an npm workspace package
      (`@covaga/asset-creator`) so apps can import it; today examples use
      relative paths on purpose (zero build)
- [ ] Reuse `lib/e3d-writer.mjs` as the seed for a typed `writer.ts` inside
      `packages/e3d-core` (with round-trip tests against `samples/`)
