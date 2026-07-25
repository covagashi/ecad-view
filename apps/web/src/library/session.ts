import type { AppState, ProjectDoc } from "../state/types";
import { setSession, sourceKey, type SessionState, type SessionTab } from "./db";

/*
 * Guardado de la sesión: solo el último proyecto abierto, que se reabre sin
 * preguntar en el siguiente arranque (ver useSessionRestore).
 */

/**
 * La sesión guardada solo se sobrescribe cuando el usuario ha tocado las
 * pestañas en esta sesión (abrir/cerrar); así un arranque en el que no se
 * pudo reabrir el proyecto no borra la referencia guardada.
 */
let sessionTouched = false;

export function markSessionTouched() {
  sessionTouched = true;
}

function toTab(doc: ProjectDoc): SessionTab | null {
  const key = sourceKey(doc.source);
  // Los blobs (input file / arrastre) no pueden reabrirse sin el usuario.
  if (!key || doc.error) return null;
  return {
    key,
    source: doc.source,
    fileName: doc.fileName,
    view: doc.view,
    pageIndex: doc.pageIndex,
    modelIndex: doc.modelIndex,
  };
}

export function buildSession(state: AppState): SessionState {
  const active = state.projects.find((doc) => doc.id === state.activeId);
  // Con Inicio activo se guarda el último proyecto abierto que sea reabrible.
  const tab = (active && toTab(active)) ?? lastReopenable(state);
  return { last: tab };
}

function lastReopenable(state: AppState): SessionTab | null {
  for (let i = state.projects.length - 1; i >= 0; i--) {
    const tab = toTab(state.projects[i]);
    if (tab) return tab;
  }
  return null;
}

const SAVE_DELAY = 500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Guarda la sesión con debounce; se llama en cada cambio de estado relevante. */
export function scheduleSessionSave(state: AppState) {
  if (!sessionTouched) return;
  if (saveTimer) clearTimeout(saveTimer);
  const session = buildSession(state);
  saveTimer = setTimeout(() => {
    void setSession(session).catch((error) =>
      console.warn("No se pudo guardar la sesión:", error)
    );
  }, SAVE_DELAY);
}
