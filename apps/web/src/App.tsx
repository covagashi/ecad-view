import { useCallback, useMemo, useRef, useState } from "react";
import { parseE3d, type E3dScene } from "@byndr/e3d-core";
import { extractEpdz, type EpdzEntry } from "@byndr/e3d-core/epdz";
import { readManifest, type EplanManifest } from "@byndr/e3d-core/manifest";
import wasmUrl from "7z-wasm/7zz.wasm?url";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { Viewer } from "./viewer/Viewer";
import { SchematicViewer, pageTitle } from "./viewer/SchematicViewer";
import { ProjectPanel } from "./ProjectPanel";

interface LoadedModel {
  name: string;
  scene: E3dScene;
}

export interface LoadedPage {
  path: string;
  name: string;
  title: string;
  breadcrumb: string[];
  badge: string | null;
  svgText: string;
}

type ViewMode = "3d" | "pages" | "project";

export function App() {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [epdzModels, setEpdzModels] = useState<EpdzEntry[]>([]);
  const [pages, setPages] = useState<LoadedPage[]>([]);
  const [manifest, setManifest] = useState<EplanManifest | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [status, setStatus] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const imageUrlsRef = useRef<Map<string, string>>(new Map());

  const loadE3dBuffer = useCallback((name: string, buffer: ArrayBuffer) => {
    const scene = parseE3d(buffer);
    setModel({ name, scene });
  }, []);

  const loadFile = useCallback(
    async (name: string, buffer: ArrayBuffer) => {
      setBusy(true);
      setPicked(null);
      setEpdzModels([]);
      setPages([]);
      setManifest(null);
      setPageIndex(0);
      setFilter("");
      setStatus(null);
      for (const url of imageUrlsRef.current.values()) URL.revokeObjectURL(url);
      imageUrlsRef.current = new Map();
      try {
        if (name.toLowerCase().endsWith(".epdz")) {
          setStatus("Extrayendo archivo…");
          const contents = await extractEpdz(buffer, { wasmUrl });

          let projectManifest: EplanManifest | null = null;
          const manifestEntry = contents.databases.find((d) =>
            d.path.toLowerCase().endsWith("manifest.db")
          );
          if (manifestEntry) {
            setStatus("Leyendo manifest.db…");
            try {
              // El visor no debe quedarse bloqueado si sql.js no inicializa.
              projectManifest = await withTimeout(
                readManifest(manifestEntry.data, { wasmUrl: sqlWasmUrl }),
                10000
              );
            } catch (error) {
              console.warn("No se pudo leer manifest.db:", error);
            }
          }
          setManifest(projectManifest);

          setPages(buildPageList(contents.pages, projectManifest));
          for (const image of contents.images) {
            const imageName = (image.path.split("/").pop() ?? image.path).toLowerCase();
            imageUrlsRef.current.set(
              imageName,
              URL.createObjectURL(new Blob([toArrayBuffer(image.data)]))
            );
          }

          setEpdzModels(contents.models);
          if (contents.models.length > 0) {
            const first = contents.models[0];
            loadE3dBuffer(first.path.split("/").pop() ?? first.path, toArrayBuffer(first.data));
            setViewMode("3d");
            setStatus(null);
          } else if (contents.pages.length > 0) {
            setModel(null);
            setViewMode("pages");
            setStatus(null);
          } else {
            setModel(null);
            setStatus("El archivo no contiene modelos 3D ni páginas.");
          }
        } else {
          loadE3dBuffer(name, buffer);
          setViewMode("3d");
          setStatus(null);
        }
        setFileName(name);
      } catch (error) {
        console.error(error);
        setStatus(`Error al cargar ${name}: ${error instanceof Error ? error.message : error}`);
      } finally {
        setBusy(false);
      }
    },
    [loadE3dBuffer]
  );

  const onFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      await loadFile(file.name, await file.arrayBuffer());
    },
    [loadFile]
  );

  const loadDemo = useCallback(
    async (url: string) => {
      setBusy(true);
      setStatus("Descargando demo…");
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await loadFile(url.split("/").pop() ?? url, await response.arrayBuffer());
      } catch (error) {
        setStatus(`Error al cargar la demo: ${error instanceof Error ? error.message : error}`);
        setBusy(false);
      }
    },
    [loadFile]
  );

  const hasContent = model !== null || pages.length > 0;
  const currentPage = pages[pageIndex] as LoadedPage | undefined;
  const imageUrls = useMemo(() => imageUrlsRef.current, [pages]);
  const filteredPages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pages.map((page, index) => ({ page, index }));
    return pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) =>
        `${page.title} ${page.breadcrumb.join(" ")} ${page.name}`.toLowerCase().includes(q)
      );
  }, [pages, filter]);

  const openFileInput = (
    <label className="btn primary" style={{ cursor: "pointer" }}>
      Abrir fichero
      <input
        type="file"
        accept=".e3d,.E3d,.epdz"
        style={{ display: "none" }}
        onChange={(e) => void onFiles(e.target.files)}
      />
    </label>
  );

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void onFiles(e.dataTransfer.files);
      }}
    >
      <header className="topbar">
        <div className="brand">
          <strong>Byndr</strong>
          <span>ECAD Viewer</span>
        </div>

        {hasContent && (
          <nav className="tabs">
            <button
              className={viewMode === "3d" ? "active" : ""}
              disabled={!model}
              onClick={() => setViewMode("3d")}
            >
              3D
            </button>
            <button
              className={viewMode === "pages" ? "active" : ""}
              disabled={pages.length === 0}
              onClick={() => setViewMode("pages")}
            >
              Esquemas
            </button>
            <button
              className={viewMode === "project" ? "active" : ""}
              disabled={!manifest}
              onClick={() => setViewMode("project")}
            >
              Proyecto
            </button>
          </nav>
        )}

        {viewMode === "pages" && pages.length > 0 && (
          <button className="btn quiet sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)}>
            Páginas
          </button>
        )}

        <div className="topbar-spacer" />

        {viewMode === "3d" && epdzModels.length > 1 && (
          <select
            className="btn"
            onChange={(e) => {
              const entry = epdzModels[Number(e.target.value)];
              loadE3dBuffer(entry.path.split("/").pop() ?? entry.path, toArrayBuffer(entry.data));
            }}
          >
            {epdzModels.map((entry, i) => (
              <option key={entry.path} value={i}>
                {entry.path.split("/").pop()}
              </option>
            ))}
          </select>
        )}
        {hasContent && openFileInput}
      </header>

      <main className="main">
        {!hasContent && (
          <div className="empty">
            <div className={`dropzone${dragging ? " dragging" : ""}`}>
              <h1>Visor de proyectos EPLAN</h1>
              <p>Arrastra aquí un fichero .e3d o .epdz para abrirlo.</p>
              <div className="actions">
                {openFileInput}
                <button
                  className="btn demo-btn"
                  disabled={busy}
                  onClick={() => void loadDemo("/demo/ejemplo.epdz")}
                >
                  Proyecto de ejemplo
                </button>
                <button
                  className="btn demo-btn"
                  disabled={busy}
                  onClick={() => void loadDemo("/demo/pilz_pnoz_3d.e3d")}
                >
                  Pieza 3D de ejemplo
                </button>
              </div>
              <div className="hint">
                Los ficheros se procesan localmente en tu dispositivo; no se suben a ningún servidor.
              </div>
            </div>
          </div>
        )}

        {hasContent && viewMode === "3d" && (
          <div className="viewport">
            <Viewer scene={model?.scene ?? null} onPickPart={setPicked} />
          </div>
        )}

        {hasContent && viewMode === "pages" && currentPage && (
          <>
            {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
            <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
              <div className="search">
                <input
                  type="search"
                  placeholder={`Filtrar ${pages.length} páginas…`}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <div className="page-list">
                {filteredPages.map(({ page, index }) => (
                  <button
                    key={page.path}
                    className={`page-item${index === pageIndex ? " active" : ""}`}
                    onClick={() => {
                      setPageIndex(index);
                      setSidebarOpen(false);
                    }}
                  >
                    <span className="row">
                      <span className="title">{page.title}</span>
                      {page.badge && <span className="badge">{page.badge}</span>}
                    </span>
                    {page.breadcrumb.length > 1 && (
                      <span className="crumb">{page.breadcrumb.slice(0, -1).join(" › ")}</span>
                    )}
                  </button>
                ))}
              </div>
            </aside>
            <div className="with-sidebar">
              <SchematicViewer svgText={currentPage.svgText} imageUrls={imageUrls} />
            </div>
          </>
        )}

        {hasContent && viewMode === "project" && manifest && (
          <ProjectPanel manifest={manifest} modelCount={epdzModels.length} pageCount={pages.length} />
        )}
      </main>

      <footer className="statusbar">
        <span className="grow">
          {status ??
            (fileName
              ? [
                  fileName,
                  model &&
                    `E3D v${model.scene.formatVersion} · ${model.scene.parts.length} partes · ${model.scene.meshes.length} meshes`,
                  pages.length > 0 && `${pages.length} páginas`,
                ]
                  .filter(Boolean)
                  .join("  ·  ")
              : "Ningún fichero abierto")}
        </span>
        {viewMode === "pages" && currentPage && (
          <span className="optional">{currentPage.name}</span>
        )}
        {viewMode === "3d" && picked && (
          <span className="pick">
            typeId {String(picked.typeId ?? "–")} · objectId {String(picked.objectId ?? "–")}
          </span>
        )}
      </footer>
    </div>
  );
}

/**
 * Construye la lista de páginas combinando los SVG extraídos con los
 * metadatos de manifest.db (nombres estructurados EPLAN). Si no hay
 * manifest, usa el <title> del propio SVG.
 */
function buildPageList(svgEntries: EpdzEntry[], manifest: EplanManifest | null): LoadedPage[] {
  const decoder = new TextDecoder("utf-8");
  const byFile = new Map<string, EpdzEntry>();
  for (const entry of svgEntries) {
    byFile.set((entry.path.split("/").pop() ?? entry.path).toLowerCase(), entry);
  }

  const result: LoadedPage[] = [];
  const used = new Set<EpdzEntry>();

  if (manifest) {
    for (const page of manifest.pages) {
      const entry = page.file ? byFile.get(page.file.toLowerCase()) : undefined;
      if (!entry) continue;
      used.add(entry);
      result.push({
        path: entry.path,
        name: page.name,
        title: page.title,
        breadcrumb: page.breadcrumb,
        badge: [page.pageType?.replace(/_/g, " "), page.counter].filter(Boolean).join(" · ") || null,
        svgText: decoder.decode(entry.data),
      });
    }
  }

  for (const entry of svgEntries) {
    if (used.has(entry)) continue;
    const name = entry.path.split("/").pop() ?? entry.path;
    const svgText = decoder.decode(entry.data);
    result.push({
      path: entry.path,
      name,
      title: pageTitle(svgText, name),
      breadcrumb: [],
      badge: null,
      svgText,
    });
  }

  return result;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout tras ${ms} ms`)), ms)
    ),
  ]);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
