import { parseE3d } from "@covaga/e3d-core";
import type { EpdzEntry } from "@covaga/e3d-core/epdz";
import { toArrayBuffer } from "../state/loadProject";

/*
 * Cajas envolventes 2D/3D por pieza de los modelos E3D, en el espacio EPLAN
 * (Z hacia arriba, sin la rotación a Y-up de three.js). Sirven para dibujar
 * proyecciones frontales 2D reales (alzado: X horizontal, Z vertical) sin
 * montar una escena three.js, p. ej. el bornero de la vista "Datos".
 */

export interface PartBox {
  /** Índice del modelo (.e3d) que contiene la pieza. */
  modelIndex: number;
  /** Esquinas de la caja en coordenadas de mundo EPLAN (mm). */
  min: [number, number, number];
  max: [number, number, number];
}

/** "typeId_objectId" -> caja; misma clave que partLocator/svgElementId. */
export type PartBoxIndex = Map<string, PartBox>;

const cache = new Map<string, PartBoxIndex>();

export function getPartBoxes(projectId: string, models: EpdzEntry[]): PartBoxIndex {
  const hit = cache.get(projectId);
  if (hit) return hit;

  const index: PartBoxIndex = new Map();
  models.forEach((entry, modelIndex) => {
    try {
      const scene = parseE3d(toArrayBuffer(entry.data));
      // Caja local de cada mesh, calculada una sola vez por modelo.
      const meshBoxes = new Map<number, { min: number[]; max: number[] } | null>();
      const localBox = (meshId: number) => {
        let box = meshBoxes.get(meshId);
        if (box !== undefined) return box;
        const mesh = scene.meshes[meshId];
        if (!mesh?.hasPoints || mesh.vertexArray.length === 0) {
          box = null;
        } else {
          const min = [Infinity, Infinity, Infinity];
          const max = [-Infinity, -Infinity, -Infinity];
          const { vertexArray, stride } = mesh;
          for (let i = 0; i + 2 < vertexArray.length; i += stride) {
            for (let axis = 0; axis < 3; axis++) {
              const value = vertexArray[i + axis];
              if (value < min[axis]) min[axis] = value;
              if (value > max[axis]) max[axis] = value;
            }
          }
          box = { min, max };
        }
        meshBoxes.set(meshId, box);
        return box;
      };

      for (const part of scene.parts) {
        if (part.objectId === undefined || part.typeId === undefined) continue;
        const key = `${part.typeId}_${part.objectId}`;
        if (index.has(key)) continue;
        const box = localBox(part.meshId);
        if (!box) continue;

        // Caja de mundo: las 8 esquinas locales por la matriz de la pieza.
        const m = part.transform;
        const min: [number, number, number] = [Infinity, Infinity, Infinity];
        const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
        for (let corner = 0; corner < 8; corner++) {
          const x = corner & 1 ? box.max[0] : box.min[0];
          const y = corner & 2 ? box.max[1] : box.min[1];
          const z = corner & 4 ? box.max[2] : box.min[2];
          const world = [
            m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14],
          ];
          for (let axis = 0; axis < 3; axis++) {
            if (world[axis] < min[axis]) min[axis] = world[axis];
            if (world[axis] > max[axis]) max[axis] = world[axis];
          }
        }
        index.set(key, { modelIndex, min, max });
      }
    } catch {
      // Modelo ilegible: se omite sin romper el resto.
    }
  });
  cache.set(projectId, index);
  return index;
}

export function evictPartBoxes(projectId: string): void {
  cache.delete(projectId);
}
