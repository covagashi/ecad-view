/*
 * Parser del export AutomationML (CAEX) que EPLAN incluye en los .epdz
 * (packages/automationML/<proyecto>.aml). El fichero puede superar los 30 MB,
 * así que no se usa DOMParser (no existe en workers y duplicaría la memoria):
 * un escáner lineal de etiquetas extrae solo lo que interesa al visor:
 *
 *  - la jerarquía de InternalElement (espacios de montaje → componentes),
 *  - clasificación eCl@ss de cada componente (código + etiqueta legible),
 *  - posición exacta (Frame: x/y/z + rotaciones) y diámetro de taladros,
 *  - roles ProPanel (superficies de montaje, taladros, zonas restringidas),
 *  - textos multiidioma (descripción del proyecto, textos de función),
 *  - interfaces de comunicación (PhysicalEndPoint, PLCopenXML...),
 *  - grupos de puentes de bornes (Plug-in bridge / Saddle jumper) con los
 *    object ids que los cruzan con las conexiones del manifest.db.
 */

/** Texto multiidioma: valor por código de idioma ("es-ES"...); "" = idioma del export. */
export type AmlMultiText = Record<string, string>;

/** Posición de un elemento: [x, y, z, rx, ry, rz] (mm y grados). */
export type AmlFrame = [number, number, number, number, number, number];

export interface AmlElement {
  /** ID CAEX (GUID). */
  id: string;
  /** Nombre del elemento; en componentes es la designación ("+A1-XD2*2"). */
  name: string;
  /** Índice del padre en `elements`; -1 en la raíz. */
  parent: number;
  /** Profundidad en el árbol (0 = proyecto). */
  depth: number;
  /** Código eCl@ss ("27250101") si el elemento está clasificado. */
  classCode: string | null;
  /** Etiqueta legible de la clase eCl@ss ("27-25-01-01 Feed-through terminal block"). */
  classLabel: string | null;
  /** Rol ProPanel ("Drill hole", "Mounting surface", "Restricted placing area"...). */
  proPanelRole: string | null;
  /** Número de artículo (Part number), p. ej. "PXC.3211813". */
  partNumber: string | null;
  /** Object identification EPLAN ("253/180/49623/0"). */
  objectId: string | null;
  frame: AmlFrame | null;
  /** Diámetro (mm) en taladros. */
  diameter: number | null;
  /** Nombre de espacio de montaje (Layout space name) si el elemento lo es. */
  layoutSpace: string | null;
  /** Texto de función (multiidioma) del componente, si lo lleva. */
  functionText: AmlMultiText | null;
  /** Interfaces relevantes (PhysicalEndPoint, LogicInterface...). */
  interfaces: string[];
}

/** Grupo de puentes de bornes: los hijos referencian conexiones por object id. */
export interface AmlBridgeGroup {
  /** Tipo según el nombre del grupo ("Plug-in bridge", "Saddle jumper"...). */
  kind: string;
  /** Object ids ("253/18/64304/0") de las conexiones-puente. */
  objectIds: string[];
}

export interface AmlProject {
  /** Nombre del proyecto (elemento raíz). */
  name: string | null;
  /** Descripción del proyecto, multiidioma. */
  description: AmlMultiText | null;
  /** Idiomas presentes en el export ("de-DE", "en-US"...), ordenados. */
  languages: string[];
  elements: AmlElement[];
  bridgeGroups: AmlBridgeGroup[];
}

/** Interfaces que interesan al visor (el resto, p. ej. DrillPattern, se ignora). */
const INTERFACE_KEEP = new Set([
  "PhysicalEndPoint",
  "LogicInterface",
  "VariableInterface",
  "Communication",
  "PortConnector",
]);

/** Atributos cuyo valor multiidioma se conserva. */
const TEXT_ATTRS = new Set(["Function text (of main function)", "Project description"]);

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(value: string): string {
  if (value.indexOf("&") === -1) return value;
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return ENTITY_MAP[body] ?? match;
  });
}

/** Valor de un atributo XML dentro del texto de una etiqueta ya recortada. */
function tagAttr(tag: string, name: string): string | null {
  const marker = `${name}="`;
  const start = tag.indexOf(marker);
  if (start === -1) return null;
  const from = start + marker.length;
  const end = tag.indexOf('"', from);
  return end === -1 ? null : decodeXml(tag.slice(from, end));
}

/** Último segmento legible de una ruta de clase eCl@ss: "[27-25-01-01 Feed-through…]". */
function eclassLeaf(path: string): string | null {
  const end = path.lastIndexOf("]");
  if (end === -1) return null;
  const start = path.lastIndexOf("[", end);
  return start === -1 ? null : path.slice(start + 1, end);
}

/**
 * Parsea el XML AutomationML. Un único recorrido por el texto; coste O(n) y
 * memoria proporcional a lo extraído (no al fichero).
 */
export function parseAml(xml: string): AmlProject {
  const elements: AmlElement[] = [];
  const bridgeGroups: AmlBridgeGroup[] = [];
  const languages = new Set<string>();

  /** Pila de índices de InternalElement abiertos (-1 = fuera del árbol). */
  const stack: number[] = [];
  /**
   * Pila de atributos abiertos. Cada entrada guarda el nombre y, si es un
   * atributo capturable, dónde escribir su valor.
   */
  const attrStack: { name: string; capture: boolean }[] = [];
  let projectName: string | null = null;
  let projectDescription: AmlMultiText | null = null;
  /** Texto multiidioma en construcción para el atributo capturado más cercano. */
  let pendingText: AmlMultiText | null = null;
  let pendingTextOwner: AmlElement | "project" | null = null;

  const current = (): AmlElement | null =>
    stack.length > 0 ? elements[stack[stack.length - 1]] : null;

  /** ¿A qué idioma va el próximo <Value>? "" = valor base del atributo. */
  const valueLang = (): string | null => {
    if (attrStack.length === 0) return null;
    const top = attrStack[attrStack.length - 1];
    if (top.capture) return "";
    if (top.name.startsWith("aml-lang=") && attrStack.length > 1) {
      const parent = attrStack[attrStack.length - 2];
      if (parent.capture) return top.name.slice("aml-lang=".length);
    }
    return null;
  };

  /** Asigna un <Value> numérico o de texto según el contexto de atributos. */
  const assignValue = (raw: string) => {
    const element = current();
    // Texto multiidioma (Function text / Project description).
    const lang = valueLang();
    if (lang !== null && pendingText) {
      if (lang) languages.add(lang);
      pendingText[lang] = raw;
      return;
    }
    if (attrStack.length === 0) return;
    const attr = attrStack[attrStack.length - 1].name;

    // Frame anidado: x/y/z/rx/ry/rz dentro de <Attribute Name="Frame">.
    if (
      element &&
      attrStack.length >= 2 &&
      attrStack[attrStack.length - 2].name === "Frame"
    ) {
      const axis = ["x", "y", "z", "rx", "ry", "rz"].indexOf(attr);
      if (axis >= 0) {
        if (!element.frame) element.frame = [0, 0, 0, 0, 0, 0];
        element.frame[axis] = Number(raw) || 0;
      }
      return;
    }
    if (!element || attrStack.length !== 1) return;
    switch (attr) {
      case "ClassificationClass":
        element.classCode = raw;
        break;
      case "Part number":
        if (!element.partNumber) element.partNumber = raw;
        break;
      case "Object identification":
        element.objectId = raw;
        break;
      case "Diameter":
        element.diameter = Number(raw) || null;
        break;
      case "Layout space name":
        element.layoutSpace = raw;
        break;
    }
  };

  let pos = 0;
  const length = xml.length;
  while (pos < length) {
    const lt = xml.indexOf("<", pos);
    if (lt === -1) break;
    const gt = xml.indexOf(">", lt + 1);
    if (gt === -1) break;
    const tag = xml.slice(lt + 1, gt);
    pos = gt + 1;

    // Comentarios / CDATA / declaraciones: se saltan sin interpretar.
    if (tag.startsWith("?") || tag.startsWith("!")) continue;

    const closing = tag.startsWith("/");
    const selfClosed = tag.endsWith("/");
    // Nombre de la etiqueta hasta el primer espacio.
    const nameEnd = tag.indexOf(" ");
    const tagName = closing
      ? tag.slice(1)
      : nameEnd === -1
        ? selfClosed
          ? tag.slice(0, -1)
          : tag
        : tag.slice(0, nameEnd);

    switch (tagName) {
      case "InternalElement": {
        if (closing) {
          stack.pop();
          break;
        }
        const element: AmlElement = {
          id: tagAttr(tag, "ID") ?? "",
          name: tagAttr(tag, "Name") ?? "",
          parent: stack.length > 0 ? stack[stack.length - 1] : -1,
          depth: stack.length,
          classCode: null,
          classLabel: null,
          proPanelRole: null,
          partNumber: null,
          objectId: null,
          frame: null,
          diameter: null,
          layoutSpace: null,
          functionText: null,
          interfaces: [],
        };
        if (element.depth === 0 && projectName === null) projectName = element.name;
        elements.push(element);
        if (!selfClosed) stack.push(elements.length - 1);
        break;
      }
      case "Attribute": {
        if (closing) {
          const top = attrStack.pop();
          // Al cerrar el atributo capturado se consolida el texto multiidioma.
          if (top?.capture && pendingText && pendingTextOwner) {
            if (pendingTextOwner === "project") {
              if (top.name === "Project description") projectDescription = pendingText;
            } else if (top.name === "Function text (of main function)") {
              pendingTextOwner.functionText = pendingText;
            }
            pendingText = null;
            pendingTextOwner = null;
          }
          break;
        }
        const attrName = tagAttr(tag, "Name") ?? "";
        const capture = TEXT_ATTRS.has(attrName) && attrStack.length === 0;
        if (!selfClosed) {
          attrStack.push({ name: attrName, capture });
          if (capture) {
            pendingText = {};
            // "Project description" cuelga del elemento raíz (depth 0).
            pendingTextOwner = attrName === "Project description" ? "project" : current();
          }
        }
        break;
      }
      case "Value": {
        if (closing) break;
        const end = xml.indexOf("</Value>", pos);
        if (end === -1) break;
        assignValue(decodeXml(xml.slice(pos, end)));
        pos = end + "</Value>".length;
        break;
      }
      case "ExternalInterface": {
        if (closing) break;
        const element = current();
        const interfaceName = tagAttr(tag, "Name");
        if (element && interfaceName && INTERFACE_KEEP.has(interfaceName)) {
          element.interfaces.push(interfaceName);
        }
        break;
      }
      case "SupportedRoleClass":
      case "RoleRequirements": {
        if (closing) break;
        const element = current();
        if (!element) break;
        const path =
          tagAttr(tag, "RefRoleClassPath") ?? tagAttr(tag, "RefBaseRoleClassPath") ?? "";
        if (path.includes("EPLANProPanelRoleClassLib")) {
          element.proPanelRole = path.slice(path.lastIndexOf("/") + 1) || null;
        } else if (path.includes("EclassRoleClassLib") && !element.classLabel) {
          element.classLabel = eclassLeaf(path);
        }
        break;
      }
    }
  }

  // Grupos de puentes: elementos de primer nivel sin espacio de montaje cuyos
  // hijos se llaman por object id ("253/18/64304/0") — así los exporta EPLAN.
  for (let i = 0; i < elements.length; i++) {
    const group = elements[i];
    if (group.depth !== 1 || group.layoutSpace) continue;
    const objectIds: string[] = [];
    for (let j = i + 1; j < elements.length && elements[j].depth > 1; j++) {
      const child = elements[j];
      if (child.parent === i && /^\d+(\/\d+)+$/.test(child.name)) objectIds.push(child.name);
    }
    if (objectIds.length > 0) bridgeGroups.push({ kind: group.name, objectIds });
  }

  return {
    name: projectName,
    description: projectDescription,
    languages: [...languages].sort(),
    elements,
    bridgeGroups,
  };
}
