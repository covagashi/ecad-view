import { useEffect, useMemo, useRef, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import type { EplanManifest } from "@covaga/e3d-core/manifest";
import type { EpdzEntry } from "@covaga/e3d-core/epdz";
import { Viewer, type ViewerHandle, type ViewPreset } from "../viewer/Viewer";
import { ViewPresets } from "../viewer3d/ViewPresets";
import { getScene } from "../state/sceneCache";
import { useI18n } from "../i18n";
import { IconSearch } from "../shell/icons";
import { buildConnections, type ConnectionRow } from "./derive";
import type { PartBoxIndex, PartBox } from "./partBoxes";
import type { DataNav } from "./DataView";

/**
 * Lista de conexiones de cableado al estilo EPLAN Smart Wiring: tabla con
 * origen/destino/sección/color y, para la conexión seleccionada, el 3D real
 * del armario con el cable enrutado encuadrado y resaltado. Origen y destino
 * saltan a su aparición en el esquema.
 */
export function ConnectionsView({
  manifest,
  aml,
  partBoxes,
  projectId,
  models,
  nav,
}: {
  manifest: EplanManifest | null;
  aml: AmlProject | null;
  partBoxes: PartBoxIndex;
  projectId: string;
  models: EpdzEntry[];
  nav: DataNav;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const connections = useMemo(() => buildConnections(manifest, aml), [manifest, aml]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((row) =>
      `${row.source} ${row.target} ${row.potential ?? ""} ${row.color ?? ""} ${
        row.crossSection ?? ""
      } ${row.partType ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [connections, filter]);

  // Selección: la primera conexión con cable 3D localizable.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected =
    (selectedIndex !== null ? filtered[selectedIndex] : undefined) ??
    filtered.find((row) => row.partKey !== null && partBoxes.has(row.partKey)) ??
    filtered[0] ??
    null;

  if (connections.length === 0) return <div className="data-note">{t("data.empty")}</div>;

  return (
    <div className="data-section">
      <div className="panel-search data-search">
        <IconSearch size={13} />
        <input
          type="search"
          placeholder={t("data.search")}
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setSelectedIndex(null);
          }}
        />
      </div>

      <div className="connections-layout">
        <div className="data-table-wrap conn-list">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("data.col.source")}</th>
                <th>{t("data.col.target")}</th>
                <th>{t("data.col.section")}</th>
                <th>{t("data.col.color")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr
                  key={index}
                  className={`conn-row${row === selected ? " active" : ""}`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <td className="mono">{row.source}</td>
                  <td className="mono">
                    {row.target}
                    {row.bridge && <span className="data-pill">{t("data.bridge")}</span>}
                  </td>
                  <td>{row.crossSection ?? "—"}</td>
                  <td className="mono">{row.color ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="data-note">{t("data.empty")}</div>}
        </div>

        {selected && (
          <ConnectionDetail
            connection={selected}
            box={selected.partKey ? partBoxes.get(selected.partKey) ?? null : null}
            projectId={projectId}
            models={models}
            nav={nav}
          />
        )}
      </div>

      <div className="data-note">{t("data.connCount", { count: filtered.length })}</div>
    </div>
  );
}

function ConnectionDetail({
  connection,
  box,
  projectId,
  models,
  nav,
}: {
  connection: ConnectionRow;
  box: PartBox | null;
  projectId: string;
  models: EpdzEntry[];
  nav: DataNav;
}) {
  const { t } = useI18n();
  const viewerRef = useRef<ViewerHandle>(null);
  const [wireOnly, setWireOnly] = useState(false);

  const scene = useMemo(() => {
    if (!box) return null;
    const entry = models[box.modelIndex];
    return entry ? getScene(projectId, box.modelIndex, entry) : null;
  }, [box, projectId, models]);

  // Encuadre sobre el cable con aire alrededor para ver por dónde va la ruta.
  const frameWire = (preset: ViewPreset) => {
    if (!box) return;
    const pad = (axis: number) => Math.max((box.max[axis] - box.min[axis]) * 0.25, 80);
    viewerRef.current?.frameBox(
      [box.min[0] - pad(0), box.min[1] - pad(1), box.min[2] - pad(2)],
      [box.max[0] + pad(0), box.max[1] + pad(1), box.max[2] + pad(2)],
      preset
    );
  };

  // Tras montar la escena: resaltar el cable (recuadro acento) y encuadrarlo.
  useEffect(() => {
    if (!scene || connection.objectId === null) return;
    viewerRef.current?.selectPart(connection.objectId);
    frameWire("front");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, connection.objectId]);

  // Modo "solo el cable": aísla la pieza del hilo, como hace Smart Wiring al
  // separar la conexión de enrutamiento del resto de la construcción.
  useEffect(() => {
    if (!scene || connection.objectId === null) return;
    viewerRef.current?.applyVisibility(new Set(), wireOnly ? connection.objectId : null);
  }, [scene, connection.objectId, wireOnly]);

  const endpoint = (designation: string) =>
    nav.hasDevice(designation.replace(/:[^:]*$/, "")) ? (
      <button
        className="data-link mono"
        title={t("data.viewInSchematic")}
        onClick={() => nav.toDevice(designation.replace(/:[^:]*$/, ""))}
      >
        {designation}
      </button>
    ) : (
      <span className="mono">{designation}</span>
    );

  const facts: [string, string | null][] = [
    [t("data.col.section"), connection.crossSection],
    [t("data.col.color"), connection.color],
    [t("data.col.length"), connection.length],
    [t("data.col.type"), connection.bridge ?? connection.partType],
    [t("data.col.potential"), connection.potential],
  ];

  return (
    <div className="conn-detail">
      <header className="data-card-head strip-detail-head">
        <span className="conn-ends">
          {endpoint(connection.source)}
          <span aria-hidden="true" className="off"> → </span>
          {endpoint(connection.target)}
        </span>
      </header>
      <div className="conn-facts">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <span key={label} className="conn-fact">
              <span className="off">{label}</span> {value}
            </span>
          ))}
      </div>

      {scene ? (
        <div className="strip-3d">
          <Viewer ref={viewerRef} scene={scene} initialPreset="front" />
          <ViewPresets initial="front" onPreset={frameWire} />
          <button
            className={`data-chip wire-only${wireOnly ? " active" : ""}`}
            onClick={() => setWireOnly((value) => !value)}
          >
            {t("data.isolateWire")}
          </button>
        </div>
      ) : (
        <div className="data-note">{t("data.connNo3d")}</div>
      )}
    </div>
  );
}
