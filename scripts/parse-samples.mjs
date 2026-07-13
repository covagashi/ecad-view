// Smoke test del parser: parsea los E3D de ejemplo del repo y comprueba
// que se consume el fichero completo. Ejecutar tras `npm run build -w @byndr/e3d-core`.
import { readFile } from "node:fs/promises";
import { parseE3d } from "../packages/e3d-core/dist/index.js";

const samples = [
  "apps/web/public/demo/pilz_pnoz_3d.e3d",
  "ejemplo/packages/installationspaces/items/installationspacee3d/3899.E3d",
];

let failed = false;
for (const path of samples) {
  try {
    const buffer = (await readFile(path)).buffer;
    const scene = parseE3d(buffer);
    const vertices = scene.meshes.reduce(
      (sum, m) => sum + (m.stride ? m.vertexArray.length / m.stride : 0),
      0
    );
    const texts = scene.parts.reduce((sum, p) => sum + p.textLines.length, 0);
    console.log(
      `OK  ${path}\n    v${scene.formatVersion} | luces=${scene.lights.length} ` +
        `texturas=${scene.textures.length} meshes=${scene.meshes.length} ` +
        `partes=${scene.parts.length} vertices=${vertices} textos=${texts}`
    );
  } catch (error) {
    failed = true;
    console.error(`FAIL ${path}: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
