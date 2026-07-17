import { parseE3d } from "@covaga/e3d-core";
import type { EpdzEntry } from "@covaga/e3d-core/epdz";
import { toArrayBuffer } from "./loadProject";

/**
 * Índice inverso pieza→modelo: mapea la clave "{typeId}_{objectId}" de cada
 * parte 3D al índice del modelo (.e3d) que la contiene. Sirve para el salto
 * esquema→3D: una función del manifest da el par (typeId, objectId), pero el
 * objectId por sí solo se repite entre modelos, así que hace falta la clave
 * compuesta (única en todo el proyecto) para saber a qué modelo cambiar.
 *
 * Se construye parseando cada modelo una sola vez y se cachea por proyecto,
 * al estilo de sceneCache; parsear un E3D solo lee metadatos (no monta la
 * escena three.js), así que el coste es asumible y se paga una única vez.
 */
const cache = new Map<string, Map<string, number>>();

export function getPartLocations(projectId: string, models: EpdzEntry[]): Map<string, number> {
  const hit = cache.get(projectId);
  if (hit) return hit;
  const map = new Map<string, number>();
  models.forEach((entry, modelIndex) => {
    try {
      const scene = parseE3d(toArrayBuffer(entry.data));
      for (const part of scene.parts) {
        if (part.objectId === undefined || part.typeId === undefined) continue;
        const key = `${part.typeId}_${part.objectId}`;
        // La primera aparición gana; la clave es única en el proyecto de todos modos.
        if (!map.has(key)) map.set(key, modelIndex);
      }
    } catch {
      // Modelo ilegible: se omite (no debe romper el resto del índice).
    }
  });
  cache.set(projectId, map);
  return map;
}

export function evictPartLocations(projectId: string): void {
  cache.delete(projectId);
}
