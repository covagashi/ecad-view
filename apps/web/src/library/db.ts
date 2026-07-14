import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import type { ProjectSource, ProjectView } from "../state/types";

/*
 * Persistencia de la biblioteca en IndexedDB (estilo Visual Studio):
 * carpetas vinculadas (con su FileSystemDirectoryHandle, que es
 * structured-cloneable), índice de ficheros por carpeta, recientes,
 * sesión de pestañas abiertas y miniaturas.
 */

// idb-keyval usa un object store por base de datos; una BD por dominio.
const foldersStore = createStore("covaga-folders", "kv");
const indexStore = createStore("covaga-index", "kv");
const recentsStore = createStore("covaga-recents", "kv");
const sessionStore = createStore("covaga-session", "kv");
const thumbsStore = createStore("covaga-thumbs", "kv");

export interface LinkedFolder {
  id: string;
  /** Nombre visible (handle.name). */
  name: string;
  handle: FileSystemDirectoryHandle;
  addedAt: number;
  lastIndexedAt: number | null;
}

export interface FileMeta {
  pages: number;
  models: number;
}

export interface IndexedFile {
  /** Ruta relativa dentro de la carpeta, con "/" como separador. */
  relPath: string;
  name: string;
  kind: "epdz" | "e3d";
  size: number;
  mtime: number;
  /** Se rellena la primera vez que el proyecto se abre. */
  meta?: FileMeta;
}

export interface RecentEntry {
  /** Clave estable del documento (ver sourceKey). */
  key: string;
  label: string;
  lastOpened: number;
  source: ProjectSource;
  meta?: FileMeta;
}

export interface SessionTab {
  key: string;
  source: ProjectSource;
  fileName: string;
  view: ProjectView;
  pageIndex: number;
  modelIndex: number;
}

export interface SessionState {
  tabs: SessionTab[];
  /** Clave de la pestaña activa, o "home". */
  activeKey: string;
}

/** Clave estable de un documento persistible; null para blobs (no restaurables). */
export function sourceKey(source: ProjectSource): string | null {
  if (source.kind === "folder") return `${source.folderId}|${source.relPath}`;
  if (source.kind === "url") return `url|${source.url}`;
  return null;
}

// ---------- Carpetas ----------

export async function listFolders(): Promise<LinkedFolder[]> {
  const all = await entries<string, LinkedFolder>(foldersStore);
  return all.map(([, folder]) => folder).sort((a, b) => a.addedAt - b.addedAt);
}

export async function saveFolder(folder: LinkedFolder): Promise<void> {
  await set(folder.id, folder, foldersStore);
}

export async function removeFolder(id: string): Promise<void> {
  await del(id, foldersStore);
  await del(id, indexStore);
  // Limpia recientes y miniaturas de esa carpeta.
  const recents = await listRecents();
  for (const recent of recents) {
    if (recent.source.kind === "folder" && recent.source.folderId === id) {
      await del(recent.key, recentsStore);
      await del(recent.key, thumbsStore);
    }
  }
}

// ---------- Índice de ficheros ----------

export async function getIndex(folderId: string): Promise<IndexedFile[]> {
  return (await get<IndexedFile[]>(folderId, indexStore)) ?? [];
}

export async function setIndex(folderId: string, files: IndexedFile[]): Promise<void> {
  await set(folderId, files, indexStore);
}

/** Actualiza los metadatos (nº páginas/modelos) de un fichero ya indexado. */
export async function updateFileMeta(
  folderId: string,
  relPath: string,
  meta: FileMeta
): Promise<void> {
  const files = await getIndex(folderId);
  const file = files.find((f) => f.relPath === relPath);
  if (!file) return;
  file.meta = meta;
  await setIndex(folderId, files);
}

// ---------- Recientes ----------

const MAX_RECENTS = 12;

export async function listRecents(): Promise<RecentEntry[]> {
  const all = await entries<string, RecentEntry>(recentsStore);
  return all.map(([, entry]) => entry).sort((a, b) => b.lastOpened - a.lastOpened);
}

export async function pushRecent(entry: RecentEntry): Promise<void> {
  await set(entry.key, entry, recentsStore);
  const all = await listRecents();
  for (const stale of all.slice(MAX_RECENTS)) {
    await del(stale.key, recentsStore);
    await del(stale.key, thumbsStore);
  }
}

// ---------- Sesión ----------

const SESSION_KEY = "session";

export async function getSession(): Promise<SessionState | null> {
  return (await get<SessionState>(SESSION_KEY, sessionStore)) ?? null;
}

export async function setSession(session: SessionState): Promise<void> {
  await set(SESSION_KEY, session, sessionStore);
}

// ---------- Miniaturas ----------

export async function getThumb(key: string): Promise<Blob | undefined> {
  return get<Blob>(key, thumbsStore);
}

export async function setThumb(key: string, blob: Blob): Promise<void> {
  await set(key, blob, thumbsStore);
}

export async function hasThumb(key: string): Promise<boolean> {
  return (await get(key, thumbsStore)) !== undefined;
}

export type { UseStore };
