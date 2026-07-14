import { tokenizeStructure } from "@byndr/e3d-core/manifest";
import { decodeEntities } from "./viewer/SchematicViewer";
import type { LoadedPage } from "./App";

/** Aparición de un dispositivo en una página concreta. */
export interface DeviceOccurrence {
  pageIndex: number;
  /** Id del grupo SVG del símbolo ("Id17_4180"). */
  elementId: string;
  /** Designación completa de esa aparición (con punto de conexión). */
  designation: string;
}

/** Dispositivo del proyecto, agregado a partir de los símbolos de los SVG. */
export interface Device {
  /** Designación del dispositivo sin el punto de conexión (clave de agrupación). */
  key: string;
  /** Nombre corto para mostrar, p. ej. "01-K1". */
  label: string;
  /** Ruta de estructura legible (asignación funcional, ubicación...). */
  crumb: string;
  occurrences: DeviceOccurrence[];
}

export interface DeviceIndex {
  devices: Device[];
  /** "pageIndex|elementId" -> dispositivo, para resolver clics en símbolos. */
  byElement: Map<string, Device>;
}

/** Símbolos EPLAN en el SVG: <g id="IdX_Y"><title>designación</title>. */
const SYMBOL_RE = /<g[^>]*\bid="(Id\d+_\d+)"[^>]*>\s*<title>([^<]*)<\/title>/g;

/**
 * Construye el índice de dispositivos del proyecto escaneando los símbolos de
 * todas las páginas SVG. Cada símbolo lleva su designación estructurada EPLAN
 * en el <title> (p. ej. "==EES=...+#01-K1:SH"); las apariciones con la misma
 * designación (ignorando el punto de conexión) se agrupan como un dispositivo.
 */
export function buildDeviceIndex(pages: LoadedPage[]): DeviceIndex {
  const byKey = new Map<string, Device>();
  const byElement = new Map<string, Device>();

  pages.forEach((page, pageIndex) => {
    for (const match of page.svgText.matchAll(SYMBOL_RE)) {
      const elementId = match[1];
      const designation = decodeEntities(match[2]).trim();
      if (!designation) continue;

      // La parte tras el último separador de estructura es el nombre del
      // dispositivo; el sufijo ":X" es el punto de conexión.
      const key = designation.replace(/:[^:=+&#]*$/, "");
      const tail = key.split(/[+=&]+/).pop() ?? key;
      const label = tail.replace(/^#/, "") || key;

      let device = byKey.get(key);
      if (!device) {
        const structure = key.slice(0, key.length - tail.length);
        device = { key, label, crumb: tokenizeStructure(structure).join(" › "), occurrences: [] };
        byKey.set(key, device);
      }
      device.occurrences.push({ pageIndex, elementId, designation });
      byElement.set(`${pageIndex}|${elementId}`, device);
    }
  });

  const devices = [...byKey.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  );
  return { devices, byElement };
}
