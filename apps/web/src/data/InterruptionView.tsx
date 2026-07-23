import { useMemo } from "react";
import type { EplanManifest } from "@covaga/e3d-core/manifest";
import { useI18n } from "../i18n";
import { buildInterruptionGroups } from "./derive";
import type { DataNav } from "./DataView";

/**
 * Validación de puntos de interrupción: agrupados por señal, marcando los
 * sueltos (sin pareja origen/destino) y los que no tienen referencia cruzada
 * resuelta. Cada aparición salta a su símbolo en el esquema.
 */
export function InterruptionView({
  manifest,
  nav,
}: {
  manifest: EplanManifest | null;
  nav: DataNav;
}) {
  const { t } = useI18n();
  const groups = useMemo(() => buildInterruptionGroups(manifest), [manifest]);
  const issues = groups.filter((group) => group.lonely || group.unresolved).length;

  if (groups.length === 0) return <div className="data-note">{t("data.empty")}</div>;

  return (
    <div className="data-section">
      <div className="data-kpis">
        <span>{t("data.ipSummary", { total: groups.length, issues })}</span>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("data.col.signal")}</th>
              <th>{t("data.col.status")}</th>
              <th>{t("data.col.xref")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.designation} className={group.lonely ? "warn" : ""}>
                <td className="mono">{group.designation}</td>
                <td>
                  {group.lonely ? (
                    <span className="data-pill warn">{t("data.status.lonely")}</span>
                  ) : group.unresolved ? (
                    <span className="data-pill warn">{t("data.status.unresolved")}</span>
                  ) : (
                    <span className="data-pill ok">{t("data.status.ok")}</span>
                  )}
                </td>
                <td>
                  {group.refs.length > 0
                    ? group.refs.map((ref) => (
                        <button
                          key={ref.xref}
                          className="data-link mono"
                          title={t("data.viewInSchematic")}
                          onClick={() => nav.toSchematic(ref.pageId, ref.elementId)}
                        >
                          {ref.xref}
                        </button>
                      ))
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
