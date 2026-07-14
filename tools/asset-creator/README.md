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
lib/geometry.mjs      primitives (sphere/cone/cylinder/box/torus), vectors,
                      flat-shaded meshing, and the composable Scene API
lib/e3d-writer.mjs    Scene -> E3D v4 binary (mirror of e3d-core's reader)
lib/stl-writer.mjs    Scene -> binary STL (transforms baked, normals rebuilt)
examples/contactor.mjs  parametric DIN-rail contactor, exports both formats
todo/                 design notes for the planned work
```

Plain ESM JavaScript, no build step, no dependencies — runs with `node`.

## Quickstart

```bash
node tools/asset-creator/examples/contactor.mjs
# -> examples/out/contactor.e3d + contactor.stl
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
writeE3d(s); // Buffer
writeStl(s); // Buffer
```

Coordinates are EPLAN-style: **Z up, millimetres**; the viewer's default
camera looks at the scene from the −Y side, so "front" faces −Y.
