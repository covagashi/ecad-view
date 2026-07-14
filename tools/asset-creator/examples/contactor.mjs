// Ejemplo: mini contactor de carril DIN, paramétrico.
// Genera el mismo modelo en dos formatos: .e3d (visor del repo) y .stl.
//
//   node tools/asset-creator/examples/contactor.mjs
//
// Salida en tools/asset-creator/examples/out/.
import { mkdirSync, writeFileSync } from "node:fs";
import { Scene, boxTris } from "../lib/geometry.mjs";
import { writeE3d } from "../lib/e3d-writer.mjs";
import { writeStl } from "../lib/stl-writer.mjs";

// ---------- parámetros ----------
const WIDTH = 45; // ancho (X)
const DEPTH = 78; // fondo (Y)
const HEIGHT = 88; // alto (Z), apoyado en z=0
const POLES = 3; // tornillos por fila
const TAG = "K1M"; // marcado del dispositivo

const BODY = [0.82, 0.82, 0.8];
const FRONT = [0.35, 0.36, 0.4];
const PLATE = [0.93, 0.93, 0.9];
const SCREW = [0.65, 0.68, 0.72];
const ACTUATOR = [0.95, 0.55, 0.1];
const CLIP = [0.25, 0.26, 0.3];

const s = new Scene({ viewBox: [WIDTH * 2, DEPTH * 2, HEIGHT * 1.5] });
const front = -DEPTH / 2;

// cuerpo y carcasa frontal
s.box([0, 0, HEIGHT / 2], [WIDTH, DEPTH, HEIGHT], BODY);
s.box([0, front - 2, HEIGHT / 2], [WIDTH - 8, 8, HEIGHT - 26], FRONT);

// filas de bornes con tornillo (arriba y abajo del frontal)
const pitch = (WIDTH - 14) / Math.max(1, POLES - 1);
for (let i = 0; i < POLES; i++) {
  const x = -((POLES - 1) * pitch) / 2 + i * pitch;
  for (const z of [HEIGHT - 14, 14]) {
    s.box([x, front - 1, z], [pitch - 2, 6, 16], BODY); // cuerpo del borne
    s.tube([x, front - 1, z], [x, front - 6, z], 3.2, SCREW); // tornillo
    s.tube([x, front - 6, z], [x, front - 7, z], 1.4, FRONT); // ranura
  }
}

// placa de marcado (malla a tamaño real: sirve de ancla sin escala
// para la etiqueta de texto, ver Scene.label)
const plateMesh = s.addMesh(boxTris(), (p) => [p[0] * 26, p[1] * 2, p[2] * 14]);
const plate = s.part(
  plateMesh,
  // 2 mm por delante del frontal para evitar z-fighting entre caras coplanarias
  { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], t: [0, front - 7, HEIGHT / 2 + 6] },
  PLATE
);
s.label(plate, TAG, { position: [0, -1.5, 8], height: 10 });

// actuador manual (ventana naranja bajo la placa)
s.box([0, front - 5, HEIGHT / 2 - 12], [14, 4, 7], ACTUATOR);

// pie y clip de carril DIN (parte trasera inferior)
s.box([0, DEPTH / 2 - 10, -3], [WIDTH - 4, 24, 6], CLIP);
s.box([0, DEPTH / 2 + 4, -3], [12, 10, 6], ACTUATOR); // pestaña de desenclave

// ---------- salida ----------
const outDir = new URL("./out/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const e3d = writeE3d(s);
writeFileSync(`${outDir}contactor.e3d`, e3d);
const stl = writeStl(s, { header: `contactor ${WIDTH}x${DEPTH}x${HEIGHT} ${TAG}` });
writeFileSync(`${outDir}contactor.stl`, stl);

const tris = s.parts.reduce((sum, p) => sum + s.meshes[p.meshId].indices.length / 3, 0);
console.log(
  `OK contactor: ${s.parts.length} partes, ${tris} triangulos -> ` +
    `contactor.e3d (${e3d.length} bytes), contactor.stl (${stl.length} bytes)`
);
