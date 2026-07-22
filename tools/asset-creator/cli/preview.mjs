#!/usr/bin/env node
// Renderiza PNGs de un .e3d sin intervención humana, para que una LLM "vea"
// lo que ha generado con tools/asset-creator.
//
// Uso:
//   node tools/asset-creator/cli/preview.mjs <file.e3d> [--angles front,side,top,iso]
//     [--size 800] [--out dir] [--isolate <capa>] [--only-layers a,b]
//
// Por defecto angles=iso,front,side,top y out=directorio del .e3d. Escribe
// <out>/<base>-<angle>.png por ángulo (sufijo -<capa> si se aísla) e imprime
// las rutas generadas, una por línea, al terminar.
//
// Capas: junto al .e3d puede existir un sidecar <base>.layers.json con
//   { "layers": [{ "name": "...", "typeId": 10, "parts": [...] }, ...] }
// (contrato: typeId = 10 + índice de capa). --isolate <capa> renderiza solo
// esa capa (skipTypeIds = el resto de typeIds de capa); --only-layers es una
// lista blanca de nombres. Sin sidecar, ambas opciones fallan con un error
// claro. Las partes sin typeId de capa (la mayoría de las piezas "normales")
// se muestran siempre.
//
// Implementación: un harness.js (three.js + buildThreeScene de
// @covaga/e3d-core, ver ese fichero) se empaqueta con esbuild en un bundle
// IIFE autocontenido, cacheado fuera del repo; una página file:// headless
// (playwright-core + el Chromium ya instalado por el usuario, o instalado
// bajo demanda en un directorio temporal) lo carga y llama a
// window.renderE3d por ángulo, devolviendo un dataURL PNG del canvas.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const HARNESS_SRC = path.join(__dirname, "harness.js");

const DEFAULT_ANGLES = ["iso", "front", "side", "top"];
const VALID_ANGLES = new Set(DEFAULT_ANGLES);

// Directorios fuera del repo (nunca se instala nada en node_modules del
// proyecto): uno para el bundle esbuild cacheado, otro para playwright-core.
const BUNDLE_CACHE_DIR = path.join(tmpdir(), "covaga-asset-creator-preview");
const PW_HOME = path.join(tmpdir(), "covaga-asset-creator-pw");

function fail(message) {
  console.error(`preview: ${message}`);
  process.exit(1);
}

function parseCliArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        angles: { type: "string" },
        size: { type: "string" },
        out: { type: "string" },
        isolate: { type: "string" },
        "only-layers": { type: "string" },
      },
    });
  } catch (err) {
    fail(err.message);
  }
  const { values, positionals } = parsed;
  if (positionals.length !== 1) {
    fail("uso: preview.mjs <file.e3d> [--angles a,b] [--size N] [--out dir] [--isolate capa] [--only-layers a,b]");
  }
  const file = path.resolve(positionals[0]);
  if (!existsSync(file)) fail(`no existe: ${file}`);

  const angles = (values.angles ? values.angles.split(",") : DEFAULT_ANGLES)
    .map((a) => a.trim())
    .filter(Boolean);
  for (const a of angles) if (!VALID_ANGLES.has(a)) fail(`ángulo desconocido: "${a}" (válidos: ${DEFAULT_ANGLES.join(", ")})`);

  const size = values.size ? Number.parseInt(values.size, 10) : 800;
  if (!Number.isFinite(size) || size <= 0) fail(`--size inválido: ${values.size}`);

  const out = values.out ? path.resolve(values.out) : path.dirname(file);
  const onlyLayers = values["only-layers"]
    ? values["only-layers"].split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  if (values.isolate && onlyLayers) fail("--isolate y --only-layers son excluyentes");

  return { file, angles, size, out, isolate: values.isolate ?? null, onlyLayers };
}

/** Sidecar <base>.layers.json junto al .e3d, o null si no existe. */
function loadSidecar(e3dPath) {
  const base = e3dPath.replace(/\.e3d$/i, "");
  const sidecarPath = `${base}.layers.json`;
  if (!existsSync(sidecarPath)) return null;
  let json;
  try {
    json = JSON.parse(readFileSync(sidecarPath, "utf8"));
  } catch (err) {
    fail(`${sidecarPath}: JSON inválido (${err.message})`);
  }
  if (!Array.isArray(json.layers)) fail(`${sidecarPath}: falta "layers" (array de { name, typeId, parts })`);
  return { path: sidecarPath, layers: json.layers };
}

/** Resuelve --isolate/--only-layers a { skipTypeIds, suffix } para buildThreeScene. */
function resolveLayerFilter({ isolate, onlyLayers }, sidecar, e3dPath) {
  if (!isolate && !onlyLayers) return { skipTypeIds: [], suffix: "" };

  if (!sidecar) {
    const base = e3dPath.replace(/\.e3d$/i, "");
    fail(`--isolate/--only-layers requiere un sidecar de capas junto al fichero (${base}.layers.json no existe)`);
  }

  const allTypeIds = sidecar.layers.map((l) => l.typeId);
  const byName = new Map(sidecar.layers.map((l) => [l.name, l]));
  const available = sidecar.layers.map((l) => l.name).join(", ");

  if (isolate) {
    const layer = byName.get(isolate);
    if (!layer) fail(`capa "${isolate}" no existe en ${sidecar.path}; disponibles: ${available}`);
    const skipTypeIds = allTypeIds.filter((id) => id !== layer.typeId);
    return { skipTypeIds, suffix: `-${slug(isolate)}` };
  }

  for (const name of onlyLayers) {
    if (!byName.has(name)) fail(`capa "${name}" no existe en ${sidecar.path}; disponibles: ${available}`);
  }
  const wanted = new Set(onlyLayers);
  const skipTypeIds = sidecar.layers.filter((l) => !wanted.has(l.name)).map((l) => l.typeId);
  return { skipTypeIds, suffix: "" };
}

function slug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} salió con código ${code}`))));
  });
}

// ---------- bundle del harness (esbuild, cacheado fuera del repo) ----------

async function ensureBundle() {
  mkdirSync(BUNDLE_CACHE_DIR, { recursive: true });
  const builderPath = path.join(REPO_ROOT, "packages/e3d-core/dist/three/builder.js");
  const indexPath = path.join(REPO_ROOT, "packages/e3d-core/dist/index.js");
  const sourceFiles = [HARNESS_SRC, builderPath, indexPath];

  const hash = createHash("sha1");
  for (const f of sourceFiles) hash.update(readFileSync(f));
  const digest = hash.digest("hex").slice(0, 16);

  const bundlePath = path.join(BUNDLE_CACHE_DIR, `bundle.${digest}.js`);
  const htmlPath = path.join(BUNDLE_CACHE_DIR, `preview.${digest}.html`);
  if (existsSync(bundlePath) && existsSync(htmlPath)) return { htmlPath };

  const esbuildEntry = path.join(REPO_ROOT, "node_modules/esbuild/lib/main.js");
  if (!existsSync(esbuildEntry)) fail(`no se encuentra esbuild en ${esbuildEntry} (¿npm ci?)`);
  const esbuild = await import(pathToFileURL(esbuildEntry).href);

  await esbuild.build({
    entryPoints: [HARNESS_SRC],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile: bundlePath,
    absWorkingDir: REPO_ROOT,
    logLevel: "silent",
  });
  writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><title>e3d preview</title></head>` +
      `<body><script src="./bundle.${digest}.js"></script></body></html>`
  );
  return { htmlPath };
}

// ---------- playwright-core (instalado fuera del repo, bajo demanda) ----------

async function ensurePlaywrightCore() {
  const pkgJson = path.join(PW_HOME, "package.json");
  const installed = path.join(PW_HOME, "node_modules/playwright-core/package.json");
  if (!existsSync(installed)) {
    mkdirSync(PW_HOME, { recursive: true });
    if (!existsSync(pkgJson)) {
      writeFileSync(pkgJson, JSON.stringify({ name: "covaga-asset-creator-pw-scratch", private: true }, null, 2));
    }
    console.error(`preview: instalando playwright-core en ${PW_HOME} (fuera del repo)...`);
    await run("npm", ["install", "--no-audit", "--no-fund", "playwright-core"], PW_HOME);
  }
  return createRequire(pkgJson);
}

/** Busca un Chromium ya instalado por playwright/ms-playwright en este SO. */
function findChromiumExecutable() {
  const bases = [];
  if (process.platform === "darwin" && process.env.HOME) {
    bases.push(path.join(process.env.HOME, "Library/Caches/ms-playwright"));
  } else if (process.platform === "linux") {
    bases.push("/opt/pw-browsers");
    if (process.env.HOME) bases.push(path.join(process.env.HOME, ".cache/ms-playwright"));
  } else if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    bases.push(path.join(process.env.LOCALAPPDATA, "ms-playwright"));
  }

  for (const base of bases) {
    if (!existsSync(base)) continue;
    let dirs;
    try {
      dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d));
    } catch {
      continue;
    }
    dirs.sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    for (const dir of dirs) {
      const found = findExecutableIn(path.join(base, dir));
      if (found) return found;
    }
  }
  return null;
}

function findExecutableIn(dir, depth = 0) {
  if (depth > 6) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "MacOS") {
        // <...>.app/Contents/MacOS/<ejecutable>
        const bin = readdirSync(full).find((f) => !f.startsWith("."));
        if (bin) return path.join(full, bin);
      }
      const nested = findExecutableIn(full, depth + 1);
      if (nested) return nested;
    } else if (entry.name === "chrome" || entry.name === "chrome.exe") {
      return full;
    }
  }
  return null;
}

async function ensureChromium() {
  let exe = findChromiumExecutable();
  if (exe) return exe;
  console.error("preview: no se encontró Chromium de playwright; instalando...");
  const cliPath = path.join(PW_HOME, "node_modules/playwright-core/cli.js");
  await run(process.execPath, [cliPath, "install", "chromium"], PW_HOME);
  exe = findChromiumExecutable();
  if (!exe) fail("no se pudo localizar Chromium tras instalarlo");
  return exe;
}

// ---------- main ----------

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  const sidecar = loadSidecar(opts.file);
  const { skipTypeIds, suffix } = resolveLayerFilter(opts, sidecar, opts.file);

  mkdirSync(opts.out, { recursive: true });
  const bytesBase64 = readFileSync(opts.file).toString("base64");
  const base = path.basename(opts.file).replace(/\.e3d$/i, "");

  const { htmlPath } = await ensureBundle();
  const pwRequire = await ensurePlaywrightCore();
  const exe = await ensureChromium();
  const { chromium } = pwRequire("playwright-core");

  const browser = await chromium.launch({ executablePath: exe, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href);
    await page.waitForFunction(() => typeof window.renderE3d === "function");

    const outputs = [];
    for (const angle of opts.angles) {
      const dataUrl = await page.evaluate(
        ([b64, angle, size, skipTypeIds]) => window.renderE3d(b64, { size, angle, skipTypeIds }),
        [bytesBase64, angle, opts.size, skipTypeIds]
      );
      const prefix = "data:image/png;base64,";
      if (!dataUrl || !dataUrl.startsWith(prefix)) throw new Error(`renderE3d no devolvió un PNG válido para "${angle}"`);
      const png = Buffer.from(dataUrl.slice(prefix.length), "base64");
      const outPath = path.join(opts.out, `${base}-${angle}${suffix}.png`);
      writeFileSync(outPath, png);
      outputs.push(outPath);
    }
    for (const outPath of outputs) console.log(outPath);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`preview: ${err.stack ?? err}`);
  process.exit(1);
});
