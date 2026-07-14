import type { AppState } from "../state/types";
import { setSession, sourceKey, type SessionState, type SessionTab } from "./db";

/*
 * Guardado de la sesión (pestañas abiertas + estado de vista por pestaña),
 * como hace Visual Studio: al reabrir la aplicación se ofrece restaurarla.
 */

/**
 * La sesión guardada solo se sobrescribe cuando el usuario ha tocado las
 * pestañas en esta sesión (abrir/cerrar); así el arranque no machaca la
 * sesión anterior antes de que el usuario decida restaurarla.
 */
let sessionTouched = false;

export function markSessionTouched() {
  sessionTouched = true;
}

export function buildSession(state: AppState): SessionState {
  const tabs: SessionTab[] = [];
  for (const doc of state.projects) {
    const key = sourceKey(doc.source);
    // Los blobs (input file / arrastre) no pueden reabrirse sin el usuario.
    if (!key || doc.error) continue;
    tabs.push({
      key,
      source: doc.source,
      fileName: doc.fileName,
      view: doc.view,
      pageIndex: doc.pageIndex,
      modelIndex: doc.modelIndex,
    });
  }
  const activeDoc = state.projects.find((doc) => doc.id === state.activeId);
  const activeKey = (activeDoc && sourceKey(activeDoc.source)) || "home";
  return { tabs, activeKey };
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
