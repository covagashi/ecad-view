import { useEffect, useRef } from "react";
import { useProjects } from "../state/ProjectsContext";
import { getSession, listFolders, type SessionTab } from "./db";
import { queryFolderPermission, readFolderFile } from "./fs";

/**
 * Al arrancar reabre el último proyecto sin preguntar nada. Si su fichero ya no
 * es accesible (carpeta desvinculada, o permiso de lectura no concedido, que
 * exigiría un gesto del usuario) se queda en Inicio en silencio: desde ahí el
 * proyecto sigue a un toque en recientes.
 */
export function useSessionRestore(): void {
  const { dispatch, openFile } = useProjects();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const tab = (await getSession())?.last;
      if (!tab) return;
      try {
        const buffer = await readTab(tab);
        if (!buffer) return;
        const { id, data } = await openFile(tab.fileName, buffer, tab.source);
        if (!data) return;
        // Devuelve la pestaña a la vista/página/modelo donde se dejó.
        if (tab.modelIndex >= 0 && tab.modelIndex < data.epdzModels.length) {
          dispatch({ type: "SET_MODEL", id, modelIndex: tab.modelIndex });
        }
        if (tab.pageIndex > 0) dispatch({ type: "SET_PAGE", id, pageIndex: tab.pageIndex });
        dispatch({ type: "SET_VIEW", id, view: tab.view });
      } catch (error) {
        console.warn(`No se pudo reabrir ${tab.fileName}:`, error);
      }
    })();
  }, [dispatch, openFile]);
}

/** Contenido del último proyecto, o null si no se puede leer sin preguntar. */
async function readTab(tab: SessionTab): Promise<ArrayBuffer | null> {
  const source = tab.source;
  if (source.kind === "folder") {
    const folder = (await listFolders()).find((entry) => entry.id === source.folderId);
    if (!folder || (await queryFolderPermission(folder)) !== "granted") return null;
    return (await readFolderFile(folder.handle, source.relPath)).arrayBuffer();
  }
  if (source.kind === "url") {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  }
  return null;
}
