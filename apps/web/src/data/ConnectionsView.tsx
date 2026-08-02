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
import { isPeWire, wireColorHex } from "./wireColor";

/**
 * Lista de cableado al estilo Smart Wiring: origen → destino, sección y color
 * del hilo, y alzado 3D del cable con sus dos aparatos aislados del armario.
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

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected =
    (selectedIndex !== null ? filtered[selectedIndex] : undefined) ??
    filtered.find((row) => row.partKey !== null && partBoxes.has(row.partKey)) ??
    filtered[0] ??
    null;

  if (connections.length === 0) return <div className="data-note">{t("data.empty")}</div>;

  return (
    <div className="data-section data-section--wide">
      <div className="data-toolbar">
        <div className="panel-search data-search">
          <IconSearch size={14} />
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
        <div className="data-count mono" aria-live="polite">
          {t("data.connCount", { count: filtered.length })}
        </div>
      </div>

      <div className="connections-layout">
        <div className="conn-list" role="listbox" aria-label={t("data.tab.connections")}>
          {filtered.map((row, index) => {
            const active = row === selected;
            const hex = wireColorHex(row.color);
            const pe = isPeWire(row.color);
            return (
              <button
                key={`${row.source}|${row.target}|${index}`}
                type="button"
                role="option"
                aria-selected={active}
                className={`conn-item${active ? " active" : ""}`}
                style={
                  pe
                    ? { borderLeftColor: "#2f9e44" }
                    : hex
                      ? { borderLeftColor: hex }
                      : undefined
                }
                onClick={() => setSelectedIndex(index)}
              >
                <span className="conn-item-ends">
                  <span className="conn-end">{row.source}</span>
                  <span className="conn-arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="conn-end">{row.target}</span>
                  {row.bridge && <span className="data-pill">{t("data.bridge")}</span>}
                </span>
                {row.crossSection && (
                  <span className="wire-section">{row.crossSection}</span>
                )}
                <span className="conn-item-meta">
                  {(hex || pe) && (
                    <span
                      className={`wire-swatch${pe ? " pe" : ""}`}
                      style={hex && !pe ? { background: hex } : undefined}
                      title={row.color ?? undefined}
                      aria-hidden="true"
                    />
                  )}
                  {row.color && <span className="wire-color-label">{row.color}</span>}
                  {row.potential && (
                    <span className="wire-color-label">{row.potential}</span>
                  )}
                  {row.length && !isMobile && (
                    <span className="wire-length">{row.length}</span>
                  )}
                </span>
              </button>
            );
          })}
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
  const hex = wireColorHex(connection.color);
  const pe = isPeWire(connection.color);

  const scene = useMemo(() => {
    if (!box) return null;
    const entry = models[box.modelIndex];
    return entry ? getScene(projectId, box.modelIndex, entry) : null;
  }, [box, projectId, models]);

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

  const endpoint = (designation: string) => {
    const device = designation.replace(/:[^:]*$/, "");
    return nav.hasDevice(device) ? (
      <button
        type="button"
        className="data-link mono"
        title={t("data.viewInSchematic")}
        onClick={() => nav.toDevice(device)}
      >
        {designation}
      </button>
    ) : (
      <span className="mono">{designation}</span>
    );
  };

  const facts: [string, string | null][] = [
    [t("data.col.section"), connection.crossSection],
    [t("data.col.color"), connection.color],
    [t("data.col.length"), connection.length],
    [t("data.col.type"), connection.bridge ?? connection.partType],
    [t("data.col.potential"), connection.potential],
  ];

  return (
    <div className="conn-detail">
      <header className="conn-detail-head">
        <div className="conn-ends">
          {endpoint(connection.source)}
          <span aria-hidden="true" className="conn-arrow">
            →
          </span>
          {endpoint(connection.target)}
        </div>
        {(hex || pe || connection.crossSection) && (
          <div className="conn-wire-badge">
            {(hex || pe) && (
              <span
                className={`wire-swatch lg${pe ? " pe" : ""}`}
                style={hex && !pe ? { background: hex } : undefined}
                aria-hidden="true"
              />
            )}
            {connection.crossSection && (
              <span className="mono wire-section">{connection.crossSection}</span>
            )}
            {connection.color && <span className="mono">{connection.color}</span>}
          </div>
        )}
      </header>

      <dl className="conn-facts">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="conn-fact">
              <dt>{label}</dt>
              <dd className="mono">{value}</dd>
            </div>
          ))}
      </dl>

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
