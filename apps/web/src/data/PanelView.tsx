import { useEffect, useMemo, useRef, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import { useI18n } from "../i18n";
import { buildMountingSurfaces, buildPositions, type PanelHole, type PanelSurface } from "./derive";

/** Pieza montada en la superficie: agrupa los taladros de un mismo propietario. */
interface PanelPart {
  designation: string;
  holes: PanelHole[];
  classLabel: string | null;
  partNumber: string | null;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Mecanizado del armario (ProPanel): elige placa/puerta/lateral, ve el alzado
 * real con taladros y filtra por pieza. Orientado a taller.
 */
export function PanelView({ aml }: { aml: AmlProject }) {
  const { t } = useI18n();
  const surfaces = useMemo(() => buildMountingSurfaces(aml), [aml]);
  const positions = useMemo(() => buildPositions(aml), [aml]);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const surface = surfaces[Math.min(active, surfaces.length - 1)];

  const parts = useMemo(() => {
    if (!surface) return [];
    const byDesignation = new Map(positions.map((row) => [row.designation, row]));
    const byOwner = new Map<string, PanelPart>();
    for (const hole of surface.holes) {
      if (!hole.owner) continue;
      let part = byOwner.get(hole.owner);
      if (!part) {
        const info = byDesignation.get(hole.owner);
        part = {
          designation: hole.owner,
          holes: [],
          classLabel: info?.classLabel ?? null,
          partNumber: info?.partNumber ?? null,
          minX: Infinity,
          maxX: -Infinity,
          minY: Infinity,
          maxY: -Infinity,
        };
        byOwner.set(hole.owner, part);
      }
      part.holes.push(hole);
      part.minX = Math.min(part.minX, hole.x);
      part.maxX = Math.max(part.maxX, hole.x);
      part.minY = Math.min(part.minY, hole.y);
      part.maxY = Math.max(part.maxY, hole.y);
    }
    return [...byOwner.values()].sort((a, b) =>
      a.designation.localeCompare(b.designation, undefined, { numeric: true })
    );
  }, [surface, positions]);

  if (surfaces.length === 0)
    return <div className="data-note empty">{t("data.empty.panel")}</div>;

  const selectedPart = parts.find((part) => part.designation === selected) ?? null;

  return (
    <div className="data-section machining">
      <div className="machining-layout">
        <aside className="machining-plates" aria-label={t("data.tab.panel")}>
          <div className="machining-col-head">{t("data.tab.panel")}</div>
          <div className="machining-plate-list">
            {surfaces.map((entry, index) => {
              const name = surfaceName(entry);
              const activePlate = index === active;
              return (
                <button
                  key={`${entry.space}|${entry.label}|${index}`}
                  type="button"
                  className={`machining-plate${activePlate ? " active" : ""}`}
                  onClick={() => {
                    setActive(index);
                    setSelected(null);
                  }}
                >
                  <span className="machining-plate-icon" aria-hidden="true" />
                  <span className="machining-plate-body">
                    <span className="machining-plate-name">{name}</span>
                    <span className="machining-plate-meta mono">
                      {entry.space} · {Math.round(entry.width)}×{Math.round(entry.height)} mm
                    </span>
                  </span>
                  <span className="machining-plate-count mono">
                    <span className="machining-plate-count-n">{entry.holes.length}</span>
                    <span className="machining-plate-count-u">⌀</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="machining-stage">
          <header className="machining-stage-bar">
            <div className="machining-stage-title">
              <span className="machining-stage-name">{surfaceName(surface)}</span>
              <span className="machining-stage-size mono">
                {Math.round(surface.width)} × {Math.round(surface.height)} mm
              </span>
              <span className="machining-stage-holes mono">⌀ × {surface.holes.length}</span>
            </div>
            {selectedPart && (
              <div className="machining-stage-actions">
                <button
                  type="button"
                  className="machining-toggle"
                  onClick={() => setSelected(null)}
                >
                  × {selectedPart.designation}
                </button>
              </div>
            )}
          </header>

          <div className="data-chiprow machining-mobile-parts">
            {parts.length === 0 ? (
              <div className="machining-empty">{t("data.empty")}</div>
            ) : (
              parts.map((part) => {
                const on = selectedPart === part;
                return (
                  <button
                    key={part.designation}
                    type="button"
                    className={`data-chip${on ? " active" : ""}`}
                    onClick={() => setSelected(on ? null : part.designation)}
                    title={[part.partNumber, part.classLabel].filter(Boolean).join(" · ")}
                  >
                    <span className="mono">{part.designation}</span>
                    <span className="badge mono">{part.holes.length}</span>
                  </button>
                );
              })
            )}
          </div>

          <DrillPlan surface={surface} selected={selectedPart} />
        </div>

        <aside className="machining-parts" aria-label={t("data.parts")}>
          <div className="machining-col-head">
            <span className="mono">{parts.length}</span>
            <span className="machining-col-head-dim"> · {t("data.parts")}</span>
          </div>
          <div className="machining-part-list">
            {parts.length === 0 ? (
              <div className="machining-empty">{t("data.empty")}</div>
            ) : (
              parts.map((part) => {
                const on = selectedPart === part;
                return (
                  <button
                    key={part.designation}
                    type="button"
                    className={`machining-part${on ? " active" : ""}`}
                    onClick={() => setSelected(on ? null : part.designation)}
                    title={[part.partNumber, part.classLabel].filter(Boolean).join(" · ")}
                  >
                    <span className="machining-part-des mono">{part.designation}</span>
                    <span className="machining-part-meta">
                      {part.partNumber && (
                        <span className="mono machining-part-art">{part.partNumber}</span>
                      )}
                      {part.classLabel && (
                        <span className="machining-part-class">{part.classLabel}</span>
                      )}
                    </span>
                    <span className="machining-part-holes mono">{part.holes.length}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatMm(value: number): string {
  return value ? String(Math.round(value * 10) / 10) : "?";
}

function surfaceName(surface: PanelSurface): string {
  const colon = surface.label.indexOf(":");
  return colon === -1 ? surface.label : surface.label.slice(colon + 1);
}

function DrillPlan({
  surface,
  selected,
}: {
  surface: PanelSurface;
  selected: PanelPart | null;
}) {
  const { t } = useI18n();

  const width = Math.max(surface.width, 1);
  const height = Math.max(surface.height, 1);
  const margin = Math.max(width, height) * 0.06;

  let view = { x: -margin, y: -margin, w: width + margin * 2, h: height + margin * 2 };
  if (selected) {
    const zoom = Math.max(selected.maxX - selected.minX, selected.maxY - selected.minY, 60) * 0.4;
    view = {
      x: selected.minX - zoom,
      y: selected.minY - zoom,
      w: selected.maxX - selected.minX + zoom * 2,
      h: selected.maxY - selected.minY + zoom * 2,
    };
  }
  const viewBox = `${view.x} ${height - view.y - view.h} ${view.w} ${view.h}`;
  const flip = (y: number) => height - y;

  const svgRef = useRef<SVGSVGElement>(null);
  const [rendered, setRendered] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => setRendered({ w: svg.clientWidth, h: svg.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const mmPerPx =
    rendered.w > 0 && rendered.h > 0
      ? Math.max(view.w / rendered.w, view.h / rendered.h)
      : Math.max(view.w, view.h) / 320;
  const minRadius = 1.8 * mmPerPx;
  const fontSize = 11 * mmPerPx;
  const gridStep = pickGridStep(Math.max(view.w, view.h));

  const schedule = useMemo(() => {
    const groups = new Map<string, { d: number; threaded: boolean; count: number }>();
    for (const hole of surface.holes) {
      const key = `${hole.threaded}|${hole.d}`;
      const group = groups.get(key) ?? { d: hole.d, threaded: hole.threaded, count: 0 };
      if (group.count === 0) groups.set(key, group);
      group.count += 1;
    }
    return [...groups.values()].sort((a, b) => a.d - b.d || Number(a.threaded) - Number(b.threaded));
  }, [surface]);

  const gridLines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let x = 0; x <= width + 0.01; x += gridStep) {
    gridLines.push({ key: `vx${x}`, x1: x, y1: 0, x2: x, y2: height });
  }
  for (let y = 0; y <= height + 0.01; y += gridStep) {
    gridLines.push({ key: `hy${y}`, x1: 0, y1: y, x2: width, y2: y });
  }

  return (
    <div className="machining-plan">
      <div className="machining-plan-canvas">
        <svg
          ref={svgRef}
          className="data-plan"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={surface.label}
        >
          <rect
            className="plan-backdrop"
            x={view.x}
            y={height - view.y - view.h}
            width={view.w}
            height={view.h}
          />
          <g className="plan-grid">
            {gridLines.map((line) => (
              <line
                key={line.key}
                x1={line.x1}
                y1={flip(line.y1)}
                x2={line.x2}
                y2={flip(line.y2)}
              />
            ))}
          </g>
          <rect className="plan-plate" x={0} y={0} width={width} height={height} rx={0} />
          <rect className="plan-outline" x={0} y={0} width={width} height={height} rx={0} />
          <g className="plan-origin">
            <line x1={0} y1={flip(0)} x2={gridStep * 0.35} y2={flip(0)} />
            <line x1={0} y1={flip(0)} x2={0} y2={flip(gridStep * 0.35)} />
            <text x={gridStep * 0.08} y={flip(gridStep * 0.12)} style={{ fontSize: fontSize * 0.85 }}>
              0
            </text>
          </g>
          {selected && (
            <rect
              className="plan-part"
              x={selected.minX}
              y={flip(selected.maxY)}
              width={Math.max(selected.maxX - selected.minX, minRadius * 2)}
              height={Math.max(selected.maxY - selected.minY, minRadius * 2)}
              rx={0}
            />
          )}
          {surface.holes.map((hole, i) => {
            const owned = selected !== null && hole.owner === selected.designation;
            const dimmed = selected !== null && !owned;
            return (
              <circle
                key={i}
                className={
                  (hole.threaded ? "plan-hole threaded" : "plan-hole") +
                  (owned ? " owned" : dimmed ? " dimmed" : "")
                }
                cx={hole.x}
                cy={flip(hole.y)}
                r={Math.max(hole.d / 2, minRadius)}
              >
                <title>
                  {(hole.owner ? `${hole.owner} · ` : "") +
                    `⌀${hole.d || "?"} mm (${hole.x.toFixed(1)}, ${hole.y.toFixed(1)})` +
                    (hole.threaded ? ` · ${t("data.threaded")}` : "")}
                </title>
              </circle>
            );
          })}
        </svg>
      </div>

      <footer className="machining-plan-foot">
        <div className="machining-schedule">
          {schedule.map((group) => (
            <span
              key={`${group.threaded}|${group.d}`}
              className={`machining-sched-item${group.threaded ? " threaded" : ""}`}
            >
              <i className={group.threaded ? "dot threaded" : "dot drill"} aria-hidden="true" />
              <span className="mono">
                {group.threaded ? "M" : "⌀"}
                {formatMm(group.d)}
              </span>
              <span className="machining-sched-count mono">×{group.count}</span>
            </span>
          ))}
          <span className="machining-sched-size mono">
            {Math.round(surface.width)}×{Math.round(surface.height)} mm
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Paso de rejilla legible según el encuadre (50 / 100 / 200 mm…). */
function pickGridStep(spanMm: number): number {
  if (spanMm <= 400) return 50;
  if (spanMm <= 900) return 100;
  if (spanMm <= 1800) return 200;
  return 250;
}
