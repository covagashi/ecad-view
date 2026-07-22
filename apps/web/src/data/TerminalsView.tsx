import { useMemo, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import type { EplanManifest } from "@covaga/e3d-core/manifest";
import { useI18n } from "../i18n";
import { IconSearch } from "../shell/icons";
import { buildTerminalStrips, type TerminalStrip } from "./derive";
import type { DataNav } from "./DataView";

/**
 * Regletas de bornes en vista frontal: cada regleta como fila de bornes (a la
 * manera de una regleta real vista de frente) con los puentes dibujados por
 * encima. Los bornes saltan a su símbolo en el esquema.
 */
export function TerminalsView({
  manifest,
  aml,
  nav,
}: {
  manifest: EplanManifest | null;
  aml: AmlProject | null;
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
        <section key={strip.name} className="data-card">
          <header className="data-card-head">
            <span className="mono">{strip.name}</span>
            <span className="off">
              {t("data.terminalCount", { count: strip.points.length })}
              {strip.bridges.length > 0 &&
                ` · ${t("data.bridgeCount", { count: strip.bridges.length })}`}
            </span>
          </header>
          <StripDiagram strip={strip} onPoint={(i) => jumpToPoint(strip, i)} />
        </section>
      ))}
      {filtered.length === 0 && <div className="data-note">{t("data.empty")}</div>}
    </div>
  );
}

const CELL = 30; // ancho de un borne, px del viewBox
const BOX_H = 46;

/** Diagrama frontal de una regleta con los puentes en carriles superiores. */
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
