import SevenZip, { type SevenZipModule } from "7z-wasm";

export interface EpdzEntry {
  /** Ruta dentro del archivo, p. ej. "packages/installationspaces/items/installationspacee3d/3899.E3d". */
  path: string;
  data: Uint8Array;
}

export interface EpdzContents {
  /** Modelos 3D encontrados (ficheros .e3d). */
  models: EpdzEntry[];
  /** Páginas de esquemas (SVG), en orden natural por nombre. */
  pages: EpdzEntry[];
  /** Imágenes referenciadas por las páginas (png/jpg...). */
  images: EpdzEntry[];
  /** Bases de datos SQLite (manifest.db). */
  databases: EpdzEntry[];
  /** Exports AutomationML (.aml) con el proyecto completo (CAEX). */
  amls: EpdzEntry[];
  /** Resto de entradas (scripts...), solo rutas. */
  otherPaths: string[];
}

export interface ExtractOptions {
  /**
   * URL o ruta del binario 7zz.wasm. En Vite:
   *   import wasmUrl from "7z-wasm/7zz.wasm?url"
   * En Node no suele hacer falta (lo resuelve el propio paquete).
   */
  wasmUrl?: string;
  /**
   * Excluye ficheros al extraer (globs 7-zip, p. ej. `"*.aml"`).
   * Útil para diferir el AutomationML (~decenas de MB) fuera de la carga inicial.
   */
  excludeGlobs?: string[];
  /**
   * Si se indica, 7-zip solo extrae las entradas que casan (globs recursivos,
   * p. ej. `"*.aml"`). Se combina con `excludeGlobs`.
   */
  includeGlobs?: string[];
}

let cachedWasmUrl: string | undefined;
let cachedSeven: Promise<SevenZipModule> | null = null;
let sevenChain: Promise<unknown> = Promise.resolve();

function getSeven(wasmUrl?: string): Promise<SevenZipModule> {
  if (!cachedSeven || cachedWasmUrl !== wasmUrl) {
    cachedWasmUrl = wasmUrl;
    cachedSeven = SevenZip(
      wasmUrl
        ? { locateFile: () => wasmUrl, print: () => {}, printErr: () => {} }
        : { print: () => {}, printErr: () => {} }
    );
  }
  return cachedSeven;
}

function rmrf(seven: SevenZipModule, dir: string) {
  let names: string[];
  try {
    names = seven.FS.readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === "." || name === "..") continue;
    const full = `${dir}/${name}`;
    const stat = seven.FS.stat(full);
    if (seven.FS.isDir(stat.mode)) {
      rmrf(seven, full);
      seven.FS.rmdir(full);
    } else {
      seven.FS.unlink(full);
    }
  }
}

function resetWorkDirs(seven: SevenZipModule) {
  for (const dir of ["/in", "/out"]) {
    rmrf(seven, dir);
    try {
      seven.FS.mkdir(dir);
    } catch {
      // Ya existía vacío.
    }
  }
}

function collect(seven: SevenZipModule): EpdzContents {
  const models: EpdzEntry[] = [];
  const pages: EpdzEntry[] = [];
  const images: EpdzEntry[] = [];
  const databases: EpdzEntry[] = [];
  const amls: EpdzEntry[] = [];
  const otherPaths: string[] = [];

  const walk = (dir: string) => {
    for (const name of seven.FS.readdir(dir)) {
      if (name === "." || name === "..") continue;
      const full = `${dir}/${name}`;
      const stat = seven.FS.stat(full);
      if (seven.FS.isDir(stat.mode)) {
        walk(full);
      } else {
        const relative = full.slice("/out/".length);
        const lower = name.toLowerCase();
        if (lower.endsWith(".e3d")) {
          models.push({ path: relative, data: seven.FS.readFile(full) });
        } else if (lower.endsWith(".svg")) {
          pages.push({ path: relative, data: seven.FS.readFile(full) });
        } else if (/\.(png|jpe?g|gif|bmp)$/.test(lower)) {
          images.push({ path: relative, data: seven.FS.readFile(full) });
        } else if (lower.endsWith(".db") || lower.endsWith(".sqlite")) {
          databases.push({ path: relative, data: seven.FS.readFile(full) });
        } else if (lower.endsWith(".aml")) {
          amls.push({ path: relative, data: seven.FS.readFile(full) });
        } else {
          otherPaths.push(relative);
        }
      }
    }
  };
  walk("/out");

  const naturalByPath = (a: EpdzEntry, b: EpdzEntry) =>
    a.path.localeCompare(b.path, undefined, { numeric: true });
  pages.sort(naturalByPath);
  models.sort(naturalByPath);

  return { models, pages, images, databases, amls, otherPaths };
}

/**
 * Extrae el contenido de un fichero .epdz (EPLAN ePLAN Data Portal / eVIEW export).
 * Un .epdz es un archivo 7-zip; dentro, los modelos 3D son ficheros .e3d.
 */
export async function extractEpdz(
  epdz: ArrayBuffer | Uint8Array,
  options: ExtractOptions = {}
): Promise<EpdzContents> {
  const run = sevenChain.then(async () => {
    const seven = await getSeven(options.wasmUrl);
    resetWorkDirs(seven);

    const input = epdz instanceof Uint8Array ? epdz : new Uint8Array(epdz);
    seven.FS.writeFile("/in/archive.epdz", input);

    const args = ["x", "/in/archive.epdz", "-o/out", "-y", "-bso0", "-bsp0"];
    for (const glob of options.excludeGlobs ?? []) args.push(`-xr!${glob}`);
    for (const glob of options.includeGlobs ?? []) args.push(`-ir!${glob}`);
    seven.callMain(args);

    return collect(seven);
  });
  sevenChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
