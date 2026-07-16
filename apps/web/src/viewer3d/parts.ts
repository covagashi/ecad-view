import type { E3dScene } from "@covaga/e3d-core";
import type { EplanManifest } from "@covaga/e3d-core/manifest";

/** Entrada del desglose de piezas del modelo 3D activo. */
export interface PartEntry {
  /** Clave estable: designación EPLAN del aparato u "obj:<objectId>". */
  key: string;
  /** Nombre para mostrar: designación del manifest o primer texto de la pieza. */
  label: string;
  /** objectIds de las partes de la escena que forman este aparato. */
  objectIds: number[];
  /** Nº de instancias (partes de la escena) agrupadas. */
  count: number;
}

/**
 * Construye el desglose de piezas de la escena. Las partes se resuelven contra
 * las funciones del manifest ("Id{typeId}_{objectId}") y las que comparten
 * designación (subpartes del mismo aparato) se agrupan en una sola entrada;
 * el resto queda como entradas individuales por objectId.
 */
export function buildPartList(
  scene: E3dScene | null,
  manifest: EplanManifest | null
): PartEntry[] {
  if (!scene) return [];

  const designations = new Map<string, string>();
  for (const fn of manifest?.functions ?? []) {
    if (fn.svgElementId && fn.designation) designations.set(fn.svgElementId, fn.designation);
  }

  const byKey = new Map<string, PartEntry>();
  for (const part of scene.parts) {
    if (part.objectId === undefined) continue;
    const designation =
      part.typeId !== undefined
        ? designations.get(`Id${part.typeId}_${part.objectId}`)
        : undefined;
    const key = designation ?? `obj:${part.objectId}`;
    let entry = byKey.get(key);
    if (!entry) {
      const tail = designation?.split(/[+=&]+/).pop()?.replace(/^#/, "");
      const text = part.textLines.find((line) => line.text.trim())?.text.trim();
      entry = { key, label: tail || text || "", objectIds: [], count: 0 };
      byKey.set(key, entry);
    }
    if (!entry.objectIds.includes(part.objectId)) entry.objectIds.push(part.objectId);
    entry.count++;
  }

  // Aparatos con designación primero (alfabético); el resto por objectId.
  return [...byKey.values()].sort((a, b) => {
    if (!!a.label !== !!b.label) return a.label ? -1 : 1;
    if (!a.label) return a.objectIds[0] - b.objectIds[0];
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });
}
