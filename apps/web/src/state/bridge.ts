import type { EplanManifest } from "@covaga/e3d-core/manifest";
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

/** Pieza 3D a la que resuelve un dispositivo del esquema (dirección inversa). */
export interface Part3dTarget {
  /** Índice del modelo (.e3d) que contiene la pieza. */
  modelIndex: number;
  /** objectId de la pieza dentro de ese modelo. */
  objectId: number;
}

/**
 * Índice inverso esquema→3D: para cada dispositivo con representación 3D, la
 * pieza a la que saltar. Reutiliza la misma cadena que el sentido 3D→esquema,
 * al revés: designación de la función → svgElementId ("Id{typeId}_{objectId}")
 * → el par se busca en el índice pieza→modelo (partLocations); solo se conservan
 * las funciones cuyo par corresponde a una pieza 3D real. El dispositivo se casa
 * por clave exacta o por etiqueta (cola), igual que findDeviceByDesignation.
 *
 * Devuelve un Map por Device.key; los dispositivos sin pieza 3D no aparecen (la
 * UI omite la acción "Ver en 3D" para ellos: sin botones muertos).
 */
export function buildDeviceTo3dIndex(
  devices: Device[],
  manifest: EplanManifest | null,
  partLocations: Map<string, number>
): Map<string, Part3dTarget> {
  const out = new Map<string, Part3dTarget>();
  if (!manifest || partLocations.size === 0) return out;

  // Funciones con pieza 3D real, indexadas por clave de designación y por etiqueta.
  const byKey = new Map<string, Part3dTarget>();
  const byLabel = new Map<string, Part3dTarget>();
  for (const fn of manifest.functions) {
    if (!fn.designation || !fn.svgElementId) continue;
    const match = /^Id(\d+)_(\d+)$/.exec(fn.svgElementId);
    if (!match) continue;
    const modelIndex = partLocations.get(`${match[1]}_${match[2]}`);
    if (modelIndex === undefined) continue; // La función no tiene pieza 3D.
    const target: Part3dTarget = { modelIndex, objectId: Number(match[2]) };
    const key = fn.designation.replace(/:[^:]*$/, "");
    if (!byKey.has(key)) byKey.set(key, target);
    const tail = key.split(/[+=&]+/).pop()?.replace(/^#/, "");
    if (tail && !byLabel.has(tail)) byLabel.set(tail, target);
  }

  for (const device of devices) {
    const target = byKey.get(device.key) ?? byLabel.get(device.label);
    if (target) out.set(device.key, target);
  }
  return out;
}

/**
 * Busca el dispositivo del índice de esquemas que corresponde a una designación
 * EPLAN completa (ep.20001, con o sin punto de conexión). Se normaliza igual que
 * en buildDeviceIndex: primero por clave exacta, si no por la etiqueta (cola tras
 * el último separador de estructura). Devuelve null si no aparece en los SVG.
 */
export function findDeviceByDesignation(index: DeviceIndex, designation: string): Device | null {
  // La designación de la función lleva el mismo formato que el <title> de los
  // símbolos; se normaliza igual que en buildDeviceIndex (sin punto de conexión).
  const key = designation.replace(/:[^:]*$/, "");
  const direct = index.devices.find((d) => d.key === key);
  if (direct) return direct;
  const tail = key.split(/[+=&]+/).pop()?.replace(/^#/, "");
  if (!tail) return null;
  return index.devices.find((d) => d.label === tail) ?? null;
}
