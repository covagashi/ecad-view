import type { AmlElement, AmlMultiText, AmlProject } from "@covaga/e3d-core/aml";
import type { EplanManifest } from "@covaga/e3d-core/manifest";

/*
 * Derivaciones de datos para la vista "Datos": transforman el AmlProject y el
 * manifest.db en las estructuras que pintan las tablas y diagramas (BOM por
 * eCl@ss, mecanizado del armario, posiciones, regletas de bornes con puentes,
 * dispositivos de red/PLC y validación de puntos de interrupción).
 */

/** Valor de un texto multiidioma en el idioma elegido ("" = idioma del export). */
export function pickText(text: AmlMultiText | null | undefined, lang: string): string | null {
  if (!text) return null;
  return (lang && text[lang]) || text[""] || null;
}

/** Designación base de un elemento AML: sin sufijo de variante "*N". */
export function baseDesignation(name: string): string {
  return name.replace(/\*\d+$/, "");
}

// ---------- BOM por clase eCl@ss ----------

export interface EclassArticle {
  /** Número de artículo ("PXC.3211813") o null para piezas sin referencia. */
  partNumber: string | null;
  quantity: number;
  /** Designaciones (sin duplicados) que usan el artículo. */
  devices: string[];
  /** Texto de función de una de las apariciones (multiidioma). */
  text: AmlMultiText | null;
}

export interface EclassGroup {
  /** Código eCl@ss ("27250101"). */
  code: string;
  /** Etiqueta legible ("27-25-01-01 Feed-through terminal block"). */
  label: string;
  total: number;
  articles: EclassArticle[];
}

/** BOM agrupado por clase eCl@ss a partir de los elementos clasificados del AML. */
export function buildEclassBom(aml: AmlProject): EclassGroup[] {
  const groups = new Map<string, Map<string, EclassArticle>>();
  const labels = new Map<string, string>();

  for (const element of aml.elements) {
    if (!element.classCode) continue;
    if (element.classLabel && !labels.has(element.classCode)) {
      labels.set(element.classCode, element.classLabel);
    }
    const byArticle = groups.get(element.classCode) ?? new Map<string, EclassArticle>();
    if (byArticle.size === 0) groups.set(element.classCode, byArticle);
    const key = element.partNumber ?? "";
    let article = byArticle.get(key);
    if (!article) {
      article = { partNumber: element.partNumber, quantity: 0, devices: [], text: null };
      byArticle.set(key, article);
    }
    article.quantity += 1;
    if (!article.text && element.functionText) article.text = element.functionText;
    const designation = baseDesignation(element.name);
    if (designation && !article.devices.includes(designation)) {
      article.devices.push(designation);
    }
  }

  const result: EclassGroup[] = [...groups.entries()].map(([code, byArticle]) => {
    const articles = [...byArticle.values()].sort((a, b) => b.quantity - a.quantity);
    return {
      code,
      label: labels.get(code) ?? code,
      total: articles.reduce((sum, a) => sum + a.quantity, 0),
      articles,
    };
  });
  result.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  return result;
}

// ---------- Posiciones absolutas ----------

/**
 * Posición absoluta (x, y, z) de un elemento componiendo los Frames de la
 * cadena de ancestros. Solo se aplica la rotación rz (2D) de cada ancestro;
 * las rotaciones rx/ry (poco habituales en montaje de armario) se ignoran.
 */
export function absolutePosition(aml: AmlProject, index: number): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  let element: AmlElement | undefined = aml.elements[index];
  while (element) {
    const frame = element.frame;
    if (frame) {
      const [fx, fy, fz, , , rz] = frame;
      if (rz) {
        const rad = (rz * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatedX = fx + x * cos - y * sin;
        const rotatedY = fy + x * sin + y * cos;
        x = rotatedX;
        y = rotatedY;
      } else {
        x += fx;
        y += fy;
      }
      z += fz;
    }
    element = element.parent >= 0 ? aml.elements[element.parent] : undefined;
  }
  return [x, y, z];
}

/** Espacio de montaje (elemento de primer nivel) al que pertenece un elemento. */
export function elementSpace(aml: AmlProject, index: number): string | null {
  let element: AmlElement | undefined = aml.elements[index];
  while (element && element.depth > 1) {
    element = element.parent >= 0 ? aml.elements[element.parent] : undefined;
  }
  return element && element.depth === 1 ? element.name : null;
}

export interface PositionRow {
  designation: string;
  classLabel: string | null;
  partNumber: string | null;
  space: string | null;
  x: number;
  y: number;
  z: number;
  text: AmlMultiText | null;
}

/**
 * Tabla de posiciones: un componente clasificado por designación (la aparición
 * menos profunda: el artículo principal, no sus subpiezas).
 */
export function buildPositions(aml: AmlProject): PositionRow[] {
  const byDesignation = new Map<string, { index: number; element: AmlElement }>();
  aml.elements.forEach((element, index) => {
    if (!element.classCode || !element.frame) return;
    const designation = baseDesignation(element.name);
    if (!designation || /^\d+(\/\d+)+$/.test(designation)) return;
    const existing = byDesignation.get(designation);
    if (!existing || element.depth < existing.element.depth) {
      byDesignation.set(designation, { index, element });
    }
  });

  const rows: PositionRow[] = [...byDesignation.entries()].map(([designation, entry]) => {
    const [x, y, z] = absolutePosition(aml, entry.index);
    return {
      designation,
      classLabel: entry.element.classLabel,
      partNumber: entry.element.partNumber,
      space: elementSpace(aml, entry.index),
      x,
      y,
      z,
      text: entry.element.functionText,
    };
  });
  rows.sort((a, b) => a.designation.localeCompare(b.designation, undefined, { numeric: true }));
  return rows;
}

// ---------- Mecanizado del armario (ProPanel) ----------

export interface PanelHole {
  x: number;
  y: number;
  /** Diámetro en mm (0 si el AML no lo trae). */
  d: number;
  threaded: boolean;
  /** Designación de la pieza a la que pertenece el taladro. */
  owner: string | null;
}

export interface PanelSurface {
  /** Designación de la superficie ("S1:Frontal de placa de montaje"). */
  label: string;
  /** Espacio de montaje al que pertenece ("A1"). */
  space: string | null;
  /** Medidas reales de la superficie (mm), tal cual vienen del AML. */
  width: number;
  height: number;
  /** Taladros en coordenadas de la propia superficie (origen abajo-izquierda). */
  holes: PanelHole[];
}

/**
 * Superficies de montaje mecanizadas (ProPanel), con sus taladros en
 * coordenadas de cada superficie.
 *
 * El AML da de cada superficie su rectángulo real (origen y tamaño) y cuelga de
 * ella los taladros que lleva. La posición del taladro se acumula por el camino
 * de frames que va de la superficie al taladro, es decir en el sistema de la
 * propia superficie: una placa vertical lleva rx=90 en su frame, así que pasar
 * por coordenadas absolutas aplastaría todos sus taladros en una línea.
 */
export function buildMountingSurfaces(aml: AmlProject): PanelSurface[] {
  const parent = (index: number): number => aml.elements[index]?.parent ?? -1;

  /** Superficie de montaje más cercana hacia la raíz. */
  const ownerSurface = (index: number): number => {
    for (let i = parent(index); i >= 0; i = parent(i)) {
      if (aml.elements[i].proPanelRole === "Mounting surface" && aml.elements[i].surface) return i;
    }
    return -1;
  };

  /** Pieza propietaria del taladro: primer ancestro con artículo o clase. */
  const ownerPart = (index: number): string | null => {
    for (let i = parent(index); i >= 0; i = parent(i)) {
      const element = aml.elements[i];
      if (element.partNumber || element.classCode) return baseDesignation(element.name);
    }
    return null;
  };

  /** Posición del elemento en el sistema de coordenadas de `ancestor`. */
  const positionWithin = (index: number, ancestor: number): [number, number] => {
    let x = 0;
    let y = 0;
    for (let i = index; i >= 0 && i !== ancestor; i = parent(i)) {
      const frame = aml.elements[i].frame;
      if (!frame) continue;
      const [fx, fy, , , , rz] = frame;
      if (rz) {
        const rad = (rz * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatedX = fx + x * cos - y * sin;
        const rotatedY = fy + x * sin + y * cos;
        x = rotatedX;
        y = rotatedY;
      } else {
        x += fx;
        y += fy;
      }
    }
    return [x, y];
  };

  const holesBySurface = new Map<number, PanelHole[]>();
  aml.elements.forEach((element, index) => {
    const role = element.proPanelRole;
    if (role !== "Drill hole" && role !== "Threaded hole") return;
    const surfaceIndex = ownerSurface(index);
    if (surfaceIndex < 0) return;
    const surface = aml.elements[surfaceIndex].surface!;
    const [x, y] = positionWithin(index, surfaceIndex);
    const list = holesBySurface.get(surfaceIndex) ?? [];
    if (list.length === 0) holesBySurface.set(surfaceIndex, list);
    list.push({
      x: x - surface.start[0],
      y: y - surface.start[1],
      d: element.diameter ?? 0,
      threaded: role === "Threaded hole",
      owner: ownerPart(index),
    });
  });

  const surfaces: PanelSurface[] = [];
  for (const [index, holes] of holesBySurface) {
    const element = aml.elements[index];
    const surface = element.surface!;
    surfaces.push({
      label: element.itemDesignation || element.name,
      space: elementSpace(aml, index),
      width: surface.size[0],
      height: surface.size[1],
      holes,
    });
  }
  return surfaces.sort(
    (a, b) => b.holes.length - a.holes.length || a.label.localeCompare(b.label)
  );
}

// ---------- Conexiones de cableado ----------

/** Conexión de la lista de cableado, con su cable 3D si está enrutado. */
export interface ConnectionRow {
  /** Origen "+A1-XD1:1" y destino "+A1-XD1:4". */
  source: string;
  target: string;
  potential: string | null;
  color: string | null;
  crossSection: string | null;
  length: string | null;
  partType: string | null;
  /** Tipo de puente ("Plug-in bridge"...) si la conexión es un puente de bornes. */
  bridge: string | null;
  /** packageId de la página del esquema donde vive el tramo (referencia cruzada). */
  pageId: number | null;
  /** Id SVG del tramo dentro de esa página, para resaltarlo al saltar. */
  elementId: string | null;
  /** Clave "{typeId}_{objectId}" de la pieza 3D del cable (índice de cajas). */
  partKey: string | null;
  /** objectId numérico de la pieza del cable, para seleccionarla en el visor. */
  objectId: number | null;
}

const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * Lista de conexiones de cableado (estilo Smart Wiring) a partir de las
 * mergedconnections del manifest. El sufijo del nombre da la pieza 3D del
 * cable enrutado; los grupos de puentes del AML marcan qué conexiones son
 * puentes de bornes en lugar de hilos.
 */
export function buildConnections(
  manifest: EplanManifest | null,
  aml: AmlProject | null
): ConnectionRow[] {
  if (!manifest) return [];

  // Object id EPLAN -> tipo de puente, según los grupos del AML.
  const bridgeByOid = new Map<string, string>();
  for (const group of aml?.bridgeGroups ?? []) {
    for (const oid of group.objectIds) bridgeByOid.set(oid, group.kind);
  }

  const rows: ConnectionRow[] = [];
  for (const connection of manifest.connections) {
    if (!connection.source && !connection.target) continue;
    // "166/60618" -> typeId 166, objectId 60618: la pieza del cable en el E3D.
    const match = connection.wire3d ? /^(\d+)\/(\d+)$/.exec(connection.wire3d) : null;
    rows.push({
      source: connection.source ?? "?",
      target: connection.target ?? "?",
      potential: connection.potential,
      color: connection.color,
      crossSection: connection.crossSection,
      length: connection.length,
      partType: connection.partType,
      bridge:
        connection.connectionOids
          .map((oid) => bridgeByOid.get(oid))
          .find((kind) => kind !== undefined) ?? null,
      pageId: connection.packageId,
      elementId: connection.svgElementId,
      partKey: match ? `${match[1]}_${match[2]}` : null,
      objectId: match ? Number(match[2]) : null,
    });
  }

  rows.sort(
    (a, b) => naturalCompare(a.source, b.source) || naturalCompare(a.target, b.target)
  );
  return rows;
}

// ---------- Red / PLC ----------

export interface NetworkRow {
  designation: string;
  classLabel: string | null;
  partNumber: string | null;
  space: string | null;
  interfaces: string[];
}

/** Dispositivos PLC (eCl@ss 27-24) y elementos con interfaces de comunicación. */
export function buildNetwork(aml: AmlProject): NetworkRow[] {
  const byDesignation = new Map<string, NetworkRow>();
  aml.elements.forEach((element, index) => {
    const isPlc = element.classCode?.startsWith("2724") ?? false;
    const hasInterfaces = element.interfaces.length > 0;
    if (!isPlc && !hasInterfaces) return;
    const designation = baseDesignation(element.name);
    // Los endpoints de los puentes de bornes se llaman por object id: fuera.
    if (!designation || /^\d+(\/\d+)+$/.test(designation)) return;
    let row = byDesignation.get(designation);
    if (!row) {
      row = {
        designation,
        classLabel: element.classLabel,
        partNumber: element.partNumber,
        space: elementSpace(aml, index),
        interfaces: [],
      };
      byDesignation.set(designation, row);
    }
    if (!row.classLabel && element.classLabel) row.classLabel = element.classLabel;
    if (!row.partNumber && element.partNumber) row.partNumber = element.partNumber;
    for (const name of element.interfaces) {
      if (!row.interfaces.includes(name)) row.interfaces.push(name);
    }
  });
  return [...byDesignation.values()].sort((a, b) => naturalCompare(a.designation, b.designation));
}

// ---------- Puntos de interrupción ----------

/** Referencia cruzada única de una señal, con el punto al que saltar. */
export interface InterruptionRef {
  /** Texto de la referencia (ep.19007), p. ej. "=GB1+A1&EFS1/ 1.9". */
  xref: string;
  /** packageId de la página del punto que lleva esta referencia. */
  pageId: number | null;
  /** Id del elemento SVG ("Id70_1887") para resaltarlo. */
  elementId: string | null;
}

export interface InterruptionGroup {
  designation: string;
  /** Referencias cruzadas únicas de la señal (deduplicadas por texto). */
  refs: InterruptionRef[];
  /** Con una sola aparición no hay pareja origen/destino. */
  lonely: boolean;
  /** Alguna aparición sin referencia cruzada resuelta (ep.19007 vacío). */
  unresolved: boolean;
}

/**
 * Agrupa los puntos de interrupción por señal, deduplicando por referencia
 * cruzada única (las apariciones repetidas de la misma referencia no aportan),
 * y marca las señales sueltas o sin referencia.
 */
export function buildInterruptionGroups(manifest: EplanManifest | null): InterruptionGroup[] {
  if (!manifest) return [];
  const groups = new Map<string, { group: InterruptionGroup; count: number; seen: Set<string> }>();
  for (const point of manifest.interruptionPoints) {
    const designation = point.designation ?? "?";
    let entry = groups.get(designation);
    if (!entry) {
      entry = {
        group: { designation, refs: [], lonely: false, unresolved: false },
        count: 0,
        seen: new Set(),
      };
      groups.set(designation, entry);
    }
    entry.count += 1;
    if (!point.xref) {
      entry.group.unresolved = true;
    } else if (!entry.seen.has(point.xref)) {
      entry.seen.add(point.xref);
      entry.group.refs.push({
        xref: point.xref,
        pageId: point.pageIds[0] ?? null,
        elementId: point.svgElementId,
      });
    }
  }
  const rows = [...groups.values()].map((entry) => {
    entry.group.lonely = entry.count < 2;
    entry.group.refs.sort((a, b) => naturalCompare(a.xref, b.xref));
    return entry.group;
  });
  rows.sort(
    (a, b) =>
      Number(b.lonely || b.unresolved) - Number(a.lonely || a.unresolved) ||
      naturalCompare(a.designation, b.designation)
  );
  return rows;
}
