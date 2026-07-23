import { useMemo, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import { useI18n } from "../i18n";
import { buildPanelSpaces, buildPositions, type PanelHole, type PanelSpace } from "./derive";

/** Pieza montada en el panel: agrupa los taladros de un mismo propietario. */
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
 * Mecanizado del armario al estilo EPLAN Smart Wiring (Rails & ducts).
 * Al seleccionar una pieza el plano se encuadra sobre su zona a mecanizar
 * (taladros en rojo); el botón de cotas muestra el cuerpo entero con las
 * medidas hasta los bordes del panel.
 */
export function PanelView({ aml }: { aml: AmlProject }) {
  const { t } = useI18n();
  const spaces = useMemo(() => buildPanelSpaces(aml), [aml]);
  const positions = useMemo(() => buildPositions(aml), [aml]);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showDims, setShowDims] = useState(false);

  const space = spaces[Math.min(active, spaces.length - 1)];

  // Piezas del espacio activo: taladros agrupados por propietario, con clase
  // eCl@ss (AML) y longitud real (caja de la pieza en el E3D).
  const parts = useMemo(() => {
    if (!space) return [];
    const byDesignation = new Map(positions.map((row) => [row.designation, row]));
    const byOwner = new Map<string, PanelPart>();
    for (const hole of space.holes) {
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
  }, [space, positions]);

  if (spaces.length === 0) return <div className="data-note">{t("data.empty")}</div>;

  const selectedPart = parts.find((part) => part.designation === selected) ?? null;

  return (
    <div className="data-section">
      <div className="data-chiprow">
        {spaces.map((entry, index) => (
          <button
            key={entry.name}
            className={`data-chip${index === active ? " active" : ""}`}
            onClick={() => {
              setActive(index);
              setSelected(null);
            }}
          >
            {entry.name}
            <span className="badge">{entry.holes.length}</span>
          </button>
        ))}
      </div>

      <div className="data-kpis">
        <span>{t("data.holes", { count: space.holes.length })}</span>
        <span>{t("data.surfaces", { count: space.surfaces })}</span>
        <span>{t("data.restricted", { count: space.restricted })}</span>
      </div>

      <div className="terminals-layout">
        <div className="strip-list">
          {parts.map((part) => (
            <button
              key={part.designation}
              className={`strip-item${selectedPart?.designation === part.designation ? " active" : ""}`}
              onClick={() =>
                setSelected(selectedPart?.designation === part.designation ? null : part.designation)
              }
            >
              <span className="mono name">{part.designation}</span>
              {part.classLabel && (
                <span className="meta">{part.classLabel.replace(/^\S+\s/, "")}</span>
              )}
            </button>
          ))}
          {parts.length === 0 && <div className="data-note">{t("data.empty")}</div>}
        </div>

        <div className="strip-detail">
          {selectedPart && (
            <header className="data-card-head strip-detail-head">
              <span className="mono">{selectedPart.designation}</span>
              <span className="off">
                {[selectedPart.partNumber, selectedPart.classLabel].filter(Boolean).join(" · ")}
              </span>
              <span className="grow" />
              <button
                className={`data-chip${showDims ? " active" : ""}`}
                onClick={() => setShowDims((value) => !value)}
              >
                {t("data.dimensions")}
              </button>
            </header>
          )}
          {space.holes.length > 0 ? (
            <DrillPlan space={space} selected={selectedPart} showDims={showDims && !!selectedPart} />
          ) : (
            <div className="data-note">{t("data.empty")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Plano SVG frontal: origen abajo-izquierda (como ProPanel), y hacia arriba. */
function DrillPlan({
  space,
  selected,
  showDims,
}: {
  space: PanelSpace;
  selected: PanelPart | null;
  showDims: boolean;
}) {
  const { t } = useI18n();
  const pad = 40;
  const width = Math.max(space.maxX - space.minX, 1);
  const height = Math.max(space.maxY - space.minY, 1);

  // Con pieza seleccionada el plano se encuadra sobre su zona a mecanizar;
  // con las cotas activas se vuelve al cuerpo entero para ver las medidas.
  let viewBox = `${space.minX - pad} ${-(space.maxY + pad)} ${width + pad * 2} ${height + pad * 2}`;
  if (selected && !showDims) {
    const zoomPad = Math.max(selected.maxX - selected.minX, selected.maxY - selected.minY, 60) * 0.3;
    viewBox = `${selected.minX - zoomPad} ${-(selected.maxY + zoomPad)} ${
      selected.maxX - selected.minX + zoomPad * 2
    } ${selected.maxY - selected.minY + zoomPad * 2}`;
  }

  // Bordes del panel dibujado (el marco exterior del plano).
  const panel = {
    minX: space.minX - pad / 2,
    maxX: space.maxX + pad / 2,
    minY: space.minY - pad / 2,
    maxY: space.maxY + pad / 2,
  };

  // La pieza seleccionada se dibuja como banda rosa que envuelve sus taladros.
  const margin = 12;
  const band = selected
    ? {
        x0: selected.minX - margin,
        x1: selected.maxX + margin,
        y0: selected.minY - margin,
        y1: selected.maxY + margin,
      }
    : null;

  const fontSize = Math.max(width, height) / 45;

  /** Línea de cota con su etiqueta en mm. */
  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, key: string) => {
    const vertical = x1 === x2;
    return (
      <g key={key} className="plan-dim">
        <line x1={x1} y1={-y1} x2={x2} y2={-y2} />
        <text
          x={(x1 + x2) / 2 + (vertical ? fontSize * 0.45 : 0)}
          y={-((y1 + y2) / 2) - (vertical ? 0 : fontSize * 0.45)}
          textAnchor="middle"
          dominantBaseline={vertical ? "central" : "auto"}
          style={{ fontSize }}
          transform={
            vertical
              ? `rotate(-90 ${(x1 + x2) / 2 + fontSize * 0.45} ${-((y1 + y2) / 2)})`
              : undefined
          }
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="data-plan-wrap">
      <svg
        className="data-plan"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={space.name}
      >
        <rect
          className="plan-outline"
          x={panel.minX}
          y={-panel.maxY}
          width={panel.maxX - panel.minX}
          height={panel.maxY - panel.minY}
          rx={4}
        />
        {band && (
          <rect
            className="plan-part"
            x={band.x0}
            y={-band.y1}
            width={band.x1 - band.x0}
            height={band.y1 - band.y0}
            rx={3}
          />
        )}
        {space.holes.map((hole, i) => {
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
              cy={-hole.y}
              r={Math.max(hole.d / 2, 2)}
            >
              <title>
                {(hole.owner ? `${hole.owner} · ` : "") +
                  `⌀${hole.d || "?"} mm (${hole.x.toFixed(1)}, ${hole.y.toFixed(1)})` +
                  (hole.threaded ? ` · ${t("data.threaded")}` : "")}
              </title>
            </circle>
          );
        })}
        {showDims && band && (
          <>
            {dim(
              panel.minX,
              (band.y0 + band.y1) / 2,
              band.x0,
              (band.y0 + band.y1) / 2,
              `${Math.round(band.x0 - panel.minX)} mm`,
              "left"
            )}
            {dim(
              band.x1,
              (band.y0 + band.y1) / 2,
              panel.maxX,
              (band.y0 + band.y1) / 2,
              `${Math.round(panel.maxX - band.x1)} mm`,
              "right"
            )}
            {dim(
              (band.x0 + band.x1) / 2,
              panel.minY,
              (band.x0 + band.x1) / 2,
              band.y0,
              `${Math.round(band.y0 - panel.minY)} mm`,
              "bottom"
            )}
            {dim(
              (band.x0 + band.x1) / 2,
              band.y1,
              (band.x0 + band.x1) / 2,
              panel.maxY,
              `${Math.round(panel.maxY - band.y1)} mm`,
              "top"
            )}
          </>
        )}
      </svg>
      <div className="data-legend">
        <span>
          <i className="dot drill" /> ⌀ {t("data.legendDrill")}
        </span>
        <span>
          <i className="dot threaded" /> {t("data.legendThreaded")}
        </span>
        <span className="mono">
          {Math.round(width)} × {Math.round(height)} mm
        </span>
      </div>
    </div>
  );
}
