import { useMemo } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import { useI18n } from "../i18n";
import { IconCube } from "../shell/icons";
import { buildNetwork } from "./derive";
import type { DataNav } from "./DataView";

/** Dispositivos PLC y elementos con interfaces de comunicación del AML. */
export function NetworkView({ aml, nav }: { aml: AmlProject; nav: DataNav }) {
  const { t } = useI18n();
  const rows = useMemo(() => buildNetwork(aml), [aml]);

  if (rows.length === 0) return <div className="data-note">{t("data.empty")}</div>;

  return (
    <div className="data-section">
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("data.col.designation")}</th>
              <th>{t("data.col.class")}</th>
              <th>{t("data.col.article")}</th>
              <th>{t("data.col.space")}</th>
              <th>{t("data.col.interfaces")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.designation}>
                <td>
                  {nav.hasDevice(row.designation) ? (
                    <button
                      className="data-link mono"
                      title={t("data.viewInSchematic")}
                      onClick={() => nav.toDevice(row.designation)}
                    >
                      {row.designation}
                    </button>
                  ) : (
                    <span className="mono">{row.designation}</span>
                  )}
                </td>
                <td className="desc">{row.classLabel ?? "—"}</td>
                <td className="mono">{row.partNumber ?? "—"}</td>
                <td className="mono">{row.space ?? "—"}</td>
                <td>
                  {row.interfaces.length > 0
                    ? row.interfaces.map((name) => (
                        <span key={name} className="data-pill">
                          {name}
                        </span>
                      ))
                    : "—"}
                </td>
                <td className="actions">
                  {nav.has3d(row.designation) && (
                    <button
                      className="data-tool"
                      title={t("device.viewIn3d")}
                      aria-label={t("device.viewIn3d")}
                      onClick={() => nav.to3d(row.designation)}
                    >
                      <IconCube size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
