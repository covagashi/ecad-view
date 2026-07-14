import { parseE3d, type E3dScene } from "@covaga/e3d-core";
import type { EpdzEntry } from "@covaga/e3d-core/epdz";
import { toArrayBuffer } from "./loadProject";

/**
 * Caché LRU de escenas E3D parseadas. Los buffers crudos viven en cada
 * ProjectDoc; parsear es rápido, así que basta con retener unas pocas
 * escenas para que el cambio de pestaña/modelo sea instantáneo sin
 * disparar la memoria con muchos proyectos abiertos.
 */
const MAX_ENTRIES = 2;
const cache = new Map<string, E3dScene>();

export function getScene(projectId: string, modelIndex: number, entry: EpdzEntry): E3dScene {
  const key = `${projectId}:${modelIndex}`;
  const hit = cache.get(key);
  if (hit) {
    // Reinsertar para marcarla como usada recientemente.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const scene = parseE3d(toArrayBuffer(entry.data));
  cache.set(key, scene);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string;
    cache.delete(oldest);
  }
  return scene;
}

export function evictProject(projectId: string) {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${projectId}:`)) cache.delete(key);
  }
}
