# TODO: rendering generated assets for 2D engines (Phaser.js et al.)

Generated scenes are plain three.js content once they pass through
`buildThreeScene()` (`packages/e3d-core`). That makes it cheap to **bake
them into sprite sheets**, so the same procedural assets can be used from
2D engines — Phaser.js being the reference target since it's the most
common web option — or anywhere a PNG atlas works.

## Pipeline: `.e3d` → sprite sheet + atlas

- [ ] `cli/render-sprites.mjs <file.e3d>` — headless renderer:
      - Load the scene with `parseE3d` + `buildThreeScene` inside a
        headless Chromium page (same technique as the preview CLI in
        `todo/01-ai-creator.md`; the repo's environment ships a browser).
      - **Orthographic camera** for stable silhouettes (perspective
        distorts between angles); transparent background
        (`alpha: true`, no background color).
      - Render N yaw angles (default 8, i.e. every 45°) at a fixed
        elevation (~30° for the classic 3/4 look; make both parameters
        flags). Consistent framing across angles: fit the camera once to
        the union of all rotations' bounding boxes, not per frame.
- [ ] **Poses/animation**: parts are rigid pieces with their own
      transforms, so simple animation = re-rendering with per-part
      transform overrides (arm raised, lid open, button pressed). Accept a
      JSON list of poses: `{ "walk1": { "part:12": { "rotateX": 15 } } }`.
      Frames = angles × poses.
- [ ] **Atlas output**: pack frames into one PNG + JSON. Emit the
      Phaser 3 atlas JSON format (`textures[].frames[]`), which generic
      tools also read. Naming: `<asset>_<pose>_<angle>`.
- [ ] Example consumer: minimal Phaser scene in the doc (not a repo app)
      showing `this.load.atlas(...)` + flipping between angle frames for a
      fake rotation. Keep it as a snippet in this document.

## Alternative for real-time 3D in a 2D game

For engines that allow it, skip baking: run a three.js `<canvas>` layered
with the 2D canvas and feed it `buildThreeScene` output directly (Phaser
supports external canvases / `Phaser.GameObjects.Extern`). More moving
parts at runtime, but free rotation and lighting. Baked sprites should
still be the default — they're cacheable, cheap on low-end devices, and
engine-agnostic.

## Related (3D engines)

A `Scene -> glTF` exporter would open Godot/Unity/Unreal and the whole 3D
toolchain. Straightforward since our meshes are already
positions+normals+indices: one binary `.glb` buffer, nodes per part with
the same transforms. Worth doing right after the sprite pipeline; tracked
here to keep scope honest.

## Open questions

- Outline/edge pass for readability at small sprite sizes (three.js
  `OutlinePass` vs. rendering E3D edge groups, which the builder already
  supports).
- Pixel-art targets: integer downscale with nearest-neighbor beats
  rendering tiny; decide the render size heuristic (e.g. 4× target).
