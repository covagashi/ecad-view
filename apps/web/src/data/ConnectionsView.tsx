import { useEffect, useMemo, useRef, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import type { EplanManifest } from "@covaga/e3d-core/manifest";
import type { EpdzEntry } from "@covaga/e3d-core/epdz";
import { Viewer, type ViewerHandle } from "../viewer/Viewer";
import { getScene } from "../state/sceneCache";
import { useI18n } from "../i18n";
import { useIsMobile } from "../mobile/query";
import { IconSearch } from "../shell/icons";
import { buildConnections, type ConnectionRow } from "./derive";
import type { PartBoxIndex, PartBox } from "./partBoxes";
import type { DataNav } from "./DataView";

/**
 * Lista de conexiones de cableado al estilo EPLAN Smart Wiring: tabla de
 * origen/destino y, para la conexión seleccionada, un alzado fijo del cable
 * enrutado con sus dos aparatos, aislado del resto del armario. Origen y
 * destino saltan a su aparición en el esquema.
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
  const isMobile = useIsMobile();
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
          aria-label={t("data.search")}
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
                {!isMobile && <th>{t("data.col.section")}</th>}
                {!isMobile && <th>{t("data.col.color")}</th>}
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
                  {!isMobile && <td>{row.crossSection ?? "—"}</td>}
                  {!isMobile && <td className="mono">{row.color ?? "—"}</td>}
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

  const scene = useMemo(() => {
    if (!box) return null;
    const entry = models[box.modelIndex];
    return entry ? getScene(projectId, box.modelIndex, entry) : null;
  }, [box, projectId, models]);

  /*
   * La conexión se muestra siempre aislada, como en Smart Wiring: el hilo y
   * los aparatos de origen y destino, sin el resto del armario, en alzado fijo
   * y encuadrado sobre ellos (no hay nada que orbitar ni que aislar a mano).
   */
  useEffect(() => {
    if (!scene || connection.objectId === null || !box) return;
    const visible = new Set<number>([connection.objectId]);
    for (const designation of [connection.source, connection.target]) {
      const target = nav.resolve3d(designation.replace(/:[^:]*$/, ""));
      if (target && target.modelIndex === box.modelIndex) visible.add(target.objectId);
    }
    const viewer = viewerRef.current;
    viewer?.applyVisibility(new Set(), visible);
    viewer?.frameParts(visible, "front");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, connection]);

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
          <Viewer ref={viewerRef} scene={scene} initialPreset="front" interactive={false} />
        </div>
      ) : (
        <div className="data-note">{t("data.connNo3d")}</div>
      )}
    </div>
  );
}
