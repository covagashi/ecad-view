// Ejemplo: protector suplementario 3 polos para carril DIN (familia 1492-SP),
// modelado a partir del plano 2D de dimensiones del fabricante
// (examples/spm3-drawing.pdf, no incluido en el repo), releído a alta
// resolución vista a vista.
//
// Mapeo de cotas del plano (confirmado con las vistas ampliadas):
//   52.20 = ancho total (X), 3 polos de 17.4
//   74.64 = alto total (Z)
//   50.30 = fondo del cuerpo principal (Y)
//   63.70 = fondo con la banda frontal ("nariz")
//   88.00 = fondo total incluyendo la maneta
//
//   node tools/asset-creator/examples/spm3.mjs
//
// Salida en tools/asset-creator/examples/out/.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Scene, boxTris, extrudeTris, scale } from "../lib/geometry.mjs";
import { writeE3d } from "../lib/e3d-writer.mjs";
import { writeStl } from "../lib/stl-writer.mjs";

// ---------- parámetros (mm, del plano) ----------
const POLES = 3;
const POLE_W = 17.4;
const WIDTH = 52.2;
const HEIGHT = 74.64;
const D_BODY = 50.3; // fondo del cuerpo
const D_NOSE = 63.7; // fondo hasta el frente de la nariz
const TAG = "1492-SP";
const RATING = "C 10A";

const BACK = D_BODY / 2; // dorso (lado carril DIN) en y = +25.15
const F_BODY = -D_BODY / 2; // cara frontal del cuerpo, y = -25.15
const F_NOSE = -(D_NOSE - BACK); // frente de la nariz, y = -38.55

const BODY = [0.93, 0.93, 0.91]; // termoplástico blanco
const GROOVE = [0.68, 0.68, 0.66];
const BLUE = [0.3, 0.55, 0.8]; // maneta
const RECESS = [0.42, 0.43, 0.46]; // ventana de la maneta
const FUNNEL = [0.13, 0.13, 0.14]; // embudos de bornes
const SCREW = [0.68, 0.7, 0.74];
const PLATE = [0.97, 0.97, 0.96];
const CLIP = [0.58, 0.59, 0.61];

const s = new Scene({ viewBox: [WIDTH * 2.6, D_NOSE * 3, HEIGHT * 1.8] });

// ---------- carcasa: perfil lateral (y,z) trazado de la vista del plano,
// extruido a lo ancho, con chaflanes y la muesca del carril DIN ----------
const NOSE_Z0 = 12, NOSE_Z1 = 62; // banda frontal
const CH = 2.5; // chaflán genérico
const profile = [
  [F_BODY + CH, 0], // frente-abajo (chaflanado)
  [BACK - 2, 0],
  [BACK, 2], // chaflán dorso-abajo
  [BACK, 27], // muesca carril DIN (35 mm entre 27 y 45... aprox del plano)
  [BACK - 7.5, 27],
  [BACK - 7.5, 45],
  [BACK, 45],
  [BACK, HEIGHT - 2],
  [BACK - 2, HEIGHT], // chaflán dorso-arriba
  [F_BODY + 5, HEIGHT],
  [F_BODY, HEIGHT - 5], // chaflán grande frente-arriba (zona de bornes)
  [F_BODY, NOSE_Z1 + 2],
  [F_NOSE + CH, NOSE_Z1], // escalón a la nariz, chaflanado
  [F_NOSE, NOSE_Z1 - CH],
  [F_NOSE, NOSE_Z0 + CH],
  [F_NOSE + CH, NOSE_Z0],
  [F_BODY, NOSE_Z0 - 2],
  [F_BODY, CH],
];
s.prism(profile, 0, WIDTH, BODY);

// ranuras de partición entre polos, sobre la nariz
for (let i = 1; i < POLES; i++) {
  const x = -WIDTH / 2 + i * POLE_W;
  s.box([x, F_NOSE - 0.1, (NOSE_Z0 + NOSE_Z1) / 2], [0.7, 0.6, NOSE_Z1 - NOSE_Z0 - 6], GROOVE);
}

// ---------- maneta: barra azul única que une los 3 polos ----------
// inclinada 35 grados hacia abajo (posicion de la foto del producto)
const TH = (35 * Math.PI) / 180;
const tip = [0, -Math.cos(TH), -Math.sin(TH)]; // dirección de la palanca
const perp = [0, Math.sin(TH), -Math.cos(TH)];
const PIVOT_Z = 32;

for (let i = 0; i < POLES; i++) {
  const x = -WIDTH / 2 + (i + 0.5) * POLE_W;
  // ventana rehundida de la que sale la palanca
  s.box([x, F_NOSE - 0.3, PIVOT_Z + 2], [11, 1.4, 21], RECESS);
  // vástago azul (caja orientada según `tip`)
  const pivot = [x, F_NOSE + 4, PIVOT_Z];
  const c = [pivot[0], pivot[1] + tip[1] * 7, pivot[2] + tip[2] * 7];
  s.part(
    s._primitive("box", boxTris),
    { x: [9, 0, 0], y: scale(perp, 4.5), z: scale(tip, 17), t: c },
    BLUE,
    { typeId: 2 }
  );
}
// barra de unión con chaflanes (prisma octogonal girado según `tip`)
const barProfile = [
  [-1.5, -6], [1.5, -6], [3.5, -4], [3.5, 4], [1.5, 6], [-1.5, 6], [-3.5, 4], [-3.5, -4],
];
const barCenter = [0, F_NOSE + 4 + tip[1] * 15.5, PIVOT_Z + tip[2] * 15.5];
const barMesh = s.addMesh(extrudeTris(barProfile));
s.part(
  barMesh,
  { x: [WIDTH - 3.5, 0, 0], y: scale(tip, 1), z: scale(perp, 1), t: barCenter },
  BLUE,
  { typeId: 2 }
);

// ---------- bornes: embudo oscuro embutido + tornillo al fondo ----------
for (let i = 0; i < POLES; i++) {
  const x = -WIDTH / 2 + (i + 0.5) * POLE_W;
  for (const top of [true, false]) {
    const z0 = top ? HEIGHT - 9 : 9; // fondo del embudo
    const z1 = top ? HEIGHT + 0.05 : -0.05; // boca (asoma para verse como aro)
    s.tube([x, -6, z0], [x, -6, z1], 4.8, FUNNEL);
    s.tube([x, -6, z0], [x, -6, z0 + (top ? 1.6 : -1.6)], 3.8, SCREW); // tornillo
    s.box([x, -6, z0 + (top ? 1.9 : -1.9)], [1.3, 7, 0.5], FUNNEL); // ranura
  }
}

// ---------- marcado: placa con referencia y calibre ----------
const plateMesh = s.addMesh(boxTris(), (p) => [p[0] * 15, p[1] * 1, p[2] * 9]);
const plate = s.part(
  plateMesh,
  { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], t: [-9, F_NOSE - 0.6, 54] },
  PLATE
);
s.label(plate, TAG, { position: [0, -1, 1.6], height: 3.4 });
s.label(plate, RATING, { position: [0, -1, -2.6], height: 3 });

// ---------- carril DIN: clip en la muesca y pestaña de desenclave ----------
s.box([0, BACK - 4, 36], [WIDTH - 8, 7, 16], CLIP);
s.box([0, BACK - 5.5, 24.5], [10, 4, 6], CLIP); // uña inferior del clip

// ---------- salida ----------
const outDir = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(outDir, { recursive: true });

const e3d = writeE3d(s);
writeFileSync(`${outDir}spm3.e3d`, e3d);
const stl = writeStl(s, { header: `1492-SPM3 ${WIDTH}x${D_NOSE}x${HEIGHT}` });
writeFileSync(`${outDir}spm3.stl`, stl);

const tris = s.parts.reduce((sum, p) => sum + s.meshes[p.meshId].indices.length / 3, 0);
console.log(
  `OK spm3 v2: ${s.parts.length} partes, ${tris} triangulos -> ` +
    `spm3.e3d (${e3d.length} bytes), spm3.stl (${stl.length} bytes)`
);
