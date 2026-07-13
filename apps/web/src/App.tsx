import { useCallback, useMemo, useRef, useState } from "react";
import { parseE3d, type E3dScene } from "@byndr/e3d-core";
import { extractEpdz, type EpdzEntry } from "@byndr/e3d-core/epdz";
import wasmUrl from "7z-wasm/7zz.wasm?url";
import { Viewer } from "./viewer/Viewer";
import { SchematicViewer, pageTitle } from "./viewer/SchematicViewer";

interface LoadedModel {
  name: string;
  scene: E3dScene;
}

interface LoadedPage {
  path: string;
  name: string;
  title: string;
  svgText: string;
}

type ViewMode = "3d" | "pages";

export function App() {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [epdzModels, setEpdzModels] = useState<EpdzEntry[]>([]);
  const [pages, setPages] = useState<LoadedPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [status, setStatus] = useState<string>("Arrastra un fichero .e3d o .epdz, o usa una demo.");
  const [picked, setPicked] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const imageUrlsRef = useRef<Map<string, string>>(new Map());

  const loadE3dBuffer = useCallback((name: string, buffer: ArrayBuffer) => {
    const scene = parseE3d(buffer);
    setModel({ name, scene });
    setStatus(
      `${name} — formato v${scene.formatVersion}, ${scene.parts.length} partes, ` +
        `${scene.meshes.length} meshes, ${scene.textures.length} texturas`
    );
  }, []);

  const loadFile = useCallback(
    async (name: string, buffer: ArrayBuffer) => {
      setBusy(true);
      setPicked(null);
      setEpdzModels([]);
      setPages([]);
      setPageIndex(0);
      for (const url of imageUrlsRef.current.values()) URL.revokeObjectURL(url);
      imageUrlsRef.current = new Map();
      try {
        if (name.toLowerCase().endsWith(".epdz")) {
          setStatus(`Extrayendo ${name}...`);
          const contents = await extractEpdz(buffer, { wasmUrl });

          const decoder = new TextDecoder("utf-8");
          const loadedPages = contents.pages.map((entry) => {
            const svgText = decoder.decode(entry.data);
            const fileName = entry.path.split("/").pop() ?? entry.path;
            return { path: entry.path, name: fileName, title: pageTitle(svgText, fileName), svgText };
          });
          setPages(loadedPages);

          for (const image of contents.images) {
            const fileName = (image.path.split("/").pop() ?? image.path).toLowerCase();
            imageUrlsRef.current.set(
              fileName,
              URL.createObjectURL(new Blob([toArrayBuffer(image.data)]))
            );
          }

          setEpdzModels(contents.models);
          if (contents.models.length > 0) {
            const first = contents.models[0];
            loadE3dBuffer(first.path.split("/").pop() ?? first.path, toArrayBuffer(first.data));
            setViewMode("3d");
          } else if (loadedPages.length > 0) {
            setModel(null);
            setViewMode("pages");
            setStatus(`${name} — ${loadedPages.length} páginas de esquema, sin modelos 3D`);
          } else {
            setStatus(`${name} no contiene modelos .e3d ni páginas SVG.`);
          }
        } else {
          loadE3dBuffer(name, buffer);
          setViewMode("3d");
        }
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
      setStatus(`Descargando ${url}...`);
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

  const currentPage = pages[pageIndex] as LoadedPage | undefined;
  const imageUrls = useMemo(() => imageUrlsRef.current, [pages]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px",
    borderRadius: 4,
    border: "1px solid #555",
    background: active ? "#3d6cd9" : "transparent",
    color: "inherit",
    cursor: "pointer",
  });

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void onFiles(e.dataTransfer.files);
      }}
    >
      <div style={{ position: "absolute", inset: "48px 0 0 0" }}>
        {viewMode === "3d" && <Viewer scene={model?.scene ?? null} onPickPart={setPicked} />}
        {viewMode === "pages" && currentPage && (
          <>
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: 280,
                overflowY: "auto",
                background: "rgba(20,20,26,0.95)",
                zIndex: 1,
                fontSize: 13,
              }}
            >
              {pages.map((page, i) => (
                <div
                  key={page.path}
                  onClick={() => setPageIndex(i)}
                  title={page.title}
                  style={{
                    padding: "6px 10px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    background: i === pageIndex ? "#3d6cd9" : "transparent",
                  }}
                >
                  {page.title}
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", inset: "0 0 0 280px" }}>
              <SchematicViewer svgText={currentPage.svgText} imageUrls={imageUrls} />
            </div>
          </>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          boxSizing: "border-box",
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "0 14px",
          background: "rgba(20,20,26,0.95)",
          fontSize: 14,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <strong>Byndr ECAD Viewer</strong>
        {(model || pages.length > 0) && (
          <span style={{ display: "flex", gap: 4 }}>
            <button style={tabStyle(viewMode === "3d")} disabled={!model} onClick={() => setViewMode("3d")}>
              3D
            </button>
            <button
              style={tabStyle(viewMode === "pages")}
              disabled={pages.length === 0}
              onClick={() => setViewMode("pages")}
            >
              Esquemas{pages.length > 0 ? ` (${pages.length})` : ""}
            </button>
          </span>
        )}
        <label style={{ cursor: "pointer", textDecoration: "underline" }}>
          Abrir fichero…
          <input
            type="file"
            accept=".e3d,.E3d,.epdz"
            style={{ display: "none" }}
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
        <button disabled={busy} onClick={() => void loadDemo("/demo/pilz_pnoz_3d.e3d")}>
          Demo: contactor Pilz
        </button>
        <button disabled={busy} onClick={() => void loadDemo("/demo/ejemplo.epdz")}>
          Demo: proyecto .epdz
        </button>
        {viewMode === "3d" && epdzModels.length > 1 && (
          <select
            onChange={(e) => {
              const entry = epdzModels[Number(e.target.value)];
              loadE3dBuffer(entry.path.split("/").pop() ?? entry.path, toArrayBuffer(entry.data));
            }}
          >
            {epdzModels.map((entry, i) => (
              <option key={entry.path} value={i}>
                {entry.path}
              </option>
            ))}
          </select>
        )}
        <span style={{ opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis" }}>{status}</span>
      </div>

      {viewMode === "3d" && picked && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            padding: "8px 12px",
            background: "rgba(20,20,26,0.85)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          Parte seleccionada — typeId: {String(picked.typeId ?? "–")}, objectId:{" "}
          {String(picked.objectId ?? "–")}, meshId: {String(picked.meshId ?? "–")}
        </div>
      )}
    </div>
  );
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
