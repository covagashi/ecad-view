import { useEffect, useMemo, useRef, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import type { EplanManifest, ManifestFunction } from "@covaga/e3d-core/manifest";
import type { EpdzEntry } from "@covaga/e3d-core/epdz";
import { Viewer, type ViewerHandle, type ViewPreset } from "../viewer/Viewer";
import { ViewPresets } from "../viewer3d/ViewPresets";
import { getScene } from "../state/sceneCache";
import { useI18n } from "../i18n";
import { IconSearch } from "../shell/icons";
import { buildTerminalStrips, type TerminalStrip } from "./derive";
import type { PartBoxIndex } from "./partBoxes";
import type { DataNav } from "./DataView";

/** Región 3D de una regleta: unión de las cajas de sus bornes. */
interface StripRegion {
  modelIndex: number;
  min: [number, number, number];
  max: [number, number, number];
  located: number;
}

/**
 * Regletas de bornes al estilo EPLAN Smart Wiring: lista de regletas a la
 * izquierda y, para la seleccionada, el 3D real del armario en vista frontal
 * encuadrado sobre la regleta — con el cableado enrutado visible — más el
 * diagrama de puentes. Los bornes del diagrama saltan a su esquema.
 */
export function TerminalsView({
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
  const strips = useMemo(() => buildTerminalStrips(manifest, aml), [manifest, aml]);
  const functionsById = useMemo(
    () => new Map((manifest?.functions ?? []).map((fn) => [fn.packageId, fn])),
    [manifest]
  );

  // Región 3D por regleta (unión de cajas de sus bornes, un solo modelo).
  const regions = useMemo(() => {
    const map = new Map<string, StripRegion>();
    for (const strip of strips) {
      let region: StripRegion | null = null;
      strip.functionIds.forEach((functionId) => {
        const fn = functionsById.get(functionId ?? -1);
        const match = fn?.svgElementId ? /^Id(\d+)_(\d+)$/.exec(fn.svgElementId) : null;
        const box = match ? partBoxes.get(`${match[1]}_${match[2]}`) : undefined;
        if (!box) return;
        if (!region) {
          region = { modelIndex: box.modelIndex, min: [...box.min], max: [...box.max], located: 0 };
        } else if (region.modelIndex !== box.modelIndex) {
          return;
        }
        for (let axis = 0; axis < 3; axis++) {
          if (box.min[axis] < region.min[axis]) region.min[axis] = box.min[axis];
          if (box.max[axis] > region.max[axis]) region.max[axis] = box.max[axis];
        }
        region.located += 1;
      });
      if (region) map.set(strip.name, region);
    }
    return map;
  }, [strips, functionsById, partBoxes]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return strips;
    return strips.filter((strip) => strip.name.toLowerCase().includes(q));
  }, [strips, filter]);

  // Selección: la primera regleta con región 3D (o la primera a secas).
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected =
    filtered.find((strip) => strip.name === selectedName) ??
    filtered.find((strip) => regions.has(strip.name)) ??
    filtered[0] ??
    null;

  if (strips.length === 0) return <div className="data-note">{t("data.empty")}</div>;

  const jumpToPoint = (strip: TerminalStrip, index: number) => {
    const fn = functionsById.get(strip.functionIds[index] ?? -1);
    if (!fn) return;
    nav.toSchematic(fn.pageIds[0] ?? null, fn.svgElementId);
  };

  return (
    <div className="data-section">
      <div className="panel-search data-search">
        <IconSearch size={13} />
        <input
          type="search"
          placeholder={t("data.search")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="terminals-layout">
        <div className="strip-list">
          {filtered.map((strip) => (
            <button
              key={strip.name}
              className={`strip-item${selected?.name === strip.name ? " active" : ""}`}
              onClick={() => setSelectedName(strip.name)}
            >
              <span className="mono name">{strip.name}</span>
              <span className="meta">
                {t("data.terminalCount", { count: strip.points.length })}
                {strip.bridges.length > 0 &&
                  ` · ${t("data.bridgeCount", { count: strip.bridges.length })}`}
              </span>
            </button>
          ))}
          {filtered.length === 0 && <div className="data-note">{t("data.empty")}</div>}
        </div>

        {selected && (
          <div className="strip-detail">
            <StripDetail
              key={selected.name}
              strip={selected}
              region={regions.get(selected.name) ?? null}
              projectId={projectId}
              models={models}
              onPoint={(i) => jumpToPoint(selected, i)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StripDetail({
  strip,
  region,
  projectId,
  models,
  onPoint,
}: {
  strip: TerminalStrip;
  region: StripRegion | null;
  projectId: string;
  models: EpdzEntry[];
  onPoint: (index: number) => void;
}) {
  const { t } = useI18n();
  const viewerRef = useRef<ViewerHandle>(null);

  const scene = useMemo(() => {
    if (!region) return null;
    const entry = models[region.modelIndex];
    return entry ? getScene(projectId, region.modelIndex, entry) : null;
  }, [region, projectId, models]);

  // Región ampliada: aire alrededor de la regleta y profundidad para que el
  // encuadre incluya las mangueras de cables que llegan a los bornes.
  const frameStrip = (preset: ViewPreset) => {
    if (!region) return;
    const pad = (axis: number) => Math.max((region.max[axis] - region.min[axis]) * 0.2, 60);
    viewerRef.current?.frameBox(
      [region.min[0] - pad(0), region.min[1] - pad(1), region.min[2] - pad(2)],
      [region.max[0] + pad(0), region.max[1] + pad(1), region.max[2] + pad(2)],
      preset
    );
  };

  // Al montar la escena el visor encuadra el modelo completo; acto seguido se
  // encuadra la regleta en frontal (el efecto del padre corre tras el del hijo).
  useEffect(() => {
    if (scene) frameStrip("front");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  return (
    <>
      <header className="data-card-head strip-detail-head">
        <span className="mono">{strip.name}</span>
        <span className="off">
          {t("data.terminalCount", { count: strip.points.length })}
          {strip.bridges.length > 0 &&
            ` · ${t("data.bridgeCount", { count: strip.bridges.length })}`}
          {region && ` · ${t("data.frontalView")} (${region.located}/${strip.points.length})`}
        </span>
      </header>

      {scene ? (
        <div className="strip-3d">
          <Viewer ref={viewerRef} scene={scene} initialPreset="front" />
          <ViewPresets initial="front" onPreset={frameStrip} />
        </div>
      ) : (
        <div className="data-note">{t("data.stripNo3d")}</div>
      )}

      <StripDiagram strip={strip} onPoint={onPoint} />
    </>
  );
}

const CELL = 30; // ancho de un borne, px del viewBox
const BOX_H = 46;

/** Diagrama de bornes y puentes; cada borne salta a su esquema. */
function StripDiagram({
  strip,
  onPoint,
}: {
  strip: TerminalStrip;
  onPoint: (index: number) => void;
}) {
  // Carriles de puentes: asignación codiciosa para que no se solapen.
  const lanes: { from: number; to: number }[][] = [];
  const placed = strip.bridges.map((bridge) => {
    let lane = 0;
    for (; ; lane++) {
      const busy = (lanes[lane] ??= []);
      if (busy.every((range) => bridge.to < range.from || bridge.from > range.to)) {
        busy.push(bridge);
        break;
      }
    }
    return { ...bridge, lane };
  });
  const laneCount = lanes.length;
  const top = 10 + laneCount * 12;
  const width = strip.points.length * CELL;
  const height = top + BOX_H + 6;

  return (
    <div className="strip-scroll">
      <svg
        className="strip-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={strip.name}
      >
        {/* Cuerpo de la regleta */}
        <rect className="strip-body" x={0} y={top} width={width} height={BOX_H} rx={3} />
        {strip.points.map((point, i) => (
          <g
            key={point}
            className="strip-terminal"
            onClick={() => onPoint(i)}
            role="button"
            aria-label={`${strip.name}:${point}`}
          >
            <rect x={i * CELL + 1} y={top + 1} width={CELL - 2} height={BOX_H - 2} rx={2} />
            <text
              x={i * CELL + CELL / 2}
              y={top + BOX_H / 2}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {point}
            </text>
          </g>
        ))}
        {/* Puentes */}
        {placed.map((bridge, i) => {
          const x1 = bridge.from * CELL + CELL / 2;
          const x2 = bridge.to * CELL + CELL / 2;
          const y = top - 6 - bridge.lane * 12;
          const saddle = bridge.kind.toLowerCase().includes("saddle");
          return (
            <g key={i} className={saddle ? "strip-bridge saddle" : "strip-bridge"}>
              <path d={`M ${x1} ${top + 4} V ${y} H ${x2} V ${top + 4}`}>
                <title>{`${bridge.kind}: ${strip.points[bridge.from]} – ${strip.points[bridge.to]}`}</title>
              </path>
              <circle cx={x1} cy={top + 4} r={2.4} />
              <circle cx={x2} cy={top + 4} r={2.4} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
