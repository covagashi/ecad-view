# TODO: parametric STL catalog for electrical components

Goal: a library of parametric generators for the components that populate
control panels, each exporting **binary STL** (for CAD/mesh tooling) and
**`.e3d`** (for this repo's viewer) from the same `Scene`.

The writers are done (`lib/stl-writer.mjs`, `lib/e3d-writer.mjs`) and the
first component exists (`examples/contactor.mjs`). What remains is the
catalog itself plus quality/testing work.

## Catalog

Each generator is a function `(params) => Scene` with sensible defaults,
real-world dimensions in mm, and the device tag as an E3D text label.

- [x] Contactor / motor starter (DIN rail) — `examples/contactor.mjs`
- [ ] DIN rail segment, EN 60715 TH35 (35 × 7.5 mm top-hat profile,
      parametric length; the profile is an 8-point extrusion — needs a
      small `extrude(profile2d, length)` helper in `lib/geometry.mjs`)
- [ ] Terminal block (screw type): 6/8/10 mm pitch, 1..3 levels, color
      variants (gray/blue/green-yellow), jumper notch
- [ ] Miniature circuit breaker (MCB): 1–4 poles at 18 mm/pole, toggle,
      front window
- [ ] Relay + socket (11-pin / plug-in): base, clear cover (use part
      transparency), retaining clip
- [ ] Power supply brick: perforated side vents pattern, front terminals
- [ ] PLC block: CPU + snap-on I/O modules, status LED row
- [ ] Cable duct: U-profile with fingers + separate lid, parametric
      width/height/length
- [ ] Enclosure: box + door (hinge side param), mounting plate
- [ ] 22 mm pushbuttons / pilot lights for the door
- [ ] Cable gland (M12–M63): body + locknut, hex via low-segment cylinder

Shared helpers worth extracting as the catalog grows: `extrude()` for 2D
profiles, screw-with-slot, vent-grid, chamfered box.

## STL quality notes (constraints to document per generator)

- Output is a **triangle soup**: parts interpenetrate freely. That is fine
  for visualization and most CAD import, but the meshes are **not
  guaranteed watertight/manifold**, so they are not directly
  print-ready. If printing becomes a goal, run the soup through a CSG
  union — [`manifold-3d`](https://www.npmjs.com/package/manifold-3d)
  (WASM) is the obvious candidate — as an opt-in `--solidify` step.
- Binary STL carries **no color/material**; color lives only in the `.e3d`
  twin. If colored mesh export matters later, add 3MF (zip + XML, small
  writer) rather than abusing non-standard STL color hacks.
- Units: STL is unitless by convention; we emit mm. State it in the docs
  of every generator.
- Avoid exactly coplanar faces between touching parts (z-fighting in
  viewers and ambiguous booleans in CSG) — offset by ≥0.5 mm; see the
  label plate in `examples/contactor.mjs`.

## Testing

- [ ] Smoke script (pattern of `scripts/parse-samples.mjs`): run every
      generator, `parseE3d` the `.e3d`, check STL triangle count matches
      `84 + 50·n` bytes, and assert the bounding box matches the declared
      dimensions within tolerance.
- [ ] Golden previews: render each catalog item once (see
      `todo/01-ai-creator.md` preview CLI) into a gallery page in `docs/`.
