import SevenZip, { type SevenZipModule } from "7z-wasm";

export interface EpdzEntry {
  /** Ruta dentro del archivo, p. ej. "packages/installationspaces/items/installationspacee3d/3899.E3d". */
  path: string;
  data: Uint8Array;
}

export interface EpdzContents {
  /** Modelos 3D encontrados (ficheros .e3d). */
  models: EpdzEntry[];
  /** Resto de entradas (SVG de páginas, manifest.db, AML...), solo rutas. */
  otherPaths: string[];
}

export interface ExtractOptions {
  /**
   * URL o ruta del binario 7zz.wasm. En Vite:
   *   import wasmUrl from "7z-wasm/7zz.wasm?url"
   * En Node no suele hacer falta (lo resuelve el propio paquete).
   */
  wasmUrl?: string;
}

/**
 * Extrae el contenido de un fichero .epdz (EPLAN ePLAN Data Portal / eVIEW export).
 * Un .epdz es un archivo 7-zip; dentro, los modelos 3D son ficheros .e3d.
 */
export async function extractEpdz(
  epdz: ArrayBuffer | Uint8Array,
  options: ExtractOptions = {}
): Promise<EpdzContents> {
  const seven: SevenZipModule = await SevenZip(
    options.wasmUrl
      ? { locateFile: () => options.wasmUrl!, print: () => {}, printErr: () => {} }
      : { print: () => {}, printErr: () => {} }
  );

  const input = epdz instanceof Uint8Array ? epdz : new Uint8Array(epdz);
  seven.FS.mkdir("/in");
  seven.FS.mkdir("/out");
  seven.FS.writeFile("/in/archive.epdz", input);
  seven.callMain(["x", "/in/archive.epdz", "-o/out", "-y", "-bso0", "-bsp0"]);

  const models: EpdzEntry[] = [];
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
        if (name.toLowerCase().endsWith(".e3d")) {
          models.push({ path: relative, data: seven.FS.readFile(full) });
        } else {
          otherPaths.push(relative);
        }
      }
    }
  };
  walk("/out");

  return { models, otherPaths };
}
