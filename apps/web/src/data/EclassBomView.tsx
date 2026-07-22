import { useMemo, useState } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import { useI18n } from "../i18n";
import { IconSearch } from "../shell/icons";
import { buildEclassBom, pickText } from "./derive";
import type { DataNav } from "./DataView";

/** BOM agrupado por clase eCl@ss: una tarjeta por clase con sus artículos. */
export function EclassBomView({
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
  const groups = useMemo(() => buildEclassBom(aml), [aml]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        articles: group.articles.filter((article) =>
          `${group.label} ${article.partNumber ?? ""} ${article.devices.join(" ")} ${
            pickText(article.text, lang) ?? ""
          }`
            .toLowerCase()
            .includes(q)
        ),
      }))
      .filter((group) => group.articles.length > 0 || group.label.toLowerCase().includes(q));
  }, [groups, filter, lang]);

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

      {filtered.map((group) => (
        <section key={group.code} className="data-card">
          <header className="data-card-head">
            <span className="data-class">{group.label}</span>
            <span className="badge">{group.total}×</span>
          </header>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("data.col.article")}</th>
                  <th className="num">{t("data.col.qty")}</th>
                  <th>{t("data.col.description")}</th>
                  <th>{t("data.col.devices")}</th>
                </tr>
              </thead>
              <tbody>
                {group.articles.map((article, i) => (
                  <tr key={article.partNumber ?? `-${i}`}>
                    <td className="mono">{article.partNumber ?? "—"}</td>
                    <td className="num">{article.quantity}</td>
                    <td className="desc">{pickText(article.text, lang) ?? "—"}</td>
                    <td className="devices">
                      {article.devices.slice(0, 12).map((designation) =>
                        nav.hasDevice(designation) ? (
                          <button
                            key={designation}
                            className="data-link mono"
                            title={t("data.viewInSchematic")}
                            onClick={() => nav.toDevice(designation)}
                          >
                            {designation}
                          </button>
                        ) : (
                          <span key={designation} className="mono off">
                            {designation}
                          </span>
                        )
                      )}
                      {article.devices.length > 12 && (
                        <span className="off">+{article.devices.length - 12}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {filtered.length === 0 && <div className="data-note">{t("data.empty")}</div>}
    </div>
  );
}
