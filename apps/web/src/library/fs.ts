import type { IndexedFile, LinkedFolder } from "./db";

/*
 * Acceso a carpetas con la File System Access API (estilo Visual Studio:
 * el usuario elige una carpeta, el handle se persiste y los proyectos se
 * reabren desde ahí en sesiones posteriores).
 */

const BROKEN_FLAG = "covaga.fsBroken";

function fsBroken(): boolean {
  try {
    return localStorage.getItem(BROKEN_FLAG) === "1";
  } catch {
    return false;
  }
}

function markFsBroken() {
  try {
    localStorage.setItem(BROKEN_FLAG, "1");
  } catch {
    // Sin persistencia: se degradará de nuevo en el próximo intento.
  }
}

/**
 * Capacidad de carpetas persistentes. En navegadores sin la API (Firefox,
 * Safari, webviews de Capacitor) o contextos no seguros la biblioteca
 * funciona en modo degradado (solo recientes + abrir fichero).
 * Nota: en Tauri (WebView2) el picker puede existir pero fallar; el primer
 * fallo real activa covaga.fsBroken y degrada permanentemente. La integración
 * con el plugin fs nativo de Tauri queda fuera de alcance.
 */
export function persistentFoldersSupported(): boolean {
  return (
    typeof window.showDirectoryPicker === "function" && window.isSecureContext && !fsBroken()
  );
}

export type FolderPermission = "granted" | "prompt" | "denied";

export async function queryFolderPermission(folder: LinkedFolder): Promise<FolderPermission> {
  try {
    const state = await folder.handle.queryPermission?.({ mode: "read" });
    return (state as FolderPermission) ?? "granted";
  } catch {
    return "denied";
  }
}

/** Debe llamarse dentro de un gesto de usuario (clic). */
export async function requestFolderPermission(folder: LinkedFolder): Promise<FolderPermission> {
  try {
    const state = await folder.handle.requestPermission?.({ mode: "read" });
    return (state as FolderPermission) ?? "granted";
  } catch {
    return "denied";
  }
}

/**
 * Abre el selector de carpetas. Devuelve null si el usuario cancela.
 * Un fallo que no sea cancelación degrada la biblioteca a modo sin carpetas.
 */
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker!({ mode: "read" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    console.warn("showDirectoryPicker falló; se desactivan las carpetas vinculadas.", error);
    markFsBroken();
    return null;
  }
}

const MAX_DEPTH = 8;
const MAX_FILES = 5000;

/** Recorre la carpeta y devuelve los .epdz/.e3d con tamaño y fecha. */
export async function scanFolder(handle: FileSystemDirectoryHandle): Promise<IndexedFile[]> {
  const files: IndexedFile[] = [];

  async function walk(dir: FileSystemDirectoryHandle, prefix: string, depth: number) {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;
    for await (const entry of dir.values()) {
      if (files.length >= MAX_FILES) return;
      if (entry.name.startsWith(".")) continue;
      if (entry.kind === "directory") {
        await walk(entry as FileSystemDirectoryHandle, `${prefix}${entry.name}/`, depth + 1);
        continue;
      }
      const lower = entry.name.toLowerCase();
      const kind = lower.endsWith(".epdz") ? "epdz" : lower.endsWith(".e3d") ? "e3d" : null;
      if (!kind) continue;
      try {
        const file = await (entry as FileSystemFileHandle).getFile();
        files.push({
          relPath: `${prefix}${entry.name}`,
          name: entry.name,
          kind,
          size: file.size,
          mtime: file.lastModified,
        });
      } catch {
        // Fichero ilegible (bloqueado, etc.): se omite del índice.
      }
    }
  }

  await walk(handle, "", 0);
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return files;
}

/** Lee un fichero del árbol de la carpeta a partir de su ruta relativa. */
export async function readFolderFile(
  handle: FileSystemDirectoryHandle,
  relPath: string
): Promise<File> {
  const segments = relPath.split("/");
  const fileName = segments.pop()!;
  let dir = handle;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment);
  }
  const fileHandle = await dir.getFileHandle(fileName);
  return fileHandle.getFile();
}
