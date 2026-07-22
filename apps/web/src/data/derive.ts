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

export interface PanelSpace {
  name: string;
  holes: PanelHole[];
  surfaces: number;
  restricted: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Taladros y superficies por espacio de montaje, en coordenadas absolutas 2D. */
export function buildPanelSpaces(aml: AmlProject): PanelSpace[] {
  const spaces = new Map<string, PanelSpace>();
  const space = (name: string): PanelSpace => {
    let entry = spaces.get(name);
    if (!entry) {
      entry = {
        name,
        holes: [],
        surfaces: 0,
        restricted: 0,
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      };
      spaces.set(name, entry);
    }
    return entry;
  };

  aml.elements.forEach((element, index) => {
    const role = element.proPanelRole;
    if (!role) return;
    const spaceName = elementSpace(aml, index);
    if (!spaceName) return;
    if (role === "Mounting surface") {
      space(spaceName).surfaces += 1;
      return;
    }
    if (role.startsWith("Restricted")) {
      space(spaceName).restricted += 1;
      return;
    }
    if (role !== "Drill hole" && role !== "Threaded hole") return;

    const [x, y] = absolutePosition(aml, index);
    // Pieza propietaria: primer ancestro con designación de componente.
    let owner: string | null = null;
    let ancestor: AmlElement | undefined =
      element.parent >= 0 ? aml.elements[element.parent] : undefined;
    while (ancestor) {
      if (ancestor.partNumber || ancestor.classCode) {
        owner = baseDesignation(ancestor.name);
        break;
      }
      ancestor = ancestor.parent >= 0 ? aml.elements[ancestor.parent] : undefined;
    }
    const entry = space(spaceName);
    entry.holes.push({ x, y, d: element.diameter ?? 0, threaded: role === "Threaded hole", owner });
    entry.minX = Math.min(entry.minX, x);
    entry.maxX = Math.max(entry.maxX, x);
    entry.minY = Math.min(entry.minY, y);
    entry.maxY = Math.max(entry.maxY, y);
  });

  return [...spaces.values()]
    .filter((entry) => entry.holes.length > 0 || entry.surfaces > 0)
    .sort((a, b) => b.holes.length - a.holes.length || a.name.localeCompare(b.name));
}

// ---------- Regletas de bornes con puentes ----------

export interface TerminalBridge {
  /** Tipo de puente ("Plug-in bridge", "Saddle jumper"...). */
  kind: string;
  /** Índices (en points) de los bornes puenteados. */
  from: number;
  to: number;
}

export interface TerminalStrip {
  /** Designación de la regleta ("+A1-XD1"). */
  name: string;
  /** Puntos de borne en orden natural ("1", "2", ... "PE"). */
  points: string[];
  bridges: TerminalBridge[];
  /** packageId de la función de cada punto (para saltar al esquema). */
  functionIds: (number | null)[];
}

const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * Regletas de bornes a partir de las funciones del manifest (designaciones
 * "REGLETA:PUNTO" cuyo aparato es -X...). Los puentes salen de cruzar los
 * grupos de puentes del AML (object ids) con las conexiones del manifest.
 */
export function buildTerminalStrips(
  manifest: EplanManifest | null,
  aml: AmlProject | null
): TerminalStrip[] {
  if (!manifest) return [];

  const strips = new Map<string, Map<string, number | null>>();
  for (const fn of manifest.functions) {
    const designation = fn.designation;
    if (!designation) continue;
    const match = /^(.*-X[^-+=:]*):([^:]+)$/.exec(designation);
    if (!match) continue;
    const strip = strips.get(match[1]) ?? new Map<string, number | null>();
    if (strip.size === 0) strips.set(match[1], strip);
    if (!strip.has(match[2])) strip.set(match[2], fn.packageId);
  }

  const rows: TerminalStrip[] = [...strips.entries()].map(([name, pointsMap]) => {
    const points = [...pointsMap.keys()].sort(naturalCompare);
    return {
      name,
      points,
      bridges: [],
      functionIds: points.map((point) => pointsMap.get(point) ?? null),
    };
  });
  const byName = new Map(rows.map((row) => [row.name, row]));

  // Puentes: object id del AML -> conexión del manifest -> extremos "X:PT".
  if (aml) {
    const byOid = new Map<string, (typeof manifest.connections)[number]>();
    for (const connection of manifest.connections) {
      for (const oid of connection.connectionOids) byOid.set(oid, connection);
    }
    const endpoint = /^(.*):([^:]+)$/;
    for (const group of aml.bridgeGroups) {
      for (const oid of group.objectIds) {
        const connection = byOid.get(oid);
        if (!connection?.source || !connection.target) continue;
        const from = endpoint.exec(connection.source);
        const to = endpoint.exec(connection.target);
        if (!from || !to || from[1] !== to[1]) continue;
        const strip = byName.get(from[1]);
        if (!strip) continue;
        const a = strip.points.indexOf(from[2]);
        const b = strip.points.indexOf(to[2]);
        if (a === -1 || b === -1 || a === b) continue;
        strip.bridges.push({ kind: group.kind, from: Math.min(a, b), to: Math.max(a, b) });
      }
    }
  }

  rows.sort((a, b) => naturalCompare(a.name, b.name));
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

export interface InterruptionOccurrence {
  /** packageId de la página donde aparece. */
  pageId: number | null;
  /** Id del elemento SVG ("Id70_1887") para resaltarlo. */
  elementId: string | null;
  xref: string | null;
}

export interface InterruptionGroup {
  designation: string;
  occurrences: InterruptionOccurrence[];
  /** Un punto con una sola aparición no tiene pareja origen/destino. */
  lonely: boolean;
  /** Alguna aparición sin referencia cruzada resuelta (ep.19007 vacío). */
  unresolved: boolean;
}

/** Agrupa los puntos de interrupción por señal y marca sueltos/sin referencia. */
export function buildInterruptionGroups(manifest: EplanManifest | null): InterruptionGroup[] {
  if (!manifest) return [];
  const groups = new Map<string, InterruptionGroup>();
  for (const point of manifest.interruptionPoints) {
    const designation = point.designation ?? "?";
    let group = groups.get(designation);
    if (!group) {
      group = { designation, occurrences: [], lonely: false, unresolved: false };
      groups.set(designation, group);
    }
    group.occurrences.push({
      pageId: point.pageIds[0] ?? null,
      elementId: point.svgElementId,
      xref: point.xref,
    });
    if (!point.xref) group.unresolved = true;
  }
  const rows = [...groups.values()];
  for (const group of rows) group.lonely = group.occurrences.length < 2;
  rows.sort(
    (a, b) =>
      Number(b.lonely || b.unresolved) - Number(a.lonely || a.unresolved) ||
      naturalCompare(a.designation, b.designation)
  );
  return rows;
}
