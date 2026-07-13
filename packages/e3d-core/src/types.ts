/** Matriz 4x4 column-major (misma convención que three.js). */
export type Mat4 = number[];

/** Color RGBA con componentes en [0,1]. El byte alfa del fichero es transparencia, ya convertido a opacidad. */
export type Rgba = [number, number, number, number];

export type Vec3 = [number, number, number];

export interface E3dView {
  modelTransform: Mat4;
  viewBox: Vec3;
  viewColors: { top: Rgba; bottom: Rgba };
}

export enum E3dLightType {
  Ambient = 0,
  Directional = 1,
  Point = 2,
  Spot = 3,
}

export interface E3dLight {
  type: E3dLightType;
  color: Rgba;
  position?: Vec3;
  direction?: Vec3;
  angle?: number;
  exponent?: number;
}

/** Textura RGBA sin comprimir (en fichero viene BGRA; el parser ya intercambia los canales). */
export interface E3dTexture {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface E3dMaterial {
  /** Si es false, se usa el color de la parte (E3dPart.color) en su lugar. */
  colorValid: boolean;
  color: Rgba;
  /** Índice en E3dScene.textures, o -1 si no hay textura. */
  textureId: number;
}

export interface E3dEdgeStyle {
  color: Rgba;
  lineWidth: number;
  lineType: number;
}

export type E3dPrimitiveMode =
  | "points"
  | "lineStrip"
  | "lineLoop"
  | "lines"
  | "triangleStrip"
  | "triangleFan"
  | "triangles";

export interface E3dElements {
  /** Centro del elemento (solo formato >= 2). */
  center?: Vec3;
  mode: E3dPrimitiveMode;
  /** Número de índices declarado en el fichero. */
  count: number;
  /** Índices sobre el vertex buffer del mesh. */
  indices: Uint8Array | Uint16Array;
}

export interface E3dFaceGroup {
  material: E3dMaterial;
  elements: E3dElements;
}

export interface E3dEdgeGroup {
  style: E3dEdgeStyle;
  elements: E3dElements;
}

export interface E3dMesh {
  hasPoints: boolean;
  hasNormals: boolean;
  hasTexCoords: boolean;
  /**
   * Buffer intercalado. Layout por vértice:
   * posición xyz (si hasPoints), normal xyz (si hasNormals), uv (si hasTexCoords).
   */
  vertexArray: Float32Array;
  /** Floats por vértice según los flags anteriores. */
  stride: number;
  faces: E3dFaceGroup[];
  edges: E3dEdgeGroup[];
}

export interface E3dTextLine {
  transform: Mat4;
  height: number;
  /**
   * Anclaje del texto derivado del código de justificación del fichero:
   * x en {0, -0.5, -1} (izquierda/centro/derecha), y en {0, -0.5, -1} (abajo/medio/arriba),
   * más un pequeño offset fijo en z de 0.1.
   */
  justification: [number, number, number];
  text: string;
}

export interface E3dPart {
  meshId: number;
  transform: Mat4;
  color: Rgba;
  /** Solo formato >= 3. */
  typeId?: number;
  /** Solo formato >= 3. Id del objeto en la BD del proyecto EPLAN. */
  objectId?: number;
  /** Solo formato >= 4. */
  textLines: E3dTextLine[];
}

export interface E3dScene {
  formatVersion: number;
  view: E3dView;
  lights: E3dLight[];
  textures: E3dTexture[];
  meshes: E3dMesh[];
  parts: E3dPart[];
}
