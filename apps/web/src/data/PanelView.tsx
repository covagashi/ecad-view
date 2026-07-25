import { useEffect, useMemo, useRef, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import { useI18n } from "../i18n";
import { useIsMobile } from "../mobile/query";
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
 * Mecanizado del armario al estilo EPLAN ProPanel: se elige una superficie de
 * montaje (placa, puerta, lateral...) y se ve su alzado real -- el rectángulo y
 * las medidas salen del AML, no de la nube de taladros -- con los agujeros que
 * lleva. Al seleccionar una pieza el plano se encuadra sobre su zona y las
 * cotas dan la distancia real de sus taladros a los bordes de la superficie.
 */
export function PanelView({ aml }: { aml: AmlProject }) {
  const { t } = useI18n();
  const surfaces = useMemo(() => buildMountingSurfaces(aml), [aml]);
  const positions = useMemo(() => buildPositions(aml), [aml]);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showDims, setShowDims] = useState(false);

  const surface = surfaces[Math.min(active, surfaces.length - 1)];

  // Piezas de la superficie activa: taladros agrupados por propietario, con su
  // clase eCl@ss y número de artículo.
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

  if (surfaces.length === 0) return <div className="data-note">{t("data.empty")}</div>;

  const selectedPart = parts.find((part) => part.designation === selected) ?? null;

  return (
    <div className="data-section">
      <div className="terminals-layout">
        {/* Superficies mecanizadas del proyecto: la unidad de trabajo del taller. */}
        <div className="strip-list">
          {surfaces.map((entry, index) => (
            <button
              key={`${entry.space}|${entry.label}|${index}`}
              className={`strip-item${index === active ? " active" : ""}`}
              onClick={() => {
                setActive(index);
                setSelected(null);
              }}
            >
              <span className="row">
                <span className="name">{surfaceName(entry)}</span>
                <span className="badge">{entry.holes.length}</span>
              </span>
              <span className="meta">
                <span className="mono">{entry.space}</span> · {Math.round(entry.width)} ×{" "}
                {Math.round(entry.height)} mm
              </span>
            </button>
          ))}
        </div>

        <div className="strip-detail">
          <div className="data-chiprow">
            {/* Elegir pieza solo tiene sentido si la superficie la mecanizan varias. */}
            {parts.length > 1 &&
              parts.map((part) => (
                <button
                  key={part.designation}
                  className={`data-chip${selectedPart === part ? " active" : ""}`}
                  onClick={() => setSelected(selectedPart === part ? null : part.designation)}
                  title={[part.partNumber, part.classLabel].filter(Boolean).join(" · ")}
                >
                  <span className="mono">{part.designation}</span>
                  <span className="badge">{part.holes.length}</span>
                </button>
              ))}
            <button
              className={`data-chip${showDims ? " active" : ""}`}
              onClick={() => setShowDims((value) => !value)}
            >
              {t("data.dimensions")}
            </button>
          </div>
          <DrillPlan surface={surface} selected={selectedPart} showDims={showDims} />
        </div>
      </div>
    </div>
  );
}

/** Caja envolvente de un conjunto de taladros, o null si no hay ninguno. */
function holesBox(holes: PanelHole[]): Box | null {
  if (holes.length === 0) return null;
  const box: Box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const hole of holes) {
    box.minX = Math.min(box.minX, hole.x);
    box.maxX = Math.max(box.maxX, hole.x);
    box.minY = Math.min(box.minY, hole.y);
    box.maxY = Math.max(box.maxY, hole.y);
  }
  return box;
}

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const midX = (box: Box) => (box.minX + box.maxX) / 2;
const midY = (box: Box) => (box.minY + box.maxY) / 2;

/** Milímetros sin decimales inútiles: 6 y no 6,0; 6,5 tal cual. */
function formatMm(value: number): string {
  return value ? String(Math.round(value * 10) / 10) : "?";
}

/** Nombre de la superficie sin el prefijo de espacio ("S2:Puerta" → "Puerta"). */
function surfaceName(surface: PanelSurface): string {
  const colon = surface.label.indexOf(":");
  return colon === -1 ? surface.label : surface.label.slice(colon + 1);
}

/**
 * Alzado de la superficie: su rectángulo real (origen abajo-izquierda, como
 * ProPanel) con los taladros que lleva.
 */
function DrillPlan({
  surface,
  selected,
  showDims,
}: {
  surface: PanelSurface;
  selected: PanelPart | null;
  showDims: boolean;
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  /*
   * Las cotas dibujadas obligan a encuadrar la superficie entera, donde en un
   * teléfono no se lee ni el número ni el taladro: ahí se dan como texto y el
   * plano sigue sobre la pieza.
   */
  const drawDims = showDims && !isMobile;

  const width = Math.max(surface.width, 1);
  const height = Math.max(surface.height, 1);
  const margin = Math.max(width, height) * 0.04;

  // Con pieza seleccionada el plano se encuadra sobre su zona a mecanizar;
  // con las cotas dibujadas se vuelve a la superficie entera.
  let view = { x: -margin, y: -margin, w: width + margin * 2, h: height + margin * 2 };
  if (selected && !drawDims) {
    const zoom = Math.max(selected.maxX - selected.minX, selected.maxY - selected.minY, 60) * 0.35;
    view = {
      x: selected.minX - zoom,
      y: selected.minY - zoom,
      w: selected.maxX - selected.minX + zoom * 2,
      h: selected.maxY - selected.minY + zoom * 2,
    };
  }
  // El SVG crece hacia abajo y la superficie hacia arriba: se invierte la Y.
  const viewBox = `${view.x} ${height - view.y - view.h} ${view.w} ${view.h}`;
  const flip = (y: number) => height - y;

  /*
   * Milímetros por píxel del dibujo: el plano puede abarcar dos metros o el
   * hueco de una pieza, así que taladros y cotas se calculan contra el tamaño
   * real en pantalla; si no, o son de una fracción de píxel o gigantes.
   */
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
  // Radio mínimo modesto: con cien taladros en el encuadre general, un punto
  // más gordo los convierte en una mancha.
  const minRadius = 1.5 * mmPerPx;
  const fontSize = 11 * mmPerPx;

  /** Taladros agrupados por diámetro y tipo (roscado o pasante). */
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

  /*
   * Cotas de la pieza elegida o, si no hay ninguna, de todo el patrón de
   * taladros de la superficie: distancias reales a los bordes de la placa.
   */
  const box = selected ?? holesBox(surface.holes);
  const gaps = box
    ? {
        left: box.minX,
        right: width - box.maxX,
        bottom: box.minY,
        top: height - box.maxY,
      }
    : null;

  /** Línea de cota con su etiqueta en mm. */
  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, key: string) => {
    const vertical = x1 === x2;
    return (
      <g key={key} className="plan-dim">
        <line x1={x1} y1={flip(y1)} x2={x2} y2={flip(y2)} />
        <text
          x={(x1 + x2) / 2 + (vertical ? fontSize * 0.45 : 0)}
          y={flip((y1 + y2) / 2) - (vertical ? 0 : fontSize * 0.45)}
          textAnchor="middle"
          dominantBaseline={vertical ? "central" : "auto"}
          style={{ fontSize }}
          transform={
            vertical
              ? `rotate(-90 ${(x1 + x2) / 2 + fontSize * 0.45} ${flip((y1 + y2) / 2)})`
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
        ref={svgRef}
        className="data-plan"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={surface.label}
      >
        {/* Rectángulo real de la superficie, con las medidas del AML. */}
        <rect className="plan-outline" x={0} y={0} width={width} height={height} rx={4} />
        {selected && (
          <rect
            className="plan-part"
            x={selected.minX}
            y={flip(selected.maxY)}
            width={Math.max(selected.maxX - selected.minX, minRadius * 2)}
            height={Math.max(selected.maxY - selected.minY, minRadius * 2)}
            rx={3}
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
        {drawDims && box && gaps && (
          <>
            {dim(0, midY(box), box.minX, midY(box), `${Math.round(gaps.left)} mm`, "left")}
            {dim(box.maxX, midY(box), width, midY(box), `${Math.round(gaps.right)} mm`, "right")}
            {dim(midX(box), 0, midX(box), box.minY, `${Math.round(gaps.bottom)} mm`, "bottom")}
            {dim(midX(box), box.maxY, midX(box), height, `${Math.round(gaps.top)} mm`, "top")}
          </>
        )}
      </svg>

      {showDims && gaps && (
        <div className="plan-dims mono">
          <span>← {Math.round(gaps.left)} mm</span>
          <span>{Math.round(gaps.right)} mm →</span>
          <span>↓ {Math.round(gaps.bottom)} mm</span>
          <span>↑ {Math.round(gaps.top)} mm</span>
        </div>
      )}

      {/* Cuadro de taladros: cuántos de cada diámetro, como en una hoja de taller. */}
      <div className="data-legend">
        {schedule.map((group) => (
          <span key={`${group.threaded}|${group.d}`}>
            <i className={group.threaded ? "dot threaded" : "dot drill"} />
            <span className="mono">
              {group.threaded ? "M" : "⌀"}
              {formatMm(group.d)} × {group.count}
            </span>
          </span>
        ))}
        <span className="mono">
          {Math.round(surface.width)} × {Math.round(surface.height)} mm
        </span>
      </div>
    </div>
  );
}
