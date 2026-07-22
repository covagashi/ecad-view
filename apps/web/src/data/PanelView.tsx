import { useMemo, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import { useI18n } from "../i18n";
import { buildPanelSpaces, type PanelSpace } from "./derive";

/**
 * Mecanizado del armario (datos ProPanel del AML): por cada espacio de
 * montaje, un plano frontal con los taladros (círculos a escala) y el
 * recuento de superficies de montaje y zonas restringidas.
 */
export function PanelView({ aml }: { aml: AmlProject }) {
  const { t } = useI18n();
  const spaces = useMemo(() => buildPanelSpaces(aml), [aml]);
  const [active, setActive] = useState(0);

  if (spaces.length === 0) return <div className="data-note">{t("data.empty")}</div>;
  const space = spaces[Math.min(active, spaces.length - 1)];

  return (
    <div className="data-section">
      <div className="data-chiprow">
        {spaces.map((entry, index) => (
          <button
            key={entry.name}
            className={`data-chip${index === active ? " active" : ""}`}
            onClick={() => setActive(index)}
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

      {space.holes.length > 0 ? (
        <DrillPlan space={space} />
      ) : (
        <div className="data-note">{t("data.empty")}</div>
      )}
    </div>
  );
}

/** Plano SVG frontal: origen abajo-izquierda (como ProPanel), y hacia arriba. */
function DrillPlan({ space }: { space: PanelSpace }) {
  const { t } = useI18n();
  const pad = 40;
  const width = Math.max(space.maxX - space.minX, 1);
  const height = Math.max(space.maxY - space.minY, 1);
  const viewBox = `${space.minX - pad} ${-(space.maxY + pad)} ${width + pad * 2} ${height + pad * 2}`;

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
          x={space.minX - pad / 2}
          y={-(space.maxY + pad / 2)}
          width={width + pad}
          height={height + pad}
          rx={4}
        />
        {space.holes.map((hole, i) => (
          <circle
            key={i}
            className={hole.threaded ? "plan-hole threaded" : "plan-hole"}
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
        ))}
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
