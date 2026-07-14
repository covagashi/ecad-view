import * as THREE from "three";
import type {
  E3dElements,
  E3dMesh,
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

export interface BuildResult {
  /** Grupo raíz, ya orientado de Z-up (EPLAN) a Y-up (three.js). */
  root: THREE.Group;
  /** Colores de fondo (top/bottom) sugeridos por el fichero. */
  background: { top: THREE.Color; bottom: THREE.Color };
}

/**
 * Convierte una escena E3D parseada en un árbol de objetos three.js.
 * Cada parte del E3D se convierte en un THREE.Group con
 * userData = { typeId, objectId, meshId } para poder hacer picking.
 */
export function buildThreeScene(scene: E3dScene, options: BuildOptions = {}): BuildResult {
  const opts = {
    texts: options.texts ?? typeof document !== "undefined",
    edges: options.edges ?? true,
    skipTypeIds: options.skipTypeIds ?? [],
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
  // EPLAN usa Z hacia arriba; three.js, Y hacia arriba.
  const zUpToYUp = new THREE.Group();
  zUpToYUp.name = "Z-up to Y-up";
  zUpToYUp.rotation.x = -Math.PI / 2;
  root.add(zUpToYUp);

  const materialCache = new Map<string, THREE.Material>();
  const geometryCache = new Map<number, MeshGeometry>();

  for (const part of scene.parts) {
    if (part.typeId !== undefined && opts.skipTypeIds.includes(part.typeId)) continue;
    const mesh = scene.meshes[part.meshId];
    if (!mesh) continue;

    let geo = geometryCache.get(part.meshId);
    if (!geo) {
      geo = buildMeshGeometry(mesh);
      geometryCache.set(part.meshId, geo);
    }

    const partGroup = new THREE.Group();
    partGroup.name = `part:${part.objectId ?? part.meshId}`;
    partGroup.userData = {
      typeId: part.typeId,
      objectId: part.objectId,
      meshId: part.meshId,
      // Textos de la parte (etiquetas), útiles para identificarla en la UI.
      textLines: part.textLines.map((line) => line.text),
    };
    partGroup.matrixAutoUpdate = false;
    partGroup.matrix.fromArray(part.transform);

    if (geo.faces) {
      const materials = mesh.faces.map((face) => {
        const color: Rgba = face.material.colorValid ? face.material.color : part.color;
        const texture =
          face.material.textureId >= 0 ? textures[face.material.textureId] : undefined;
        return getFaceMaterial(materialCache, color, mesh.hasNormals, texture);
      });
      const faceMesh = new THREE.Mesh(geo.faces, materials);
      faceMesh.name = "faces";
      partGroup.add(faceMesh);
    }

    if (opts.edges && geo.edges) {
      const materials = mesh.edges.map((edge) =>
        getEdgeMaterial(materialCache, edge.style.color)
      );
      const lines = new THREE.LineSegments(geo.edges, materials);
      lines.name = "edges";
      partGroup.add(lines);
    }

    if (opts.texts) {
      for (const line of part.textLines) {
        const label = buildTextLabel(line);
        if (label) partGroup.add(label);
      }
    }

    zUpToYUp.add(partGroup);
  }

  return {
    root,
    background: {
      top: new THREE.Color(...scene.view.viewColors.top.slice(0, 3)),
      bottom: new THREE.Color(...scene.view.viewColors.bottom.slice(0, 3)),
    },
  };
}

interface MeshGeometry {
  faces: THREE.BufferGeometry | null;
  edges: THREE.BufferGeometry | null;
}

/**
 * Construye geometría indexada por mesh. Las caras de todos los face groups
 * comparten atributos y se separan con geometry.groups (un material por grupo);
 * lo mismo para las aristas.
 */
function buildMeshGeometry(mesh: E3dMesh): MeshGeometry {
  const { stride, vertexArray } = mesh;
  if (!mesh.hasPoints || stride === 0) return { faces: null, edges: null };

  const vertexCount = Math.floor(vertexArray.length / stride);
  const positions = new Float32Array(vertexCount * 3);
  const normals = mesh.hasNormals ? new Float32Array(vertexCount * 3) : null;
  const uvs = mesh.hasTexCoords ? new Float32Array(vertexCount * 2) : null;
  const uvOffset = mesh.hasNormals ? 6 : 3;

  for (let i = 0; i < vertexCount; i++) {
    const base = i * stride;
    positions[i * 3] = vertexArray[base];
    positions[i * 3 + 1] = vertexArray[base + 1];
    positions[i * 3 + 2] = vertexArray[base + 2];
    if (normals) {
      normals[i * 3] = vertexArray[base + 3];
      normals[i * 3 + 1] = vertexArray[base + 4];
      normals[i * 3 + 2] = vertexArray[base + 5];
    }
    if (uvs) {
      uvs[i * 2] = vertexArray[base + uvOffset];
      // El formato guarda V invertida respecto a three.js.
      uvs[i * 2 + 1] = 1 - vertexArray[base + uvOffset + 1];
    }
  }

  const makeGeometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    if (normals) g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    if (uvs) g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    return g;
  };

  let faces: THREE.BufferGeometry | null = null;
  if (mesh.faces.length > 0) {
    const allIndices: number[] = [];
    const groups: { start: number; count: number; materialIndex: number }[] = [];
    mesh.faces.forEach((face, materialIndex) => {
      const tri = toTriangleIndices(face.elements);
      if (tri.length === 0) return;
      groups.push({ start: allIndices.length, count: tri.length, materialIndex });
      for (const idx of tri) allIndices.push(idx);
    });
    if (allIndices.length > 0) {
      faces = makeGeometry();
      faces.setIndex(allIndices);
      groups.forEach((g) => faces!.addGroup(g.start, g.count, g.materialIndex));
    }
  }

  let edges: THREE.BufferGeometry | null = null;
  if (mesh.edges.length > 0) {
    const allIndices: number[] = [];
    const groups: { start: number; count: number; materialIndex: number }[] = [];
    mesh.edges.forEach((edge, materialIndex) => {
      const seg = toLineSegmentIndices(edge.elements);
      if (seg.length === 0) return;
      groups.push({ start: allIndices.length, count: seg.length, materialIndex });
      for (const idx of seg) allIndices.push(idx);
    });
    if (allIndices.length > 0) {
      edges = makeGeometry();
      edges.setIndex(allIndices);
      groups.forEach((g) => edges!.addGroup(g.start, g.count, g.materialIndex));
    }
  }

  return { faces, edges };
}

/** Convierte cualquier modo de triángulos a lista plana de triángulos. */
function toTriangleIndices(elements: E3dElements): number[] {
  const idx = elements.indices;
  const n = idx.length;
  const out: number[] = [];
  switch (elements.mode) {
    case "triangles":
      for (let i = 0; i + 2 < n; i += 3) out.push(idx[i], idx[i + 1], idx[i + 2]);
      break;
    case "triangleStrip":
      for (let i = 2; i < n; i++) {
        if (i % 2 === 0) out.push(idx[i - 2], idx[i - 1], idx[i]);
        else out.push(idx[i - 1], idx[i - 2], idx[i]);
      }
      break;
    case "triangleFan":
      for (let i = 2; i < n; i++) out.push(idx[0], idx[i - 1], idx[i]);
      break;
    default:
      break;
  }
  return out;
}

/** Convierte cualquier modo de líneas a pares de segmentos. */
function toLineSegmentIndices(elements: E3dElements): number[] {
  const idx = elements.indices;
  const n = idx.length;
  const out: number[] = [];
  switch (elements.mode) {
    case "lines":
      for (let i = 0; i + 1 < n; i += 2) out.push(idx[i], idx[i + 1]);
      break;
    case "lineStrip":
      for (let i = 1; i < n; i++) out.push(idx[i - 1], idx[i]);
      break;
    case "lineLoop":
      for (let i = 1; i < n; i++) out.push(idx[i - 1], idx[i]);
      if (n > 2) out.push(idx[n - 1], idx[0]);
      break;
    default:
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
      // Sin normales en el fichero, el sombreado plano evita artefactos.
      flatShading: !hasNormals,
      transparent: opacity < 1,
      opacity,
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
  const pad = 4; // margen en px para que el antialiasing no se recorte
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const font = `${fontPx}px sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(line.text);
  // Caja de tinta real del texto respecto al origen de escritura (pen) y a la
  // línea base; los fallbacks cubren entornos sin actualBoundingBox*.
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

  // La justificación se ancla a la caja de maquetación del texto (avance × em),
  // no al canvas (que lleva relleno y trazos que sobresalen del avance).
  const em = 0.75 * line.height; // tamaño de fuente en unidades del modelo
  const unitsPerPx = em / fontPx;
  const boxWidth = metrics.width * unitsPerPx;

  // Fracción del em que queda bajo la línea base (descenso de la fuente).
  const fontAscent = metrics.fontBoundingBoxAscent ?? fontPx * 0.8;
  const fontDescent = metrics.fontBoundingBoxDescent ?? fontPx * 0.2;
  const descentFraction = fontDescent / Math.max(1, fontAscent + fontDescent);

  // Posición del origen de escritura (pen) para que la caja quede anclada en
  // el origen local según el código de justificación: x en {0,-1/2,-1}·ancho,
  // y en {0,-1/2,-1}·em, con la caja em apoyada en el descenso de la fuente.
  const penX = line.justification[0] * boxWidth;
  const penY = (line.justification[1] + descentFraction) * em;

  const width = canvas.width * unitsPerPx;
  const height = canvas.height * unitsPerPx;
  const geometry = new THREE.PlaneGeometry(width, height);
  // El plano de three.js está centrado; se lleva su centro a la posición del
  // centro del canvas respecto al pen, y de ahí al punto de anclaje.
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
