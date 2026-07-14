// Smoke test del parser: parsea las muestras del repo (una pieza .e3d suelta
// y los .E3d contenidos en el .epdz de ejemplo) y comprueba que se leen bien.
// Ejecutar tras `npm run build -w @covaga/e3d-core`.
import { readFile } from "node:fs/promises";
import { parseE3d } from "../packages/e3d-core/dist/index.js";
import { extractEpdz } from "../packages/e3d-core/dist/epdz.js";

let failed = false;

function report(label, scene) {
  const vertices = scene.meshes.reduce(
    (sum, m) => sum + (m.stride ? m.vertexArray.length / m.stride : 0),
    0
  );
  const texts = scene.parts.reduce((sum, p) => sum + p.textLines.length, 0);
  console.log(
    `OK  ${label}\n    v${scene.formatVersion} | luces=${scene.lights.length} ` +
      `texturas=${scene.textures.length} meshes=${scene.meshes.length} ` +
      `partes=${scene.parts.length} vertices=${vertices} textos=${texts}`
  );
}

// Pieza .e3d suelta (demo empaquetada con la app web).
for (const path of ["apps/web/public/demo/pilz_pnoz_3d.e3d"]) {
  try {
    report(path, parseE3d((await readFile(path)).buffer));
  } catch (error) {
    failed = true;
    console.error(`FAIL ${path}: ${error.message}`);
  }
}

// Proyecto .epdz: se extrae (7z) y se parsea cada modelo E3D que contenga.
for (const path of ["samples/ejemplo.epdz"]) {
  try {
    const contents = await extractEpdz(await readFile(path));
    if (contents.models.length === 0) throw new Error("el .epdz no contiene modelos E3D");
    console.log(
      `OK  ${path}\n    modelos=${contents.models.length} paginas=${contents.pages.length} ` +
        `imagenes=${contents.images.length} bbdd=${contents.databases.length}`
    );
    for (const model of contents.models) {
      const buffer = model.data.buffer.slice(
        model.data.byteOffset,
        model.data.byteOffset + model.data.byteLength
      );
      report(`${path} :: ${model.path}`, parseE3d(buffer));
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL ${path}: ${error.message}`);
  }
}

process.exit(failed ? 1 : 0);
