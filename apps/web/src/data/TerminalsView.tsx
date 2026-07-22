import { useMemo, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import type { EplanManifest, ManifestFunction } from "@covaga/e3d-core/manifest";
import { useI18n } from "../i18n";
import { IconSearch } from "../shell/icons";
import { buildTerminalStrips, type TerminalStrip } from "./derive";
import type { PartBoxIndex } from "./partBoxes";
import type { DataNav } from "./DataView";

/**
 * Regletas de bornes. Si el proyecto trae modelos 3D, cada regleta se dibuja
 * como alzado real (proyección frontal 2D del E3D, estilo EPLAN Smart Wiring):
 * los bornes en su posición y tamaño reales, el resto del armario como
 * contexto tenue y los puentes por encima. Sin 3D, un diagrama esquemático.
 */
export function TerminalsView({
  manifest,
  aml,
  partBoxes,
  nav,
}: {
  manifest: EplanManifest | null;
  aml: AmlProject | null;
  partBoxes: PartBoxIndex;
  nav: DataNav;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const strips = useMemo(() => buildTerminalStrips(manifest, aml), [manifest, aml]);
  const functionsById = useMemo(
    () => new Map((manifest?.functions ?? []).map((fn) => [fn.packageId, fn])),
    [manifest]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return strips;
    return strips.filter((strip) => strip.name.toLowerCase().includes(q));
  }, [strips, filter]);

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

      {filtered.map((strip) => (
        <StripCard
          key={strip.name}
          strip={strip}
          functionsById={functionsById}
          partBoxes={partBoxes}
          onPoint={(i) => jumpToPoint(strip, i)}
        />
      ))}
      {filtered.length === 0 && <div className="data-note">{t("data.empty")}</div>}
    </div>
  );
}

/** Borne resuelto a su caja 3D (proyección frontal: x horizontal, z vertical). */
interface FrontTerminal {
  point: string;
  index: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

function StripCard({
  strip,
  functionsById,
  partBoxes,
  onPoint,
}: {
  strip: TerminalStrip;
  functionsById: Map<number, ManifestFunction>;
  partBoxes: PartBoxIndex;
  onPoint: (index: number) => void;
}) {
  const { t } = useI18n();

  // Bornes con pieza 3D: función -> "Id{type}_{object}" -> caja del modelo.
  const front = useMemo(() => {
    const terminals: FrontTerminal[] = [];
    let modelIndex = -1;
    strip.points.forEach((point, index) => {
      const fn = functionsById.get(strip.functionIds[index] ?? -1);
      const match = fn?.svgElementId ? /^Id(\d+)_(\d+)$/.exec(fn.svgElementId) : null;
      const box = match ? partBoxes.get(`${match[1]}_${match[2]}`) : undefined;
      if (!box) return;
      if (modelIndex === -1) modelIndex = box.modelIndex;
      if (box.modelIndex !== modelIndex) return;
      terminals.push({
        point,
        index,
        x0: box.min[0],
        x1: box.max[0],
        z0: box.min[2],
        z1: box.max[2],
      });
    });
    return { terminals, modelIndex };
  }, [strip, functionsById, partBoxes]);

  // El alzado real solo compensa si la mayoría de bornes tienen pieza 3D.
  const useFrontal = front.terminals.length >= Math.max(2, strip.points.length / 2);

  return (
    <section className="data-card">
      <header className="data-card-head">
        <span className="mono">{strip.name}</span>
        <span className="off">
          {t("data.terminalCount", { count: strip.points.length })}
          {strip.bridges.length > 0 &&
            ` · ${t("data.bridgeCount", { count: strip.bridges.length })}`}
          {useFrontal &&
            ` · ${t("data.frontalView")}${
              front.terminals.length < strip.points.length
                ? ` (${front.terminals.length}/${strip.points.length})`
                : ""
            }`}
        </span>
      </header>
      {useFrontal ? (
        <FrontalStrip strip={strip} terminals={front.terminals} onPoint={onPoint} />
      ) : (
        <StripDiagram strip={strip} onPoint={onPoint} />
      )}
    </section>
  );
}

/**
 * Alzado real de la regleta: rectángulos en mm (X/Z del proyecto) por borne,
 * puentes en carriles por encima. Y positiva del SVG hacia abajo: se invierte Z.
 */
function FrontalStrip({
  strip,
  terminals,
  onPoint,
}: {
  strip: TerminalStrip;
  terminals: FrontTerminal[];
  onPoint: (index: number) => void;
}) {
  const byIndex = new Map(terminals.map((terminal) => [terminal.index, terminal]));

  const minX = Math.min(...terminals.map((terminal) => terminal.x0));
  const maxX = Math.max(...terminals.map((terminal) => terminal.x1));
  const minZ = Math.min(...terminals.map((terminal) => terminal.z0));
  const maxZ = Math.max(...terminals.map((terminal) => terminal.z1));

  // Puentes dibujables (ambos extremos con pieza 3D), en carriles sin solape.
  const drawable = strip.bridges.filter(
    (bridge) => byIndex.has(bridge.from) && byIndex.has(bridge.to)
  );
  const lanes: { a: number; b: number }[][] = [];
  const placed = drawable.map((bridge) => {
    const a = (byIndex.get(bridge.from)!.x0 + byIndex.get(bridge.from)!.x1) / 2;
    const b = (byIndex.get(bridge.to)!.x0 + byIndex.get(bridge.to)!.x1) / 2;
    const range = { a: Math.min(a, b), b: Math.max(a, b) };
    let lane = 0;
    for (; ; lane++) {
      const busy = (lanes[lane] ??= []);
      if (busy.every((other) => range.b < other.a || range.a > other.b)) {
        busy.push(range);
        break;
      }
    }
    return { ...bridge, lane, xa: a, xb: b };
  });
  const laneStep = Math.max((maxZ - minZ) * 0.16, 6);
  const top = 4 + lanes.length * laneStep;

  const pad = Math.max((maxX - minX) * 0.03, 4);
  const width = maxX - minX + pad * 2;
  const height = top + (maxZ - minZ) + pad;
  // Escala de pantalla: ~7 px/mm, limitada para que el alzado no desborde
  // ni en ancho (regletas largas) ni en alto (bornes de perfil alto).
  const scale = Math.max(Math.min(7, 1600 / width, 300 / height), 320 / width, 1);
  const pxWidth = width * scale;

  const sx = (x: number) => x - minX + pad;
  const sy = (z: number) => top + (maxZ - z);

  return (
    <div className="strip-scroll">
      <svg
        className="strip-svg frontal"
        width={pxWidth}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={strip.name}
      >
        {terminals.map((terminal) => {
          const w = terminal.x1 - terminal.x0;
          const h = terminal.z1 - terminal.z0;
          const cx = sx(terminal.x0) + w / 2;
          const cy = sy(terminal.z1) + h / 2;
          const vertical = w < h * 0.6;
          return (
            <g
              key={terminal.index}
              className="strip-terminal"
              onClick={() => onPoint(terminal.index)}
              role="button"
              aria-label={`${strip.name}:${terminal.point}`}
            >
              <rect x={sx(terminal.x0)} y={sy(terminal.z1)} width={w} height={h} rx={0.6} />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontSize: Math.min(Math.max((vertical ? w : h) * 0.55, 2.6), 6) }}
                transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}
              >
                {terminal.point}
              </text>
            </g>
          );
        })}
        {placed.map((bridge, i) => {
          const y = top - 3 - bridge.lane * laneStep;
          const anchor = sy(maxZ) + 1;
          const saddle = bridge.kind.toLowerCase().includes("saddle");
          return (
            <g key={i} className={saddle ? "strip-bridge saddle" : "strip-bridge"}>
              <path d={`M ${sx(bridge.xa)} ${anchor} V ${y} H ${sx(bridge.xb)} V ${anchor}`}>
                <title>{`${bridge.kind}: ${strip.points[bridge.from]} – ${strip.points[bridge.to]}`}</title>
              </path>
              <circle cx={sx(bridge.xa)} cy={anchor} r={1.1} />
              <circle cx={sx(bridge.xb)} cy={anchor} r={1.1} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const CELL = 30; // ancho de un borne, px del viewBox
const BOX_H = 46;

/** Diagrama esquemático (fallback sin modelos 3D). */
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
