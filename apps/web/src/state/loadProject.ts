import type { EpdzEntry } from "@covaga/e3d-core/epdz";
import type { EplanManifest } from "@covaga/e3d-core/manifest";
import { pageTitle } from "../viewer/SchematicViewer";
import { buildDeviceIndex } from "../devices";
import type { LoadedPage, LoadedProjectData, StatusMessage } from "./types";

/**
 * Carga un fichero .epdz o .e3d y devuelve el contenido del documento.
 * `onStatus` informa del progreso (extracción, manifest…) a la barra de estado.
 *
 * El AutomationML (.aml) se deja fuera de esta carga: suele ser el fichero más
 * grande del .epdz y solo lo usa la vista Datos. `extractAmlEntry` lo recoge
 * después, en segundo plano.
 */
export async function loadProject(
  name: string,
  buffer: ArrayBuffer,
  onStatus: (status: StatusMessage | null) => void
): Promise<LoadedProjectData> {
  if (!name.toLowerCase().endsWith(".epdz")) {
    // .e3d suelto: se modela como proyecto con un único modelo y sin páginas.
    return {
      epdzModels: [{ path: name, data: new Uint8Array(buffer) }],
      pages: [],
      manifest: null,
      imageUrls: new Map(),
      deviceIndex: buildDeviceIndex([]),
      amlEntry: null,
      view: "3d",
      modelIndex: 0,
    };
  }

  onStatus({ key: "status.extracting" });
  const [{ extractEpdz }, wasmMod] = await Promise.all([
    import("@covaga/e3d-core/epdz"),
    import("7z-wasm/7zz.wasm?url"),
  ]);
  const contents = await extractEpdz(buffer, {
    wasmUrl: wasmMod.default,
    // El .aml (decenas de MB) no hace falta para 3D/esquemas/proyecto.
    excludeGlobs: ["*.aml"],
  });

  let manifest: EplanManifest | null = null;
  const manifestEntry = contents.databases.find((d) =>
    d.path.toLowerCase().endsWith("manifest.db")
  );
  if (manifestEntry) {
    onStatus({ key: "status.readingManifest" });
    try {
      const [{ readManifest }, sqlWasm] = await Promise.all([
        import("@covaga/e3d-core/manifest"),
        import("sql.js/dist/sql-wasm.wasm?url"),
      ]);
      // El visor no debe quedarse bloqueado si sql.js no inicializa.
      manifest = await withTimeout(
        readManifest(manifestEntry.data, { wasmUrl: sqlWasm.default }),
        10000
      );
    } catch (error) {
      console.warn("No se pudo leer manifest.db:", error);
    }
  }

  const pages = buildPageList(contents.pages, manifest);

  const imageUrls = new Map<string, string>();
  for (const image of contents.images) {
    const imageName = (image.path.split("/").pop() ?? image.path).toLowerCase();
    imageUrls.set(imageName, URL.createObjectURL(new Blob([toArrayBuffer(image.data)])));
  }

  onStatus(null);
  if (contents.models.length === 0 && pages.length === 0) {
    onStatus({ key: "status.noContent" });
  }

  return {
    epdzModels: contents.models,
    pages,
    manifest,
    imageUrls,
    deviceIndex: buildDeviceIndex(pages),
    amlEntry: contents.amls[0] ?? null,
    view: contents.models.length > 0 ? "3d" : "pages",
    modelIndex: contents.models.length > 0 ? 0 : -1,
  };
}

/** Extrae solo el AutomationML de un .epdz (segunda pasada, tras la carga). */
export async function extractAmlEntry(buffer: ArrayBuffer): Promise<EpdzEntry | null> {
  const [{ extractEpdz }, wasmMod] = await Promise.all([
    import("@covaga/e3d-core/epdz"),
    import("7z-wasm/7zz.wasm?url"),
  ]);
  const contents = await extractEpdz(buffer, {
    wasmUrl: wasmMod.default,
    includeGlobs: ["*.aml"],
  });
  return contents.amls[0] ?? null;
}

/**
 * Construye la lista de páginas combinando los SVG extraídos con los
 * metadatos de manifest.db (nombres estructurados EPLAN). Si no hay
 * manifest, usa el <title> del propio SVG.
 */
function buildPageList(svgEntries: EpdzEntry[], manifest: EplanManifest | null): LoadedPage[] {
  const decoder = new TextDecoder("utf-8");
  const byFile = new Map<string, EpdzEntry>();
  for (const entry of svgEntries) {
    byFile.set((entry.path.split("/").pop() ?? entry.path).toLowerCase(), entry);
  }

  const result: LoadedPage[] = [];
  const used = new Set<EpdzEntry>();

  if (manifest) {
    for (const page of manifest.pages) {
      const entry = page.file ? byFile.get(page.file.toLowerCase()) : undefined;
      if (!entry) continue;
      used.add(entry);
      result.push({
        path: entry.path,
        name: page.name,
        title: page.title,
        breadcrumb: page.breadcrumb,
        badge:
          [page.pageType?.replace(/_/g, " "), page.counter].filter(Boolean).join(" · ") || null,
        svgText: decoder.decode(entry.data),
        packageId: page.packageId,
      });
    }
  }

  for (const entry of svgEntries) {
    if (used.has(entry)) continue;
    const name = entry.path.split("/").pop() ?? entry.path;
    const svgText = decoder.decode(entry.data);
    result.push({
      path: entry.path,
      name,
      title: pageTitle(svgText, name),
      breadcrumb: [],
      badge: null,
      svgText,
      packageId: null,
    });
  }

  return result;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout tras ${ms} ms`)), ms)
    ),
  ]);
}

export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = data;
  if (buffer instanceof ArrayBuffer && byteOffset === 0 && byteLength === buffer.byteLength) {
    return buffer;
  }
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  const copy = new Uint8Array(byteLength);
  copy.set(data);
  return copy.buffer;
}
