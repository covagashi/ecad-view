import { useCallback, useMemo, useRef, useState } from "react";
import { parseE3d, type E3dScene } from "@byndr/e3d-core";
import { extractEpdz, type EpdzEntry } from "@byndr/e3d-core/epdz";
import { readManifest, type EplanManifest } from "@byndr/e3d-core/manifest";
import wasmUrl from "7z-wasm/7zz.wasm?url";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { Viewer } from "./viewer/Viewer";
import {
  SchematicViewer,
  pageTitle,
  type SchematicHighlight,
  type SchematicNavTarget,
} from "./viewer/SchematicViewer";
import { ProjectPanel } from "./ProjectPanel";
import { Sidebar } from "./Sidebar";
import { buildDeviceIndex, type Device } from "./devices";
import {
  LOCALES,
  LOCALE_NAMES,
  useI18n,
  type Locale,
  type TranslateParams,
  type TranslationKey,
} from "./i18n";

interface LoadedModel {
  name: string;
  scene: E3dScene;
}

/** Estado mostrado en la barra inferior; se guarda como clave + parámetros
 * para que el texto cambie de idioma sin recargar. */
interface StatusMessage {
  key: TranslationKey;
  params?: TranslateParams;
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
  const { t, locale, setLocale } = useI18n();
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [epdzModels, setEpdzModels] = useState<EpdzEntry[]>([]);
  const [pages, setPages] = useState<LoadedPage[]>([]);
  const [manifest, setManifest] = useState<EplanManifest | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [picked, setPicked] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlight, setHighlight] = useState<SchematicHighlight | null>(null);
  /** Texto informativo de la última referencia cruzada seguida (barra de estado). */
  const [xrefInfo, setXrefInfo] = useState<string | null>(null);
  const nonceRef = useRef(0);
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
      setHighlight(null);
      setXrefInfo(null);
      setStatus(null);
      for (const url of imageUrlsRef.current.values()) URL.revokeObjectURL(url);
      imageUrlsRef.current = new Map();
      try {
        if (name.toLowerCase().endsWith(".epdz")) {
          setStatus({ key: "status.extracting" });
          const contents = await extractEpdz(buffer, { wasmUrl });

          let projectManifest: EplanManifest | null = null;
          const manifestEntry = contents.databases.find((d) =>
            d.path.toLowerCase().endsWith("manifest.db")
          );
          if (manifestEntry) {
            setStatus({ key: "status.readingManifest" });
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
            setStatus({ key: "status.noContent" });
          }
        } else {
          loadE3dBuffer(name, buffer);
          setViewMode("3d");
          setStatus(null);
        }
        setFileName(name);
      } catch (error) {
        console.error(error);
        setStatus({
          key: "status.loadError",
          params: { name, message: error instanceof Error ? error.message : String(error) },
        });
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
      setStatus({ key: "status.downloadingDemo" });
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await loadFile(url.split("/").pop() ?? url, await response.arrayBuffer());
      } catch (error) {
        setStatus({
          key: "status.demoError",
          params: { message: error instanceof Error ? error.message : String(error) },
        });
        setBusy(false);
      }
    },
    [loadFile]
  );

  const hasContent = model !== null || pages.length > 0;
  const currentPage = pages[pageIndex] as LoadedPage | undefined;
  const imageUrls = useMemo(() => imageUrlsRef.current, [pages]);
  const deviceIndex = useMemo(() => buildDeviceIndex(pages), [pages]);

  const selectPage = useCallback((index: number) => {
    setPageIndex(index);
    setHighlight(null);
    setXrefInfo(null);
    setSidebarOpen(false);
  }, []);

  /** Salta a la siguiente aparición del dispositivo (ciclando entre páginas). */
  const jumpToDevice = useCallback(
    (device: Device) => {
      const occurrences = device.occurrences;
      if (occurrences.length === 0) return;
      const current = occurrences.findIndex(
        (o) => o.pageIndex === pageIndex && o.elementId === highlight?.elementId
      );
      const nextIndex = (current + 1) % occurrences.length;
      const next = occurrences[nextIndex];
      setPageIndex(next.pageIndex);
      setHighlight({ elementId: next.elementId, nonce: ++nonceRef.current });
      setXrefInfo(`${device.label} · ${nextIndex + 1}/${occurrences.length}`);
      setSidebarOpen(false);
      setViewMode("pages");
    },
    [pageIndex, highlight]
  );

  /** Resuelve un enlace jumpToFunction: salto a otra página o a un dispositivo. */
  const onSchematicNavigate = useCallback(
    (target: SchematicNavTarget) => {
      if (target.file) {
        const fileLower = target.file.toLowerCase();
        const index = pages.findIndex((p) => {
          const base = (p.path.split("/").pop() ?? "").toLowerCase();
          return base === fileLower || base === `${fileLower}.svg`;
        });
        if (index < 0) {
          setStatus({ key: "status.xrefNotFound", params: { target: target.file } });
          return;
        }
        setPageIndex(index);
        setHighlight(
          target.elementId ? { elementId: target.elementId, nonce: ++nonceRef.current } : null
        );
        setXrefInfo(null);
        return;
      }
      if (!target.elementId) return;
      const device = deviceIndex.byElement.get(`${pageIndex}|${target.elementId}`);
      if (device) {
        jumpToDevice(device);
      } else {
        // Sin índice de dispositivos: al menos se recuadra el propio elemento.
        setHighlight({ elementId: target.elementId, nonce: ++nonceRef.current });
      }
    },
    [pages, pageIndex, deviceIndex, jumpToDevice]
  );

  const openFileInput = (
    <label className="btn primary" style={{ cursor: "pointer" }}>
      {t("app.openFile")}
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
              {t("tabs.schematics")}
            </button>
            <button
              className={viewMode === "project" ? "active" : ""}
              disabled={!manifest}
              onClick={() => setViewMode("project")}
            >
              {t("tabs.project")}
            </button>
          </nav>
        )}

        {viewMode === "pages" && pages.length > 0 && (
          <button className="btn quiet sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)}>
            {t("app.pages")}
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
        <select
          className="btn lang-select"
          aria-label="Language"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </select>
        {hasContent && openFileInput}
      </header>

      <main className="main">
        {!hasContent && (
          <div className="empty">
            <div className={`dropzone${dragging ? " dragging" : ""}`}>
              <h1>{t("drop.title")}</h1>
              <p>{t("drop.hint")}</p>
              <div className="actions">
                {openFileInput}
                <button
                  className="btn demo-btn"
                  disabled={busy}
                  onClick={() => void loadDemo("/demo/ejemplo.epdz")}
                >
                  {t("drop.demoProject")}
                </button>
                <button
                  className="btn demo-btn"
                  disabled={busy}
                  onClick={() => void loadDemo("/demo/pilz_pnoz_3d.e3d")}
                >
                  {t("drop.demoPart")}
                </button>
              </div>
              <div className="hint">{t("drop.privacy")}</div>
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
            <Sidebar
              pages={pages}
              pageIndex={pageIndex}
              devices={deviceIndex.devices}
              open={sidebarOpen}
              onSelectPage={selectPage}
              onSelectDevice={jumpToDevice}
            />
            <div className="with-sidebar">
              <SchematicViewer
                svgText={currentPage.svgText}
                imageUrls={imageUrls}
                highlight={highlight}
                onNavigate={onSchematicNavigate}
              />
            </div>
          </>
        )}

        {hasContent && viewMode === "project" && manifest && (
          <ProjectPanel manifest={manifest} modelCount={epdzModels.length} pageCount={pages.length} />
        )}
      </main>

      <footer className="statusbar">
        <span className="grow">
          {status
            ? t(status.key, status.params)
            : fileName
              ? [
                  fileName,
                  model &&
                    `E3D v${model.scene.formatVersion} · ${t("status.parts", {
                      count: model.scene.parts.length,
                    })} · ${t("status.meshes", { count: model.scene.meshes.length })}`,
                  pages.length > 0 && t("status.pages", { count: pages.length }),
                ]
                  .filter(Boolean)
                  .join("  ·  ")
              : t("status.noFile")}
        </span>
        {viewMode === "pages" && xrefInfo && <span className="pick">{xrefInfo}</span>}
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
