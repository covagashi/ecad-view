import { useCallback, useEffect, useState } from "react";
import { useProjects } from "../state/ProjectsContext";
import type { LoadedProjectData, ProjectSource, ProjectView } from "../state/types";
import {
  getSession,
  getIndex,
  listFolders,
  listRecents,
  pushRecent,
  removeFolder,
  saveFolder,
  setIndex,
  sourceKey,
  updateFileMeta,
  type IndexedFile,
  type LinkedFolder,
  type RecentEntry,
  type SessionState,
} from "./db";
import {
  persistentFoldersSupported,
  pickFolder,
  queryFolderPermission,
  readFolderFile,
  requestFolderPermission,
  scanFolder,
  type FolderPermission,
} from "./fs";
import { ensureThumb } from "./thumbs";

export interface FolderView {
  folder: LinkedFolder;
  permission: FolderPermission;
  files: IndexedFile[];
}

export interface LibraryApi {
  /** false = modo degradado (sin File System Access API). */
  supported: boolean;
  folders: FolderView[];
  recents: RecentEntry[];
  /** Sesión anterior pendiente de restaurar (banner). */
  pendingSession: SessionState | null;
  linkFolder: () => Promise<void>;
  /** "Cambiar": sustituye la carpeta por otra elegida con el picker. */
  changeFolder: (id: string) => Promise<void>;
  reindexFolder: (id: string) => Promise<void>;
  /** "Reconectar": re-pide el permiso de lectura (debe ser dentro de un clic). */
  reconnectFolder: (id: string) => Promise<void>;
  unlinkFolder: (id: string) => Promise<void>;
  openIndexedFile: (folderId: string, file: IndexedFile) => Promise<void>;
  openRecent: (recent: RecentEntry) => Promise<void>;
  restoreSession: () => Promise<void>;
  dismissSession: () => void;
}

/** Estado y acciones de la biblioteca (carpetas vinculadas, recientes, sesión). */
export function useLibrary(): LibraryApi {
  const { state, dispatch, openFile } = useProjects();
  const [supported] = useState(persistentFoldersSupported);
  const [folders, setFolders] = useState<FolderView[]>([]);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [pendingSession, setPendingSession] = useState<SessionState | null>(null);

  const refresh = useCallback(async () => {
    setRecents(await listRecents());
    if (!supported) return;
    const linked = await listFolders();
    const views: FolderView[] = [];
    for (const folder of linked) {
      views.push({
        folder,
        permission: await queryFolderPermission(folder),
        files: await getIndex(folder.id),
      });
    }
    setFolders(views);
  }, [supported]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Sesión anterior: se ofrece restaurarla solo si aún no hay pestañas abiertas.
  useEffect(() => {
    void getSession().then((session) => {
      if (session && session.tabs.length > 0) setPendingSession(session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indexFolder = useCallback(async (folder: LinkedFolder) => {
    const files = await scanFolder(folder.handle);
    await setIndex(folder.id, files);
    await saveFolder({ ...folder, lastIndexedAt: Date.now() });
  }, []);

  const linkFolder = useCallback(async () => {
    const handle = await pickFolder();
    if (!handle) return;
    const folder: LinkedFolder = {
      id: crypto.randomUUID(),
      name: handle.name,
      handle,
      addedAt: Date.now(),
      lastIndexedAt: null,
    };
    await saveFolder(folder);
    await indexFolder(folder);
    await refresh();
  }, [indexFolder, refresh]);

  const changeFolder = useCallback(
    async (id: string) => {
      const current = (await listFolders()).find((f) => f.id === id);
      if (!current) return;
      const handle = await pickFolder();
      if (!handle) return;
      const replaced: LinkedFolder = { ...current, name: handle.name, handle };
      await saveFolder(replaced);
      await indexFolder(replaced);
      await refresh();
    },
    [indexFolder, refresh]
  );

  const reindexFolder = useCallback(
    async (id: string) => {
      const folder = (await listFolders()).find((f) => f.id === id);
      if (!folder) return;
      if ((await queryFolderPermission(folder)) !== "granted") {
        if ((await requestFolderPermission(folder)) !== "granted") return;
      }
      await indexFolder(folder);
      await refresh();
    },
    [indexFolder, refresh]
  );

  const reconnectFolder = reindexFolder;

  const unlinkFolder = useCallback(
    async (id: string) => {
      await removeFolder(id);
      await refresh();
    },
    [refresh]
  );

  /** Efectos tras abrir un documento persistible: recientes, meta y miniatura. */
  const afterOpen = useCallback(
    async (source: ProjectSource, fileName: string, data: LoadedProjectData | null) => {
      if (!data) return;
      const key = sourceKey(source);
      if (!key) return;
      const meta = { pages: data.pages.length, models: data.epdzModels.length };
      await pushRecent({ key, label: fileName, lastOpened: Date.now(), source, meta });
      if (source.kind === "folder") {
        await updateFileMeta(source.folderId, source.relPath, meta);
      }
      const firstPage = data.pages[0];
      if (firstPage) void ensureThumb(key, firstPage.svgText);
      await refresh();
    },
    [refresh]
  );

  const openFromFolder = useCallback(
    async (folderId: string, relPath: string, fileName: string) => {
      const folder = (await listFolders()).find((f) => f.id === folderId);
      if (!folder) throw new Error("Carpeta no vinculada");
      if ((await queryFolderPermission(folder)) !== "granted") {
        if ((await requestFolderPermission(folder)) !== "granted") {
          await refresh();
          throw new Error("Permiso de lectura denegado");
        }
      }
      const file = await readFolderFile(folder.handle, relPath);
      const source: ProjectSource = { kind: "folder", folderId, relPath };
      const result = await openFile(fileName, await file.arrayBuffer(), source);
      await afterOpen(source, fileName, result.data);
      return result;
    },
    [openFile, afterOpen, refresh]
  );

  const openIndexedFile = useCallback(
    async (folderId: string, file: IndexedFile) => {
      // Si ya está abierto, solo activa su pestaña.
      const key = `${folderId}|${file.relPath}`;
      const open = state.projects.find((p) => sourceKey(p.source) === key);
      if (open) {
        dispatch({ type: "SET_ACTIVE", id: open.id });
        return;
      }
      try {
        await openFromFolder(folderId, file.relPath, file.name);
      } catch (error) {
        console.warn("No se pudo abrir el fichero indexado:", error);
      }
    },
    [state.projects, dispatch, openFromFolder]
  );

  const openRecent = useCallback(
    async (recent: RecentEntry) => {
      const open = state.projects.find((p) => sourceKey(p.source) === recent.key);
      if (open) {
        dispatch({ type: "SET_ACTIVE", id: open.id });
        return;
      }
      try {
        if (recent.source.kind === "folder") {
          await openFromFolder(recent.source.folderId, recent.source.relPath, recent.label);
        } else if (recent.source.kind === "url") {
          const response = await fetch(recent.source.url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const result = await openFile(recent.label, await response.arrayBuffer(), recent.source);
          await afterOpen(recent.source, recent.label, result.data);
        }
      } catch (error) {
        console.warn("No se pudo abrir el reciente:", error);
      }
    },
    [state.projects, dispatch, openFromFolder, openFile, afterOpen]
  );

  /** Reabre las pestañas de la sesión anterior (un solo gesto de usuario). */
  const restoreSession = useCallback(async () => {
    const session = pendingSession;
    setPendingSession(null);
    if (!session) return;
    const idByKey = new Map<string, string>();
    for (const tab of session.tabs) {
      try {
        let result: { id: string; data: LoadedProjectData | null } | null = null;
        if (tab.source.kind === "folder") {
          result = await openFromFolder(tab.source.folderId, tab.source.relPath, tab.fileName);
        } else if (tab.source.kind === "url") {
          const response = await fetch(tab.source.url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          result = await openFile(tab.fileName, await response.arrayBuffer(), tab.source);
          await afterOpen(tab.source, tab.fileName, result.data);
        }
        if (!result?.data) continue;
        idByKey.set(tab.key, result.id);
        // Restaura la vista/página/modelo de la pestaña (el reducer valida).
        if (tab.modelIndex >= 0 && tab.modelIndex < result.data.epdzModels.length) {
          dispatch({ type: "SET_MODEL", id: result.id, modelIndex: tab.modelIndex });
        }
        if (tab.pageIndex > 0) {
          dispatch({ type: "SET_PAGE", id: result.id, pageIndex: tab.pageIndex });
        }
        dispatch({ type: "SET_VIEW", id: result.id, view: tab.view as ProjectView });
      } catch (error) {
        console.warn(`No se pudo restaurar ${tab.fileName}:`, error);
      }
    }
    const activeId = idByKey.get(session.activeKey);
    dispatch({ type: "SET_ACTIVE", id: activeId ?? "home" });
  }, [pendingSession, openFromFolder, openFile, afterOpen, dispatch]);

  const dismissSession = useCallback(() => setPendingSession(null), []);

  return {
    supported,
    folders,
    recents,
    pendingSession,
    linkFolder,
    changeFolder,
    reindexFolder,
    reconnectFolder,
    unlinkFolder,
    openIndexedFile,
    openRecent,
    restoreSession,
    dismissSession,
  };
}
