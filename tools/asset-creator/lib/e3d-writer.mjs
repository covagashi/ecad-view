// Serializador del formato binario EPLAN E3D (v4), simétrico al parser de
// packages/e3d-core/src/reader.ts. Ver docs/formats.md para el layout.
import { IDENTITY } from "./geometry.mjs";

class BinaryWriter {
  constructor() {
    this.chunks = [];
  }
  _push(size, fn) {
    const b = Buffer.alloc(size);
    fn(b);
    this.chunks.push(b);
  }
  byte(v) {
    this._push(1, (b) => b.writeUInt8(v));
  }
  short(v) {
    this._push(2, (b) => b.writeInt16LE(v));
  }
  long(v) {
    this._push(4, (b) => b.writeInt32LE(v));
  }
  float(v) {
    this._push(4, (b) => b.writeFloatLE(v));
  }
  /** RGBA en bytes; el canal A almacena transparencia (0 = opaco). */
  color([r, g, b], transparency = 0) {
    this._push(4, (buf) => {
      buf.writeUInt8(Math.round(r * 255), 0);
      buf.writeUInt8(Math.round(g * 255), 1);
      buf.writeUInt8(Math.round(b * 255), 2);
      buf.writeUInt8(Math.round(transparency * 255), 3);
    });
  }
  vector([x, y, z]) {
    this.float(x);
    this.float(y);
    this.float(z);
  }
  /** 4 vectores: columnas de la base (x,y,z) + traslación. */
  transform({ x, y, z, t }) {
    this.vector(x);
    this.vector(y);
    this.vector(z);
    this.vector(t);
  }
  floatBuffer(arr) {
    this.long(arr.length * 4);
    this._push(arr.length * 4, (b) => arr.forEach((v, i) => b.writeFloatLE(v, i * 4)));
  }
  uint16Buffer(arr) {
    this.long(arr.length * 2);
    this._push(arr.length * 2, (b) => arr.forEach((v, i) => b.writeUInt16LE(v, i * 2)));
  }
  /** Cadena UTF-16LE con prefijo de longitud en bytes. */
  string(s) {
    this.long(s.length * 2);
    this._push(s.length * 2, (b) => {
      for (let i = 0; i < s.length; i++) b.writeUInt16LE(s.charCodeAt(i), i * 2);
    });
  }
  bytes() {
    return Buffer.concat(this.chunks);
  }
}

/**
 * Serializa una Scene (lib/geometry.mjs) como E3D v4.
 * Cada malla lleva un único face group con colorValid=0, de modo que el
 * color lo aporta cada parte (partColor) — así las mallas son reutilizables.
 */
export function writeE3d(scene) {
  const w = new BinaryWriter();

  w.byte(4); // formatVersion
  w.transform(IDENTITY); // modelTransform
  w.vector(scene.viewBox);
  w.color(scene.backgroundTop);
  w.color(scene.backgroundBottom);
  w.long(0); // luces: el visor aporta las suyas
  w.long(0); // texturas

  w.long(scene.meshes.length);
  for (const m of scene.meshes) {
    if (m.indices.length > 0xffff) {
      throw new Error(`Malla con ${m.indices.length} índices: supera el máximo uint16`);
    }
    w.byte(0b011); // vertexFlags: posiciones + normales
    w.floatBuffer(m.vertexArray);
    w.long(1); // un face group
    w.byte(0); // material.colorValid = 0 -> hereda partColor
    w.color([1, 1, 1]);
    w.short(-1); // sin textura
    w.vector([0, 0, 0]); // elements.center (v>=2)
    w.byte(6); // modo: triangles
    w.long(m.indices.length);
    w.byte(1); // índices uint16
    w.uint16Buffer(m.indices);
    w.long(0); // sin edge groups
  }

  w.long(scene.parts.length);
  for (const p of scene.parts) {
    w.short(p.meshId);
    w.transform(p.transform);
    w.color(p.color, p.transparency);
    w.short(p.typeId); // v3+
    w.long(p.objectId);
    w.long(p.textLines.length); // v4+
    for (const t of p.textLines) {
      w.transform(t.transform);
      w.float(t.height);
      w.short(t.justCode);
      w.string(t.text);
    }
  }

  return w.bytes();
}
