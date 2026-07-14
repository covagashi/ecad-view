// Serializador STL binario a partir de una Scene (lib/geometry.mjs).
// STL no tiene concepto de partes, colores ni instancias: se "hornean" los
// transforms de todas las partes en una única sopa de triángulos en mm.
import { sub, cross, dot, normalize } from "./geometry.mjs";

/** Aplica la base 3x3 + traslación de una parte a un punto local. */
function apply({ x, y, z, t }, [px, py, pz]) {
  return [
    x[0] * px + y[0] * py + z[0] * pz + t[0],
    x[1] * px + y[1] * py + z[1] * pz + t[1],
    x[2] * px + y[2] * py + z[2] * pz + t[2],
  ];
}

/**
 * Serializa la escena como STL binario (little-endian):
 * cabecera de 80 bytes + uint32 nº de triángulos + 50 bytes por triángulo.
 * Las normales se recalculan tras el transform; si la base invierte la
 * orientación (determinante negativo) se voltea el winding.
 */
export function writeStl(scene, { header = "ecad-view asset-creator" } = {}) {
  let triCount = 0;
  for (const part of scene.parts) {
    triCount += scene.meshes[part.meshId].indices.length / 3;
  }

  const buf = Buffer.alloc(84 + triCount * 50);
  buf.write(header.slice(0, 79), 0, "ascii");
  buf.writeUInt32LE(triCount, 80);

  let off = 84;
  for (const part of scene.parts) {
    const { transform } = part;
    const mesh = scene.meshes[part.meshId];
    const flip = dot(transform.x, cross(transform.y, transform.z)) < 0;
    const va = mesh.vertexArray;
    const stride = 6; // [pos.xyz][normal.xyz], ver toFlatMesh

    for (let i = 0; i < mesh.indices.length; i += 3) {
      const p = (k) => {
        const base = mesh.indices[i + k] * stride;
        return apply(transform, [va[base], va[base + 1], va[base + 2]]);
      };
      let a = p(0), b = p(1), c = p(2);
      if (flip) [b, c] = [c, b];
      const n = normalize(cross(sub(b, a), sub(c, a)));
      for (const v of [n, a, b, c]) {
        buf.writeFloatLE(v[0], off);
        buf.writeFloatLE(v[1], off + 4);
        buf.writeFloatLE(v[2], off + 8);
        off += 12;
      }
      buf.writeUInt16LE(0, off); // attribute byte count
      off += 2;
    }
  }

  return buf;
}
