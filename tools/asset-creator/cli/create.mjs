#!/usr/bin/env node
// create.mjs <spec.json> [--out dir] [--formats e3d,stl]
//
// Valida la spec declarativa por capas (lib/spec.mjs), construye la Scene,
// escribe .e3d / .stl y el sidecar <name>.layers.json, y hace round-trip del
// .e3d con parseE3d (packages/e3d-core/dist) para garantizar que parsea.
//
// Imprime un resumen por capa (nombre, partes, triángulos) + total y bytes.
//
//   node tools/asset-creator/cli/create.mjs examples/spm3.spec.json
//
// Por defecto --out tools/asset-creator/examples/out.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { buildSceneFromSpec } from "../lib/spec.mjs";
import { writeE3d } from "../lib/e3d-writer.mjs";
import { writeStl } from "../lib/stl-writer.mjs";
import { parseE3d } from "../../../packages/e3d-core/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = resolve(HERE, "../examples/out");

function parseArgs(argv) {
  const args = { formats: ["e3d", "stl"], out: DEFAULT_OUT, spec: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--formats") args.formats = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--")) fail(`opción desconocida: ${a}`);
    else if (args.spec == null) args.spec = a;
    else fail(`argumento inesperado: ${a}`);
  }
  if (!args.spec) fail("uso: create.mjs <spec.json> [--out dir] [--formats e3d,stl]");
  return args;
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const specPath = isAbsolute(args.spec) ? args.spec : resolve(process.cwd(), args.spec);
const outDir = isAbsolute(args.out) ? args.out : resolve(process.cwd(), args.out);

let specObj;
try {
  specObj = JSON.parse(readFileSync(specPath, "utf8"));
} catch (e) {
  fail(`no se pudo leer/parsear ${specPath}: ${e.message}`);
}

let scene, layers;
try {
  ({ scene, layers } = buildSceneFromSpec(specObj));
} catch (e) {
  fail(`spec inválida -> ${e.message}`);
}

const name = specObj.name;
mkdirSync(outDir, { recursive: true });

// triángulos por parte (para el resumen por capa)
const trisOfPart = (p) => scene.meshes[p.meshId].indices.length / 3;
let partIdx = 0;
for (const layer of layers) {
  let tris = 0;
  for (let k = 0; k < layer.parts; k++) tris += trisOfPart(scene.parts[partIdx++]);
  layer.tris = tris;
}

const outputs = [];
let e3dBuffer = null;
if (args.formats.includes("e3d")) {
  e3dBuffer = writeE3d(scene);
  const path = join(outDir, `${name}.e3d`);
  writeFileSync(path, e3dBuffer);
  outputs.push([`${name}.e3d`, e3dBuffer.length]);
}
if (args.formats.includes("stl")) {
  const stl = writeStl(scene, { header: name });
  const path = join(outDir, `${name}.stl`);
  writeFileSync(path, stl);
  outputs.push([`${name}.stl`, stl.length]);
}

// sidecar de capas (CONTRATO)
const sidecar = { layers: layers.map((l) => ({ name: l.name, typeId: l.typeId, parts: l.parts })) };
const sidecarPath = join(outDir, `${name}.layers.json`);
writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2) + "\n");
outputs.push([`${name}.layers.json`, null]);

// round-trip: el .e3d DEBE parsear con el lector real
if (e3dBuffer) {
  try {
    const parsed = parseE3d(e3dBuffer.buffer.slice(e3dBuffer.byteOffset, e3dBuffer.byteOffset + e3dBuffer.byteLength));
    if (!parsed || !Array.isArray(parsed.parts)) throw new Error("parseE3d devolvió una estructura inesperada");
  } catch (e) {
    fail(`el .e3d generado no parsea con parseE3d: ${e.message}`);
  }
}

// ---------- resumen ----------
const totalParts = scene.parts.length;
const totalTris = layers.reduce((s, l) => s + l.tris, 0);
const width = Math.max(...layers.map((l) => l.name.length), 4);
console.log(`${name}: ${layers.length} capas, ${totalParts} partes, ${totalTris} triángulos`);
for (const l of layers) {
  console.log(`  [${l.typeId}] ${l.name.padEnd(width)}  ${String(l.parts).padStart(3)} partes  ${String(l.tris).padStart(5)} tris`);
}
for (const [file, bytes] of outputs) {
  console.log(`  -> ${file}${bytes != null ? ` (${bytes} bytes)` : ""}`);
}
