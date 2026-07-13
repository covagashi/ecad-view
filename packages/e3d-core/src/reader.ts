import type {
  E3dEdgeGroup,
  E3dEdgeStyle,
  E3dElements,
  E3dFaceGroup,
  E3dLight,
  E3dMaterial,
  E3dMesh,
  E3dPart,
  E3dPrimitiveMode,
  E3dScene,
  E3dTextLine,
  E3dTexture,
  Mat4,
  Rgba,
  Vec3,
} from "./types.js";

export class E3dParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "E3dParseError";
  }
}

const PRIMITIVE_MODES: E3dPrimitiveMode[] = [
  "points",
  "lineStrip",
  "lineLoop",
  "lines",
  "triangleStrip",
  "triangleFan",
  "triangles",
];

export const E3D_MAX_SUPPORTED_VERSION = 4;

/**
 * Parsea el formato binario EPLAN E3D (little-endian, versiones 1 a 4).
 *
 * Estructura del fichero:
 *   byte  versión
 *   view: transform 4x4 + viewBox + colores de fondo (top/bottom)
 *   luces[], texturas[], meshes[], parts[]
 */
export function parseE3d(buffer: ArrayBuffer): E3dScene {
  const r = new BinaryReader(buffer);

  const formatVersion = r.byte();
  if (formatVersion < 1 || formatVersion > E3D_MAX_SUPPORTED_VERSION) {
    throw new E3dParseError(`Versión de formato E3D no soportada: ${formatVersion}`);
  }

  const view = {
    modelTransform: r.transform(),
    viewBox: r.vector(),
    viewColors: { top: r.color(), bottom: r.color() },
  };

  const lights = r.array(() => readLight(r));
  const textures = r.array(() => readTexture(r));
  const meshes = r.array(() => readMesh(r, formatVersion));
  const parts = r.array(() => readPart(r, formatVersion));

  if (!r.atEnd()) {
    throw new E3dParseError(
      `Datos inesperados al final del fichero E3D (posición ${r.position} de ${buffer.byteLength})`
    );
  }

  return { formatVersion, view, lights, textures, meshes, parts };
}

function readLight(r: BinaryReader): E3dLight {
  const type = r.byte();
  const light: E3dLight = { type, color: r.color() };
  if (type === 2 || type === 3) light.position = r.vector();
  if (type === 1 || type === 3) light.direction = r.vector();
  if (type === 3) {
    light.angle = r.float();
    light.exponent = r.float();
  }
  return light;
}

function readTexture(r: BinaryReader): E3dTexture {
  r.byte(); // formato de píxel, siempre BGRA en la práctica
  const width = r.short();
  const height = r.short();
  const raw = r.bytes(width * height * 4);
  // BGRA -> RGBA
  const data = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 4) {
    data[i] = raw[i + 2];
    data[i + 1] = raw[i + 1];
    data[i + 2] = raw[i];
    data[i + 3] = raw[i + 3];
  }
  return { width, height, data };
}

function readMaterial(r: BinaryReader): E3dMaterial {
  return {
    colorValid: r.byte() > 0,
    color: r.color(),
    textureId: r.short(),
  };
}

function readEdgeStyle(r: BinaryReader): E3dEdgeStyle {
  return {
    color: r.color(),
    lineWidth: r.float(),
    lineType: r.byte(),
  };
}

function readElements(r: BinaryReader, formatVersion: number): E3dElements {
  const center = formatVersion >= 2 ? r.vector() : undefined;
  const modeIndex = r.byte();
  const mode = PRIMITIVE_MODES[modeIndex];
  if (!mode) throw new E3dParseError(`Modo de primitiva desconocido: ${modeIndex}`);
  const count = r.long();
  const typeIndex = r.byte();
  let indices: Uint8Array | Uint16Array;
  if (typeIndex === 0) {
    indices = r.byteBuffer();
  } else if (typeIndex === 1) {
    indices = r.shortBuffer();
  } else {
    throw new E3dParseError(`Tipo de índice desconocido: ${typeIndex}`);
  }
  return { center, mode, count, indices };
}

function readMesh(r: BinaryReader, formatVersion: number): E3dMesh {
  const flags = r.byte();
  const hasPoints = (flags & 1) > 0;
  const hasNormals = (flags & 2) > 0;
  const hasTexCoords = (flags & 4) > 0;
  const vertexArray = r.floatBuffer();
  const stride = (hasPoints ? 3 : 0) + (hasNormals ? 3 : 0) + (hasTexCoords ? 2 : 0);

  const faces: E3dFaceGroup[] = r.array(() => ({
    material: readMaterial(r),
    elements: readElements(r, formatVersion),
  }));
  const edges: E3dEdgeGroup[] = r.array(() => ({
    style: readEdgeStyle(r),
    elements: readElements(r, formatVersion),
  }));

  return { hasPoints, hasNormals, hasTexCoords, vertexArray, stride, faces, edges };
}

function readPart(r: BinaryReader, formatVersion: number): E3dPart {
  const part: E3dPart = {
    meshId: r.short(),
    transform: r.transform(),
    color: r.color(),
    textLines: [],
  };
  if (formatVersion >= 3) {
    part.typeId = r.short();
    part.objectId = r.long();
  }
  if (formatVersion >= 4) {
    part.textLines = r.array(() => readTextLine(r));
  }
  return part;
}

function readTextLine(r: BinaryReader): E3dTextLine {
  const transform = r.transform();
  const height = r.float();
  const justCode = r.short();

  // Código de justificación EPLAN: columnas 1-3 = abajo, 4-6 = medio, 7+ = arriba;
  // dentro de cada fila: izquierda, centro, derecha.
  const justification: [number, number, number] = [0, 0, 0.1];
  switch (justCode) {
    case 2: case 5: case 8: case 11:
      justification[0] = -0.5;
      break;
    case 3: case 6: case 9: case 12:
      justification[0] = -1;
      break;
  }
  switch (justCode) {
    case 1: case 2: case 3:
      justification[1] = -1;
      break;
    case 4: case 5: case 6:
      justification[1] = -0.5;
      break;
  }

  return { transform, height, justification, text: r.string() };
}

/** Lector binario secuencial little-endian sobre un ArrayBuffer. */
class BinaryReader {
  private readonly view: DataView;
  position = 0;

  constructor(private readonly buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  atEnd(): boolean {
    return this.position === this.buffer.byteLength;
  }

  private advance(byteLength: number): number {
    if (this.position + byteLength > this.buffer.byteLength) {
      throw new E3dParseError(
        `Fin de fichero inesperado: se necesitan ${byteLength} bytes en la posición ${this.position} (tamaño ${this.buffer.byteLength})`
      );
    }
    const start = this.position;
    this.position += byteLength;
    return start;
  }

  byte(): number {
    return this.view.getUint8(this.advance(1));
  }

  short(): number {
    return this.view.getInt16(this.advance(2), true);
  }

  long(): number {
    return this.view.getInt32(this.advance(4), true);
  }

  float(): number {
    return this.view.getFloat32(this.advance(4), true);
  }

  /** RGBA en bytes; el alfa se almacena como transparencia y se devuelve como opacidad. */
  color(): Rgba {
    const start = this.advance(4);
    return [
      this.view.getUint8(start) / 255,
      this.view.getUint8(start + 1) / 255,
      this.view.getUint8(start + 2) / 255,
      1 - this.view.getUint8(start + 3) / 255,
    ];
  }

  vector(): Vec3 {
    const start = this.advance(12);
    return [
      this.view.getFloat32(start, true),
      this.view.getFloat32(start + 4, true),
      this.view.getFloat32(start + 8, true),
    ];
  }

  /** 4 vectores fila del fichero -> matriz 4x4 column-major. */
  transform(): Mat4 {
    const x = this.vector();
    const y = this.vector();
    const z = this.vector();
    const t = this.vector();
    return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, t[0], t[1], t[2], 1];
  }

  /** Buffer con prefijo de longitud en bytes. */
  bytes(byteLength: number): Uint8Array {
    const start = this.advance(byteLength);
    return new Uint8Array(this.buffer, start, byteLength).slice();
  }

  byteBuffer(): Uint8Array {
    return this.bytes(this.long());
  }

  shortBuffer(): Uint16Array {
    const byteLength = this.long();
    const start = this.advance(byteLength);
    const count = byteLength >> 1;
    const out = new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = this.view.getUint16(start + i * 2, true);
    }
    return out;
  }

  floatBuffer(): Float32Array {
    const byteLength = this.long();
    const start = this.advance(byteLength);
    const count = byteLength >> 2;
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = this.view.getFloat32(start + i * 4, true);
    }
    return out;
  }

  /** Cadena UTF-16LE con prefijo de longitud en bytes; ignora terminadores nulos. */
  string(): string {
    const byteLength = this.long();
    const start = this.advance(byteLength);
    let out = "";
    for (let i = 0; i < byteLength >> 1; i++) {
      const code = this.view.getUint16(start + i * 2, true);
      if (code !== 0) out += String.fromCharCode(code);
    }
    return out;
  }

  /** Array con prefijo de número de elementos. */
  array<T>(readItem: () => T): T[] {
    const count = this.long();
    const out = new Array<T>(count);
    for (let i = 0; i < count; i++) out[i] = readItem();
    return out;
  }
}
