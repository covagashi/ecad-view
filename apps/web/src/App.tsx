import { useCallback, useState } from "react";
import { parseE3d, type E3dScene } from "@byndr/e3d-core";
import { extractEpdz, type EpdzEntry } from "@byndr/e3d-core/epdz";
import wasmUrl from "7z-wasm/7zz.wasm?url";
import { Viewer } from "./viewer/Viewer";

interface LoadedModel {
  name: string;
  scene: E3dScene;
}

export function App() {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [epdzModels, setEpdzModels] = useState<EpdzEntry[]>([]);
  const [status, setStatus] = useState<string>("Arrastra un fichero .e3d o .epdz, o usa una demo.");
  const [picked, setPicked] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

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
      try {
        if (name.toLowerCase().endsWith(".epdz")) {
          setStatus(`Extrayendo ${name}...`);
          const contents = await extractEpdz(buffer, { wasmUrl });
          if (contents.models.length === 0) {
            setStatus(`${name} no contiene modelos .e3d.`);
            return;
          }
          setEpdzModels(contents.models);
          const first = contents.models[0];
          loadE3dBuffer(first.path.split("/").pop() ?? first.path, toArrayBuffer(first.data));
        } else {
          loadE3dBuffer(name, buffer);
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

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void onFiles(e.dataTransfer.files);
      }}
    >
      <Viewer scene={model?.scene ?? null} onPickPart={setPicked} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "10px 14px",
          background: "rgba(20,20,26,0.85)",
          fontSize: 14,
        }}
      >
        <strong>Byndr ECAD Viewer</strong>
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
        {epdzModels.length > 1 && (
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
        <span style={{ opacity: 0.8 }}>{status}</span>
      </div>

      {picked && (
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
