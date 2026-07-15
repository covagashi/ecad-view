# Asset creator

Programmatic 3D asset generation for this project: build models from code
(primitive composition, low-poly flat-shaded) and export them as

- **`.e3d`** — the EPLAN binary format this repo's viewer renders
  (round-trip compatible with the `@covaga/e3d-core` parser), and
- **`.stl`** — binary STL, for use in CAD/mesh tools.

This is companion tooling; nothing here ships with the web app.

## Status

The core library is **done and working**. The AI-facing creator/viewer,
the electrical-component generator catalog, and 2D-engine export are
**planned** — see [`TODO.md`](TODO.md).

## Layout

```
lib/geometry.mjs      primitives (sphere/cone/cylinder/box/torus), 2D-profile
                      extrusion with chamfers (extrudeTris/prism), vectors,
                      flat-shaded meshing, and the composable Scene API
lib/e3d-writer.mjs    Scene -> E3D v4 binary (mirror of e3d-core's reader)
lib/stl-writer.mjs    Scene -> binary STL (transforms baked, normals rebuilt)
examples/contactor.mjs  parametric DIN-rail contactor, exports both formats
examples/spm3.mjs     3-pole supplementary protector modeled from a 2D
                      manufacturer drawing (see "From a 2D drawing to 3D")
todo/                 design notes for the planned work
```

Plain ESM JavaScript, no build step, no dependencies — runs with `node`.

## Quickstart

```bash
node tools/asset-creator/examples/contactor.mjs
# -> examples/out/contactor.e3d + contactor.stl
node tools/asset-creator/examples/spm3.mjs
# -> examples/out/spm3.e3d + spm3.stl
```

Open the `.e3d` in the web viewer (`npm run dev`, then drop the file) to
inspect it. Verify any generated file against the real parser:

```js
import { parseE3d } from "../../packages/e3d-core/dist/index.js";
parseE3d(buffer); // throws unless the whole file parses cleanly
```

## Scene API in 30 seconds

```js
import { Scene } from "./lib/geometry.mjs";
import { writeE3d } from "./lib/e3d-writer.mjs";
import { writeStl } from "./lib/stl-writer.mjs";

const s = new Scene();
s.box([0, 0, 30], [40, 20, 60], [0.8, 0.8, 0.8]); // center, size, RGB
s.tube([0, -12, 50], [0, -18, 50], 3, [0.7, 0.7, 0.75]); // from, to, radius
s.ball([0, -20, 50], [4, 4, 4], [0.9, 0.5, 0.1], { transparency: 0.4 });
// 2D profile [[y,z], ...] (CCW, concavities and chamfers allowed),
// extruded along X — for real housing profiles instead of stacked boxes
s.prism([[-10, 0], [10, 0], [10, 18], [7, 21], [-10, 21]], 0, 40, [0.9, 0.9, 0.9]);
writeE3d(s); // Buffer
writeStl(s); // Buffer
```

Coordinates are EPLAN-style: **Z up, millimetres**; the viewer's default
camera looks at the scene from the −Y side, so "front" faces −Y.

## From a 2D drawing to 3D

`examples/spm3.mjs` models a 3-pole DIN-rail supplementary protector
(1492-SP family) from the manufacturer's 2D dimension drawing. The source
PDF is proprietary and **not** included in the repo; the workflow is what
matters:

1. **Render each drawing view separately at high resolution** (~600 dpi)
   instead of reading the whole sheet at once — small details (handle
   shape, recessed terminal funnels, chamfers) are invisible at low res.
   pdfjs-dist driving a headless browser works well for cropping views.
2. **Map every dimension to an axis explicitly**, cross-checking views.
   For the spm3: 52.20 = width (3 × 17.4 per pole), 74.64 = height,
   50.30 = body depth, 63.70 = depth incl. the front band, 88.00 = depth
   incl. the toggle. Ambiguous dimensions deserve a note, not a guess.
3. **Trace the side profile as a 2D polygon** (with chamfers and the DIN
   notch) and extrude it with `Scene.prism` — one part that instantly
   matches the drawing's side view, instead of a pile of boxes.
4. **Verify before shipping**: load the `.e3d` in the viewer and compare
   the Front/Side/Top camera presets against the drawing views.

Result (viewer screenshots, ISO and side view):

![spm3 in the viewer](examples/spm3.png)

![spm3 side profile](examples/spm3-lateral.png)
