import { useMemo, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import { useI18n } from "../i18n";
import { IconCube, IconSearch } from "../shell/icons";
import { buildPositions, pickText } from "./derive";
import type { DataNav } from "./DataView";

/** Posición 3D exacta (mm) de cada componente clasificado del AML. */
export function PositionsView({
  aml,
  lang,
  nav,
}: {
  aml: AmlProject;
  lang: string;
  nav: DataNav;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => buildPositions(aml), [aml]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.designation} ${row.classLabel ?? ""} ${row.partNumber ?? ""} ${row.space ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [rows, filter]);

  if (rows.length === 0) return <div className="data-note">{t("data.empty")}</div>;

  const mm = (value: number) => value.toFixed(1);

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
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("data.col.designation")}</th>
              <th>{t("data.col.space")}</th>
              <th className="num">x</th>
              <th className="num">y</th>
              <th className="num">z</th>
              <th>{t("data.col.description")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
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
                <td className="mono">{row.space ?? "—"}</td>
                <td className="num mono">{mm(row.x)}</td>
                <td className="num mono">{mm(row.y)}</td>
                <td className="num mono">{mm(row.z)}</td>
                <td className="desc">
                  {pickText(row.text, lang) ?? row.classLabel ?? "—"}
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
      <div className="data-note off">{t("data.positionsUnit", { count: filtered.length })}</div>
    </div>
  );
}
