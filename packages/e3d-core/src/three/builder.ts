import * as THREE from "three";
import type {
  E3dElements,
  E3dMesh,
  E3dPart,
  E3dScene,
  E3dTextLine,
  Rgba,
} from "../types.js";

export interface BuildOptions {
  /** Renderiza las etiquetas de texto de las partes (requiere DOM/canvas). Por defecto: solo en navegador. */
  texts?: boolean;
  /** Renderiza las aristas (contornos) de los meshes. Por defecto true. */
  edges?: boolean;
  /** Excluye partes cuyo typeId esté en esta lista. */
  skipTypeIds?: number[];
}

export type VisibilityIsolated = number | ReadonlySet<number> | null;

export interface BuildResult {
  /** Grupo raíz, ya orientado de Z-up (EPLAN) a Y-up (three.js). */
  root: THREE.Group;
  /** Colores de fondo (top/bottom) sugeridos por el fichero. */
  background: { top: THREE.Color; bottom: THREE.Color };
}

const E3D_RUNTIME = "e3dRuntime";

interface BatchRef {
  mesh: THREE.BatchedMesh;
  instanceId: number;
}

interface PartHandle {
  group: THREE.Group;
  objectId: number | undefined;
  batches: BatchRef[];
}

interface EdgeLayer {
  line: THREE.LineSegments;
  /** Posiciones ya transformadas al espacio de zUpToYUp, por objectId. */
  byObjectId: Map<number, Float32Array>;
  unnamed: Float32Array[];
  allVisible: Float32Array;
}

interface E3dRuntime {
  partsByObjectId: Map<number, THREE.Group>;
  handles: PartHandle[];
  edgeLayers: EdgeLayer[];
  applyVisibility(hidden: ReadonlySet<number>, isolated: VisibilityIsolated): void;
}

function runtimeOf(root: THREE.Object3D): E3dRuntime | undefined {
  return root.userData[E3D_RUNTIME] as E3dRuntime | undefined;
}

/** True si la parte debe mostrarse con el filtro de visibilidad actual. */
export function isPartVisible(
  objectId: number | undefined,
  hidden: ReadonlySet<number>,
  isolated: VisibilityIsolated
): boolean {
  if (isolated !== null) {
    if (objectId === undefined) return false;
    return typeof isolated === "number" ? objectId === isolated : isolated.has(objectId);
  }
  return objectId === undefined || !hidden.has(objectId);
}

/**
 * Aplica visibilidad por objectId sobre una escena montada con `buildThreeScene`
 * (lotes BatchedMesh + aristas fusionadas + grupos de parte).
 */
export function applySceneVisibility(
  root: THREE.Object3D,
  hidden: ReadonlySet<number>,
  isolated: VisibilityIsolated
): void {
  runtimeOf(root)?.applyVisibility(hidden, isolated);
}

/** Primer grupo de parte con ese objectId, o null. */
export function findScenePart(root: THREE.Object3D, objectId: number): THREE.Object3D | null {
  const mapped = runtimeOf(root)?.partsByObjectId.get(objectId);
  if (mapped) return mapped;
  let found: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (!found && obj.userData.meshId !== undefined && obj.userData.objectId === objectId) {
      found = obj;
    }
  });
  return found;
}

/** Caja de mundo de una parte (usa la caja local del mesh si existe). */
export function partWorldBox(obj: THREE.Object3D, target = new THREE.Box3()): THREE.Box3 {
  const local = obj.userData.localBox as THREE.Box3 | undefined;
  if (local && !local.isEmpty()) {
    target.copy(local).applyMatrix4(obj.matrixWorld);
    return target;
  }
  return target.setFromObject(obj);
}

/**
 * Convierte una escena E3D parseada en un árbol de objetos three.js.
 *
 * Las caras se agrupan en un `BatchedMesh` por material (un draw call por
 * color, visibilidad por instancia) y las aristas en un `LineSegments` por
 * color. Cada parte sigue siendo un `THREE.Group` con
 * userData = { typeId, objectId, meshId } para picking y la UI.
 */
export function buildThreeScene(scene: E3dScene, options: BuildOptions = {}): BuildResult {
  const opts = {
    texts: options.texts ?? typeof document !== "undefined",
    edges: options.edges ?? true,
    skipTypeIds: new Set(options.skipTypeIds ?? []),
  };

  const textures = scene.textures.map((t) => {
    const tex = new THREE.DataTexture(t.data, t.width, t.height, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  });

  const root = new THREE.Group();
  root.name = "E3D";
  const zUpToYUp = new THREE.Group();
  zUpToYUp.name = "Z-up to Y-up";
  zUpToYUp.rotation.x = -Math.PI / 2;
  root.add(zUpToYUp);

  const materialCache = new Map<string, THREE.Material>();
  const faceGeomCache = new Map<string, THREE.BufferGeometry | null>();
  const meshAttrCache = new Map<number, MeshAttributes>();
  const partsByObjectId = new Map<number, THREE.Group>();
  const handles: PartHandle[] = [];
  const handleByPart = new Map<E3dPart, PartHandle>();
  const scratchMatrix = new THREE.Matrix4();

  type FacePlacement = {
    part: E3dPart;
    mesh: E3dMesh;
    meshId: number;
    faceIndex: number;
    color: Rgba;
    texture?: THREE.Texture;
  };

  const facesByMaterial = new Map<string, FacePlacement[]>();
  const edgeByColor = new Map<string, { color: Rgba; chunks: { objectId?: number; positions: Float32Array }[] }>();

  for (const part of scene.parts) {
    if (part.typeId !== undefined && opts.skipTypeIds.has(part.typeId)) continue;
    const mesh = scene.meshes[part.meshId];
    if (!mesh) continue;

    const partGroup = new THREE.Group();
    partGroup.name = `part:${part.objectId ?? part.meshId}`;
    partGroup.userData = {
      typeId: part.typeId,
      objectId: part.objectId,
      meshId: part.meshId,
      textLines: part.textLines.map((line) => line.text),
    };
    partGroup.matrixAutoUpdate = false;
    partGroup.matrix.fromArray(part.transform);

    const handle: PartHandle = { group: partGroup, objectId: part.objectId, batches: [] };
    handles.push(handle);
    handleByPart.set(part, handle);
    if (part.objectId !== undefined) partsByObjectId.set(part.objectId, partGroup);

    const localBox = new THREE.Box3();
    let hasBox = false;
    mesh.faces.forEach((face, faceIndex) => {
      const geom = getFaceGeometry(faceGeomCache, meshAttrCache, mesh, part.meshId, faceIndex);
      if (geom?.boundingBox && !geom.boundingBox.isEmpty()) {
        if (!hasBox) {
          localBox.copy(geom.boundingBox);
          hasBox = true;
        } else {
          localBox.union(geom.boundingBox);
        }
      }
      const color: Rgba = face.material.colorValid ? face.material.color : part.color;
      const texture =
        face.material.textureId >= 0 ? textures[face.material.textureId] : undefined;
      const key = `face:${color.join(",")}:${mesh.hasNormals}:${texture?.uuid ?? ""}`;
      let list = facesByMaterial.get(key);
      if (!list) {
        list = [];
        facesByMaterial.set(key, list);
      }
      list.push({ part, mesh, meshId: part.meshId, faceIndex, color, texture });
    });
    if (hasBox) partGroup.userData.localBox = localBox.clone();

    if (opts.edges) {
      scratchMatrix.fromArray(part.transform);
      mesh.edges.forEach((edge) => {
        const positions = bakeEdgePositions(mesh, edge.elements, scratchMatrix);
        if (!positions) return;
        const colorKey = edge.style.color.join(",");
        let layer = edgeByColor.get(colorKey);
        if (!layer) {
          layer = { color: edge.style.color, chunks: [] };
          edgeByColor.set(colorKey, layer);
        }
        layer.chunks.push({ objectId: part.objectId, positions });
      });
    }

    if (opts.texts) {
      for (const line of part.textLines) {
        const label = buildTextLabel(line);
        if (label) partGroup.add(label);
      }
    }

    zUpToYUp.add(partGroup);
  }

  for (const placements of facesByMaterial.values()) {
    const first = placements[0];
    const material = getFaceMaterial(
      materialCache,
      first.color,
      first.mesh.hasNormals,
      first.texture
    ) as THREE.MeshPhongMaterial;

    const unique = new Map<string, THREE.BufferGeometry>();
    let maxVertexCount = 0;
    let maxIndexCount = 0;
    for (const item of placements) {
      const gk = `${item.meshId}:${item.faceIndex}`;
      if (unique.has(gk)) continue;
      const geom = getFaceGeometry(faceGeomCache, meshAttrCache, item.mesh, item.meshId, item.faceIndex);
      if (!geom) continue;
      unique.set(gk, geom);
      maxVertexCount += geom.getAttribute("position").count;
      maxIndexCount += geom.index?.count ?? 0;
    }
    if (unique.size === 0 || maxVertexCount === 0) continue;

    const batched = new THREE.BatchedMesh(
      placements.length,
      maxVertexCount,
      Math.max(maxIndexCount, 1),
      material
    );
    batched.name = "faces";
    batched.frustumCulled = true;
    batched.perObjectFrustumCulled = true;
    batched.sortObjects = first.color[3] < 1;
    const instanceToPart: Array<number | undefined> = [];
    const geomIds = new Map<string, number>();
    for (const [gk, geom] of unique) {
      geomIds.set(gk, batched.addGeometry(geom));
    }

    for (const item of placements) {
      const geomId = geomIds.get(`${item.meshId}:${item.faceIndex}`);
      if (geomId === undefined) continue;
      const instanceId = batched.addInstance(geomId);
      batched.setMatrixAt(instanceId, scratchMatrix.fromArray(item.part.transform));
      instanceToPart[instanceId] = item.part.objectId;
      handleByPart.get(item.part)?.batches.push({ mesh: batched, instanceId });
    }
    batched.userData.instanceToPart = instanceToPart;
    batched.userData.kind = "e3d-faces";
    batched.computeBoundingBox();
    batched.computeBoundingSphere();
    zUpToYUp.add(batched);
  }

  const edgeLayers: EdgeLayer[] = [];
  if (opts.edges) {
    for (const layer of edgeByColor.values()) {
      const byObjectId = new Map<number, Float32Array[]>();
      const unnamed: Float32Array[] = [];
      for (const chunk of layer.chunks) {
        if (chunk.objectId === undefined) unnamed.push(chunk.positions);
        else {
          const list = byObjectId.get(chunk.objectId) ?? [];
          list.push(chunk.positions);
          byObjectId.set(chunk.objectId, list);
        }
      }
      const mergedById = new Map<number, Float32Array>();
      for (const [objectId, list] of byObjectId) mergedById.set(objectId, concatFloat32(list));
      const allVisible = concatFloat32([...mergedById.values(), ...unnamed]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(allVisible, 3));
      const material = getEdgeMaterial(materialCache, layer.color) as THREE.LineBasicMaterial;
      const line = new THREE.LineSegments(geometry, material);
      line.name = "edges";
      line.userData.kind = "e3d-edges";
      line.geometry.computeBoundingSphere();
      zUpToYUp.add(line);
      edgeLayers.push({
        line,
        byObjectId: mergedById,
        unnamed,
        allVisible,
      });
    }
  }

  const applyVisibility = (hidden: ReadonlySet<number>, isolated: VisibilityIsolated) => {
    const allShown = isolated === null && hidden.size === 0;
    for (const handle of handles) {
      const visible = isPartVisible(handle.objectId, hidden, isolated);
      handle.group.visible = visible;
      for (const ref of handle.batches) {
        ref.mesh.setVisibleAt(ref.instanceId, visible);
      }
    }
    for (const layer of edgeLayers) {
      if (allShown) {
        const attr = layer.line.geometry.getAttribute("position") as THREE.BufferAttribute;
        if (attr.array !== layer.allVisible) {
          layer.line.geometry.setAttribute("position", new THREE.BufferAttribute(layer.allVisible, 3));
          layer.line.geometry.computeBoundingSphere();
        }
        layer.line.visible = layer.allVisible.length > 0;
        continue;
      }
      const chunks: Float32Array[] = [];
      if (isolated === null) chunks.push(...layer.unnamed);
      for (const [objectId, positions] of layer.byObjectId) {
        if (isPartVisible(objectId, hidden, isolated)) chunks.push(positions);
      }
      const merged = concatFloat32(chunks);
      layer.line.geometry.setAttribute("position", new THREE.BufferAttribute(merged, 3));
      layer.line.geometry.computeBoundingSphere();
      layer.line.visible = merged.length > 0;
    }
  };

  root.userData[E3D_RUNTIME] = {
    partsByObjectId,
    handles,
    edgeLayers,
    applyVisibility,
  } satisfies E3dRuntime;

  // Geometry helpers are shared by BatchedMesh (copied on addGeometry); they
  // can be disposed after the batches are built.
  for (const geom of faceGeomCache.values()) geom?.dispose();

  return {
    root,
    background: {
      top: new THREE.Color(...scene.view.viewColors.top.slice(0, 3)),
      bottom: new THREE.Color(...scene.view.viewColors.bottom.slice(0, 3)),
    },
  };
}

function getFaceGeometry(
  cache: Map<string, THREE.BufferGeometry | null>,
  meshAttrCache: Map<number, MeshAttributes>,
  mesh: E3dMesh,
  meshId: number,
  faceIndex: number
): THREE.BufferGeometry | null {
  const key = `${meshId}:${faceIndex}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const face = mesh.faces[faceIndex];
  const geom = buildFaceGeometry(mesh, face, getMeshAttributes(meshAttrCache, mesh, meshId));
  cache.set(key, geom);
  return geom;
}

interface MeshAttributes {
  positions: Float32Array;
  normals: Float32Array | null;
  uvs: Float32Array | null;
  box: THREE.Box3;
}

function getMeshAttributes(
  cache: Map<number, MeshAttributes>,
  mesh: E3dMesh,
  meshId: number
): MeshAttributes | null {
  const hit = cache.get(meshId);
  if (hit) return hit;
  const { stride, vertexArray } = mesh;
  if (!mesh.hasPoints || stride === 0) return null;
  const vertexCount = Math.floor(vertexArray.length / stride);
  const positions = new Float32Array(vertexCount * 3);
  const normals = mesh.hasNormals ? new Float32Array(vertexCount * 3) : null;
  const uvs = mesh.hasTexCoords ? new Float32Array(vertexCount * 2) : null;
  const uvOffset = mesh.hasNormals ? 6 : 3;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < vertexCount; i++) {
    const base = i * stride;
    const x = vertexArray[base];
    const y = vertexArray[base + 1];
    const z = vertexArray[base + 2];
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    if (x < min.x) min.x = x;
    if (y < min.y) min.y = y;
    if (z < min.z) min.z = z;
    if (x > max.x) max.x = x;
    if (y > max.y) max.y = y;
    if (z > max.z) max.z = z;
    if (normals) {
      normals[i * 3] = vertexArray[base + 3];
      normals[i * 3 + 1] = vertexArray[base + 4];
      normals[i * 3 + 2] = vertexArray[base + 5];
    }
    if (uvs) {
      uvs[i * 2] = vertexArray[base + uvOffset];
      uvs[i * 2 + 1] = 1 - vertexArray[base + uvOffset + 1];
    }
  }
  const attrs: MeshAttributes = {
    positions,
    normals,
    uvs,
    box: new THREE.Box3(min, max),
  };
  cache.set(meshId, attrs);
  return attrs;
}

function buildFaceGeometry(
  mesh: E3dMesh,
  face: E3dMesh["faces"][number],
  attrs: MeshAttributes | null
): THREE.BufferGeometry | null {
  if (!attrs) return null;
  const indices = triangleIndexArray(face.elements);
  if (!indices) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(attrs.positions, 3));
  if (attrs.normals) geometry.setAttribute("normal", new THREE.BufferAttribute(attrs.normals, 3));
  if (attrs.uvs) geometry.setAttribute("uv", new THREE.BufferAttribute(attrs.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.boundingBox = attrs.box.clone();
  geometry.computeBoundingSphere();
  return geometry;
}

function bakeEdgePositions(
  mesh: E3dMesh,
  elements: E3dElements,
  matrix: THREE.Matrix4
): Float32Array | null {
  const pairs = lineSegmentIndexArray(elements);
  if (!pairs || !mesh.hasPoints || mesh.stride === 0) return null;
  const { vertexArray, stride } = mesh;
  const out = new Float32Array(pairs.length * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pairs.length; i++) {
    const base = pairs[i] * stride;
    v.set(vertexArray[base], vertexArray[base + 1], vertexArray[base + 2]).applyMatrix4(matrix);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}

function concatFloat32(chunks: Float32Array[]): Float32Array {
  if (chunks.length === 0) return new Float32Array(0);
  if (chunks.length === 1) return chunks[0];
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function triangleIndexArray(elements: E3dElements): Uint16Array | Uint32Array | null {
  const idx = elements.indices;
  const n = idx.length;
  let count = 0;
  switch (elements.mode) {
    case "triangles":
      count = n - (n % 3);
      break;
    case "triangleStrip":
    case "triangleFan":
      count = n >= 3 ? (n - 2) * 3 : 0;
      break;
    default:
      return null;
  }
  if (count <= 0) return null;
  let max = 0;
  for (let i = 0; i < n; i++) if (idx[i] > max) max = idx[i];
  const out = max > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  let o = 0;
  switch (elements.mode) {
    case "triangles":
      for (let i = 0; i + 2 < n; i += 3) {
        out[o++] = idx[i];
        out[o++] = idx[i + 1];
        out[o++] = idx[i + 2];
      }
      break;
    case "triangleStrip":
      for (let i = 2; i < n; i++) {
        if (i % 2 === 0) {
          out[o++] = idx[i - 2];
          out[o++] = idx[i - 1];
          out[o++] = idx[i];
        } else {
          out[o++] = idx[i - 1];
          out[o++] = idx[i - 2];
          out[o++] = idx[i];
        }
      }
      break;
    case "triangleFan":
      for (let i = 2; i < n; i++) {
        out[o++] = idx[0];
        out[o++] = idx[i - 1];
        out[o++] = idx[i];
      }
      break;
  }
  return out;
}

function lineSegmentIndexArray(elements: E3dElements): Uint16Array | Uint32Array | null {
  const idx = elements.indices;
  const n = idx.length;
  let count = 0;
  switch (elements.mode) {
    case "lines":
      count = n - (n % 2);
      break;
    case "lineStrip":
      count = n >= 2 ? (n - 1) * 2 : 0;
      break;
    case "lineLoop":
      count = n >= 2 ? n * 2 : 0;
      break;
    default:
      return null;
  }
  if (count <= 0) return null;
  let max = 0;
  for (let i = 0; i < n; i++) if (idx[i] > max) max = idx[i];
  const out = max > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  let o = 0;
  switch (elements.mode) {
    case "lines":
      for (let i = 0; i + 1 < n; i += 2) {
        out[o++] = idx[i];
        out[o++] = idx[i + 1];
      }
      break;
    case "lineStrip":
      for (let i = 1; i < n; i++) {
        out[o++] = idx[i - 1];
        out[o++] = idx[i];
      }
      break;
    case "lineLoop":
      for (let i = 1; i < n; i++) {
        out[o++] = idx[i - 1];
        out[o++] = idx[i];
      }
      if (n > 2) {
        out[o++] = idx[n - 1];
        out[o++] = idx[0];
      }
      break;
  }
  return out;
}

function getFaceMaterial(
  cache: Map<string, THREE.Material>,
  color: Rgba,
  hasNormals: boolean,
  texture?: THREE.Texture
): THREE.Material {
  const key = `face:${color.join(",")}:${hasNormals}:${texture?.uuid ?? ""}`;
  let mat = cache.get(key);
  if (!mat) {
    const opacity = color[3];
    mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color[0], color[1], color[2]),
      map: texture ?? null,
      side: THREE.DoubleSide,
      flatShading: !hasNormals,
      transparent: opacity < 1,
      opacity,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    cache.set(key, mat);
  }
  return mat;
}

function getEdgeMaterial(cache: Map<string, THREE.Material>, color: Rgba): THREE.Material {
  const key = `edge:${color.join(",")}`;
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(color[0], color[1], color[2]),
      transparent: color[3] < 1,
      opacity: color[3],
    });
    cache.set(key, mat);
  }
  return mat;
}

/** Etiqueta de texto como plano con textura de canvas, anclada según la justificación. */
function buildTextLabel(line: E3dTextLine): THREE.Object3D | null {
  if (!line.text || typeof document === "undefined") return null;

  const fontPx = 64;
  const pad = 4;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const font = `${fontPx}px sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(line.text);
  const inkLeft = Math.ceil(metrics.actualBoundingBoxLeft ?? 0);
  const inkRight = Math.ceil(metrics.actualBoundingBoxRight ?? metrics.width);
  const inkAscent = Math.ceil(metrics.actualBoundingBoxAscent ?? fontPx * 0.8);
  const inkDescent = Math.ceil(metrics.actualBoundingBoxDescent ?? fontPx * 0.25);
  canvas.width = Math.max(2, inkLeft + inkRight + pad * 2);
  canvas.height = Math.max(2, inkAscent + inkDescent + pad * 2);
  const ctx2 = canvas.getContext("2d")!;
  ctx2.font = font;
  ctx2.fillStyle = "#003FFF";
  ctx2.textBaseline = "alphabetic";
  ctx2.fillText(line.text, pad + inkLeft, pad + inkAscent);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const em = 0.75 * line.height;
  const unitsPerPx = em / fontPx;
  const boxWidth = metrics.width * unitsPerPx;

  const fontAscent = metrics.fontBoundingBoxAscent ?? fontPx * 0.8;
  const fontDescent = metrics.fontBoundingBoxDescent ?? fontPx * 0.2;
  const descentFraction = fontDescent / Math.max(1, fontAscent + fontDescent);

  const penX = line.justification[0] * boxWidth;
  const penY = (line.justification[1] + descentFraction) * em;

  const width = canvas.width * unitsPerPx;
  const height = canvas.height * unitsPerPx;
  const geometry = new THREE.PlaneGeometry(width, height);
  geometry.translate(
    penX + ((inkRight - inkLeft) / 2) * unitsPerPx,
    penY + ((inkAscent - inkDescent) / 2) * unitsPerPx,
    line.justification[2]
  );

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const label = new THREE.Mesh(geometry, material);
  label.name = `text:${line.text}`;
  label.matrixAutoUpdate = false;
  label.matrix.fromArray(line.transform);
  return label;
}
