import type { Device, DeviceIndex } from "../devices";
import type { PickedPart, ProjectDoc } from "./types";

/** Resultado de resolver una pieza 3D hacia los esquemas. */
export type BridgeTarget =
  | { kind: "device"; device: Device }
  | { kind: "page"; pageIndex: number; elementId: string | null }
  | null;

/**
 * Título legible de la pieza seleccionada: designación de la función del
 * manifest si existe, si no la primera línea de texto de la pieza.
 */
export function pickedLabel(doc: ProjectDoc, picked: PickedPart): string | null {
  const fn = matchFunction(doc, picked);
  if (fn?.designation) {
    const tail = fn.designation.split(/[+=&]+/).pop() ?? fn.designation;
    return tail.replace(/^#/, "") || fn.designation;
  }
  return picked.textLines?.find((line) => line.trim().length > 0) ?? null;
}

/**
 * Resuelve la pieza 3D seleccionada hacia su representación en los esquemas.
 * Cadena de resolución (ver plan):
 *  1) "Id{typeId}_{objectId}" contra manifest.functions[].svgElementId
 *     (el sufijo del nombre de función casa con los ids de los SVG);
 *  2) designación de la función → índice de dispositivos;
 *  3) primera página de la función (packageId) + highlight del elemento;
 *  4) textos de la pieza contra las etiquetas de dispositivos.
 */
export function resolvePickedToSchematic(doc: ProjectDoc, picked: PickedPart): BridgeTarget {
  const fn = matchFunction(doc, picked);

  if (fn) {
    // 2) Por designación en el índice de dispositivos.
    if (fn.designation) {
      const device = findDeviceByDesignation(doc.deviceIndex, fn.designation);
      if (device) return { kind: "device", device };
    }
    // El propio svgElementId puede estar en el índice (cualquier página).
    if (fn.svgElementId) {
      for (let pageIndex = 0; pageIndex < doc.pages.length; pageIndex++) {
        const device = doc.deviceIndex.byElement.get(`${pageIndex}|${fn.svgElementId}`);
        if (device) return { kind: "device", device };
      }
    }
    // 3) Página por packageId de la función.
    for (const pageId of fn.pageIds) {
      const pageIndex = doc.pages.findIndex((p) => p.packageId === pageId);
      if (pageIndex >= 0) {
        return { kind: "page", pageIndex, elementId: fn.svgElementId };
      }
    }
  }

  // 4) Último recurso: los textos de la pieza contra las etiquetas.
  for (const raw of picked.textLines ?? []) {
    const text = raw.trim();
    if (!text) continue;
    const device =
      doc.deviceIndex.devices.find((d) => d.label === text) ??
      doc.deviceIndex.devices.find((d) => d.label.toLowerCase() === text.toLowerCase());
    if (device) return { kind: "device", device };
  }

  return null;
}

function matchFunction(doc: ProjectDoc, picked: PickedPart) {
  if (!doc.manifest || picked.typeId === undefined || picked.objectId === undefined) return null;
  const candidate = `Id${picked.typeId}_${picked.objectId}`;
  return doc.manifest.functions.find((fn) => fn.svgElementId === candidate) ?? null;
}

function findDeviceByDesignation(index: DeviceIndex, designation: string): Device | null {
  // La designación de la función lleva el mismo formato que el <title> de los
  // símbolos; se normaliza igual que en buildDeviceIndex (sin punto de conexión).
  const key = designation.replace(/:[^:=+&#]*$/, "");
  const direct = index.devices.find((d) => d.key === key);
  if (direct) return direct;
  const tail = key.split(/[+=&]+/).pop()?.replace(/^#/, "");
  if (!tail) return null;
  return index.devices.find((d) => d.label === tail) ?? null;
}
