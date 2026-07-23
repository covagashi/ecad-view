import type { Dispatch } from "react";
import { findDeviceByDesignation } from "./bridge";
import type { Action, ProjectDoc, ProjectView } from "./types";

/*
 * Enlaces profundos / estado de vista compartible.
 *
 * El estado se codifica en el *hash* de la URL (no en la query) para no afectar
 * al service worker de la PWA ni al alojamiento estático. Formato legible:
 *
 *   #p=<proyecto>&v=<vista>&pg=<pagina>&dev=<dispositivo>
 *   #p=<proyecto>&v=3d&part=<objectId>
 *
 * Los ficheros nunca salen del dispositivo: el hash solo lleva el *nombre* del
 * proyecto, de la página y la etiqueta del dispositivo; el receptor abre su
 * propia copia del .epdz y la aplicación reconstruye la vista. Los hashes no se
 * envían a los servidores, así que el enlace no filtra el contenido del proyecto.
 */

/** Nombres de vista en la URL (legibles) frente a los internos. */
const VIEW_TO_URL: Record<ProjectView, string> = {
  "3d": "3d",
  pages: "schematic",
  project: "info",
  data: "data",
};
const URL_TO_VIEW: Record<string, ProjectView> = {
  "3d": "3d",
  schematic: "pages",
  info: "project",
  data: "data",
};

/** Objetivo decodificado de un enlace profundo. */
export interface DeepLinkTarget {
  /** Identidad del proyecto (nombre del manifest o del fichero). */
  project: string;
  view: ProjectView | null;
  /** Nombre de la página (v. LoadedPage.name). */
  page: string | null;
  /** Etiqueta/designación del dispositivo resaltado. */
  device: string | null;
  /** objectId de la pieza 3D seleccionada. */
  part: number | null;
}

/** Identidad estable del proyecto para el parámetro `p`. */
export function projectIdentity(doc: ProjectDoc): string {
  const name = doc.manifest?.projectName?.trim();
  if (name) return name;
  return doc.fileName.replace(/\.[^.]+$/, "");
}

/**
 * ¿Corresponde el documento al `p=` del enlace? Se acepta el nombre del
 * proyecto del manifest o el nombre del fichero (con o sin extensión), sin
 * distinguir mayúsculas, para tolerar renombrados entre máquinas.
 */
export function docMatchesProject(doc: ProjectDoc, project: string): boolean {
  const wanted = project.trim().toLowerCase();
  const candidates = [
    doc.manifest?.projectName ?? undefined,
    doc.fileName,
    doc.fileName.replace(/\.[^.]+$/, ""),
  ];
  return candidates.some((c) => c != null && c.trim().toLowerCase() === wanted);
}

/** Dispositivo actualmente resaltado en la vista de esquemas, si lo hay. */
function highlightedDeviceLabel(doc: ProjectDoc): string | null {
  const elementId = doc.highlight?.elementId;
  if (!elementId) return null;
  const device = doc.deviceIndex.byElement.get(`${doc.pageIndex}|${elementId}`);
  return device?.label ?? null;
}

/** Construye el hash que refleja el estado de vista actual del documento. */
export function buildHashForDoc(doc: ProjectDoc): string {
  const parts: string[] = [`p=${enc(projectIdentity(doc))}`, `v=${VIEW_TO_URL[doc.view]}`];
  if (doc.view === "pages") {
    const page = doc.pages[doc.pageIndex];
    if (page) parts.push(`pg=${enc(page.name)}`);
    const device = highlightedDeviceLabel(doc);
    if (device) parts.push(`dev=${enc(device)}`);
  } else if (doc.view === "3d" && doc.picked?.objectId !== undefined) {
    parts.push(`part=${doc.picked.objectId}`);
  }
  return `#${parts.join("&")}`;
}

/** Decodifica un hash de enlace profundo; null si no hay proyecto en él. */
export function parseHash(hash: string): DeepLinkTarget | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const project = params.get("p");
  if (!project) return null;
  const viewRaw = params.get("v");
  const partRaw = params.get("part");
  return {
    project,
    view: viewRaw ? URL_TO_VIEW[viewRaw] ?? null : null,
    page: params.get("pg"),
    device: params.get("dev"),
    part: partRaw && /^\d+$/.test(partRaw) ? Number(partRaw) : null,
  };
}

/**
 * URL compartible a partir de un hash. En web usa el origen actual; en las
 * envolturas Tauri/Capacitor (origen no http) recae en https://view.covaga.dev/.
 */
export function shareUrl(hash: string): string {
  const loc = window.location;
  const base =
    loc.protocol === "http:" || loc.protocol === "https:"
      ? `${loc.origin}${loc.pathname}`
      : "https://view.covaga.dev/";
  return `${base}${hash}`;
}

/**
 * Aplica el objetivo del enlace a un documento ya cargado, reutilizando la
 * navegación existente (NAVIGATE/SET_PAGE/SET_VIEW). Para las piezas 3D deja
 * el objectId pendiente: lo consume el visor 3D cuando la escena está lista.
 */
export function applyTargetToDoc(
  doc: ProjectDoc,
  target: DeepLinkTarget,
  dispatch: Dispatch<Action>,
  nextNonce: () => number
): void {
  const pageIndex =
    target.page != null
      ? doc.pages.findIndex(
          (p) => p.name === target.page || p.name.toLowerCase() === target.page!.toLowerCase()
        )
      : -1;

  // Dispositivo resaltado: se prefiere su aparición en la página del enlace.
  if (target.device) {
    const device = findDeviceByDesignation(doc.deviceIndex, target.device);
    if (device && device.occurrences.length > 0) {
      const occ =
        (pageIndex >= 0 && device.occurrences.find((o) => o.pageIndex === pageIndex)) ||
        device.occurrences[0];
      dispatch({
        type: "NAVIGATE",
        id: doc.id,
        pageIndex: occ.pageIndex,
        highlight: { elementId: occ.elementId, nonce: nextNonce() },
        xrefInfo: `${device.label} · ${device.occurrences.indexOf(occ) + 1}/${device.occurrences.length}`,
      });
      return; // NAVIGATE ya fija la vista de esquemas.
    }
  }

  // Página sin dispositivo.
  if (pageIndex >= 0) {
    dispatch({ type: "SET_PAGE", id: doc.id, pageIndex });
    dispatch({ type: "SET_VIEW", id: doc.id, view: "pages" });
    return;
  }

  // Solo vista (3d / info), con posible pieza 3D.
  if (target.view) dispatch({ type: "SET_VIEW", id: doc.id, view: target.view });
  if (target.view === "3d" && target.part != null) stashPendingPick(doc.id, target.part);
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

// --- Pieza 3D pendiente de seleccionar -------------------------------------
// El visor 3D vive en otro componente y necesita su escena montada para poder
// seleccionar por objectId; el enlace deja aquí el objetivo y el visor lo toma.

let pendingPick: { docId: string; objectId: number } | null = null;

export function stashPendingPick(docId: string, objectId: number): void {
  pendingPick = { docId, objectId };
}

/** Devuelve (y consume) el objectId pendiente para ese documento, si lo hay. */
export function consumePendingPick(docId: string): number | null {
  if (pendingPick && pendingPick.docId === docId) {
    const { objectId } = pendingPick;
    pendingPick = null;
    return objectId;
  }
  return null;
}
