// Primitivas 3D y composición de escenas para el generador de assets.
// Todas las mallas son flat-shaded (vértices duplicados por cara, con la
// normal de la cara) para el estilo low-poly y para que el STL salga directo.
// Convención EPLAN: Z hacia arriba, unidades en milímetros.

// ---------- vectores ----------
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a) => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Base ortonormal (columnas x,y,z) cuyo eje Z apunta en `dir`. */
export function basisFromZ(dir) {
  const z = normalize(dir);
  const helper = Math.abs(z[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const x = normalize(cross(helper, z));
  const y = cross(z, x);
  return { x, y, z };
}

export const IDENTITY = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], t: [0, 0, 0] };

// ---------- generadores de triángulos (primitivas unitarias) ----------

/** Esfera unitaria centrada en el origen. */
export function sphereTris(lonSeg = 10, latSeg = 7) {
  const pt = (lat, lon) => {
    const phi = (lat / latSeg) * Math.PI;
    const theta = (lon / lonSeg) * 2 * Math.PI;
    return [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
  };
  const tris = [];
  for (let lat = 0; lat < latSeg; lat++) {
    for (let lon = 0; lon < lonSeg; lon++) {
      const a = pt(lat, lon), b = pt(lat + 1, lon);
      const c = pt(lat + 1, lon + 1), d = pt(lat, lon + 1);
      if (lat > 0) tris.push([a, b, d]);
      if (lat < latSeg - 1) tris.push([b, c, d]);
    }
  }
  return tris;
}

/** Cono: base de radio 1 en z=0, ápice en (0,0,1), con tapa. */
export function coneTris(seg = 12) {
  const tris = [];
  const apex = [0, 0, 1], base = [0, 0, 0];
  const ring = (i) => {
    const t = (i / seg) * 2 * Math.PI;
    return [Math.cos(t), Math.sin(t), 0];
  };
  for (let i = 0; i < seg; i++) {
    const a = ring(i), b = ring(i + 1);
    tris.push([a, b, apex], [b, a, base]);
  }
  return tris;
}

/** Cilindro: radio 1, de z=0 a z=1, con tapas. */
export function cylinderTris(seg = 12) {
  const tris = [];
  const ring = (i, z) => {
    const t = (i / seg) * 2 * Math.PI;
    return [Math.cos(t), Math.sin(t), z];
  };
  const top = [0, 0, 1], bottom = [0, 0, 0];
  for (let i = 0; i < seg; i++) {
    const a0 = ring(i, 0), b0 = ring(i + 1, 0);
    const a1 = ring(i, 1), b1 = ring(i + 1, 1);
    tris.push([a0, b0, b1], [a0, b1, a1], [a1, b1, top], [b0, a0, bottom]);
  }
  return tris;
}

/** Cubo unitario centrado en el origen (aristas de longitud 1). */
export function boxTris() {
  const v = (i) => [(i & 1 ? 0.5 : -0.5), (i & 2 ? 0.5 : -0.5), (i & 4 ? 0.5 : -0.5)];
  const quads = [
    [0, 2, 3, 1], // -Z
    [4, 5, 7, 6], // +Z
    [0, 1, 5, 4], // -Y
    [2, 6, 7, 3], // +Y
    [0, 4, 6, 2], // -X
    [1, 3, 7, 5], // +X
  ];
  const tris = [];
  for (const [a, b, c, d] of quads) tris.push([v(a), v(b), v(c)], [v(a), v(c), v(d)]);
  return tris;
}

/** Toro: radio mayor 1 en el plano XY, radio de tubo `r`. */
export function torusTris(majorSeg = 14, minorSeg = 8, r = 0.15) {
  const pt = (i, j) => {
    const th = (i / majorSeg) * 2 * Math.PI;
    const ph = (j / minorSeg) * 2 * Math.PI;
    const rad = 1 + r * Math.cos(ph);
    return [rad * Math.cos(th), rad * Math.sin(th), r * Math.sin(ph)];
  };
  const tris = [];
  for (let i = 0; i < majorSeg; i++) {
    for (let j = 0; j < minorSeg; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      tris.push([a, b, c], [a, c, d]);
    }
  }
  return tris;
}

/** Ear-clipping de un polígono simple 2D en orden CCW; devuelve triples de índices. */
function triangulate2d(pts) {
  const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const idx = pts.map((_, i) => i);
  const tris = [];
  let guard = pts.length * pts.length + 10;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length];
      const ib = idx[i];
      const ic = idx[(i + 1) % idx.length];
      const [a, b, c] = [pts[ia], pts[ib], pts[ic]];
      if (area2(a, b, c) <= 1e-9) continue; // vértice reflejo: no es oreja
      let ear = true;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        const p = pts[j];
        if (area2(a, b, p) >= 0 && area2(b, c, p) >= 0 && area2(c, a, p) >= 0) {
          ear = false;
          break;
        }
      }
      if (ear) {
        tris.push([ia, ib, ic]);
        idx.splice(i, 1);
        clipped = true;
        break;
      }
    }
    if (!clipped) break; // polígono degenerado: devolver lo que haya
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

/**
 * Prisma extruido: perfil 2D `[[y,z],...]` (polígono simple, CCW) extruido
 * a lo largo de X con profundidad 1 (x en -0.5..0.5). El perfil admite
 * concavidades y chaflanes; las tapas se trian por ear-clipping.
 */
export function extrudeTris(profile) {
  const caps = triangulate2d(profile);
  const P = (x, [y, z]) => [x, y, z];
  const tris = [];
  for (const [a, b, c] of caps) {
    tris.push([P(0.5, profile[a]), P(0.5, profile[b]), P(0.5, profile[c])]); // tapa +X
    tris.push([P(-0.5, profile[a]), P(-0.5, profile[c]), P(-0.5, profile[b])]); // tapa -X
  }
  for (let i = 0; i < profile.length; i++) {
    const p = profile[i];
    const q = profile[(i + 1) % profile.length];
    const A = P(-0.5, p), B = P(0.5, p), C = P(0.5, q), D = P(-0.5, q);
    tris.push([A, C, B], [A, D, C]);
  }
  return tris;
}

/**
 * Lista de triángulos -> malla flat-shaded {vertexArray, indices}.
 * vertexArray intercala [pos.xyz][normal.xyz] (stride 6); los índices son
 * secuenciales porque cada cara lleva sus propios vértices.
 */
export function toFlatMesh(tris, transform = null) {
  const verts = [];
  const indices = [];
  let i = 0;
  for (let [a, b, c] of tris) {
    if (transform) [a, b, c] = [a, b, c].map(transform);
    const n = normalize(cross(sub(b, a), sub(c, a)));
    for (const p of [a, b, c]) {
      verts.push(p[0], p[1], p[2], n[0], n[1], n[2]);
      indices.push(i++);
    }
  }
  return { vertexArray: verts, indices };
}

// ---------- escena ----------

/**
 * Escena componible: mallas compartidas + partes instanciadas con transform
 * (base 3x3 con escala + traslación) y color RGBA por parte.
 * Los helpers (ball/tube/cone/box/ring/oriented) cubren los casos comunes.
 */
export class Scene {
  constructor({ viewBox = [200, 200, 200], backgroundTop = [0.78, 0.86, 0.98], backgroundBottom = [0.96, 0.96, 0.98] } = {}) {
    this.viewBox = viewBox;
    this.backgroundTop = backgroundTop;
    this.backgroundBottom = backgroundBottom;
    this.meshes = [];
    this.parts = [];
    this._primitives = new Map();
    this._nextObjectId = 1;
  }

  /** Registra una malla (lista de triángulos) y devuelve su id. */
  addMesh(tris, transform = null) {
    this.meshes.push(toFlatMesh(tris, transform));
    return this.meshes.length - 1;
  }

  _primitive(name, factory) {
    if (!this._primitives.has(name)) this._primitives.set(name, this.addMesh(factory()));
    return this._primitives.get(name);
  }

  /**
   * Añade una parte. `transform` = {x,y,z,t} (columnas de la base + traslación).
   * `color` = [r,g,b] en 0..1; `transparency` en 0 (opaco) .. 1 (invisible).
   */
  part(meshId, transform, color, { transparency = 0, typeId = 1, objectId } = {}) {
    const part = {
      meshId,
      transform,
      color,
      transparency,
      typeId,
      objectId: objectId ?? this._nextObjectId++,
      textLines: [],
    };
    this.parts.push(part);
    return part;
  }

  /** Elipsoide alineado con los ejes: esfera unitaria escalada. */
  ball(center, [sx, sy, sz], color, opts) {
    const id = this._primitive("sphere", sphereTris);
    return this.part(id, { x: [sx, 0, 0], y: [0, sy, 0], z: [0, 0, sz], t: center }, color, opts);
  }

  /** Cilindro entre dos puntos. */
  tube(from, to, radius, color, opts) {
    const id = this._primitive("cylinder", cylinderTris);
    const d = sub(to, from);
    const { x, y, z } = basisFromZ(d);
    return this.part(
      id,
      { x: scale(x, radius), y: scale(y, radius), z: scale(z, length(d)), t: from },
      color,
      opts
    );
  }

  /** Cono desde `base` en dirección `dir`. */
  cone(base, dir, len, radius, color, opts) {
    const id = this._primitive("cone", coneTris);
    const { x, y, z } = basisFromZ(dir);
    return this.part(
      id,
      { x: scale(x, radius), y: scale(y, radius), z: scale(z, len), t: base },
      color,
      opts
    );
  }

  /** Caja alineada con los ejes, centrada en `center`, con tamaño total `size`. */
  box(center, [sx, sy, sz], color, opts) {
    const id = this._primitive("box", boxTris);
    return this.part(id, { x: [sx, 0, 0], y: [0, sy, 0], z: [0, 0, sz], t: center }, color, opts);
  }

  /**
   * Prisma extruido a lo largo de X: perfil `[[y,z],...]` en mm (CCW),
   * desde x = xCenter - width/2 hasta x = xCenter + width/2.
   */
  prism(profile, xCenter, width, color, opts) {
    const id = this.addMesh(extrudeTris(profile));
    return this.part(
      id,
      { x: [width, 0, 0], y: [0, 1, 0], z: [0, 0, 1], t: [xCenter, 0, 0] },
      color,
      opts
    );
  }

  /** Anillo (toro) en el plano XY local, escalado por radios. */
  ring(center, [sx, sy, sz], color, opts) {
    const id = this._primitive("torus", torusTris);
    return this.part(id, { x: [sx, 0, 0], y: [0, sy, 0], z: [0, 0, sz], t: center }, color, opts);
  }

  /** Elipsoide orientado: semieje `a` según `dir`, `b` en su plano, grosor `c`. */
  oriented(center, dir, [a, b, c], color, opts) {
    const id = this._primitive("sphere", sphereTris);
    const { x, y, z } = basisFromZ(dir);
    return this.part(
      id,
      { x: scale(x, c), y: scale(y, b), z: scale(z, a), t: center },
      color,
      opts
    );
  }

  /**
   * Etiqueta de texto EPLAN anclada a una parte (v4). `facing` es la normal
   * del plano del texto (por defecto -Y, hacia la cámara del visor).
   * OJO: el transform del texto compone con el de la parte; usa una parte
   * sin escala (p. ej. una malla a tamaño real) como ancla.
   */
  label(part, text, { position = [0, 0, 0], height = 16, justCode = 8, facing = [0, -1, 0] } = {}) {
    const z = normalize(facing);
    const up = Math.abs(z[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    part.textLines.push({ transform: { x, y, z, t: position }, height, justCode, text });
    return part;
  }
}
