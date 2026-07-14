import type { EplanManifest } from "@byndr/e3d-core/manifest";
import { useI18n, type TranslationKey } from "./i18n";
import { translations } from "./i18n/translations";

export interface ProjectPanelProps {
  manifest: EplanManifest;
  modelCount: number;
  pageCount: number;
}

/** Ficha del proyecto construida a partir del manifest.db (SQLite) del .epdz. */
export function ProjectPanel({ manifest, modelCount, pageCount }: ProjectPanelProps) {
  const { t } = useI18n();

  const stats: [string, number | undefined][] = [
    [t("project.pages"), pageCount],
    [t("project.models3d"), modelCount],
    [t("project.functions"), manifest.packageCounts["function"]],
    [t("project.locations"), manifest.packageCounts["location"]],
  ];

  const properties = manifest.properties
    .map((prop) => {
      const key = prop.propId != null ? (`prop.${prop.propId}` as TranslationKey) : null;
      return {
        label:
          (key && key in translations.en ? t(key) : null) ||
          prop.name ||
          (prop.propId != null ? `ep.${prop.propId}` : null),
        value: prop.value,
      };
    })
    .filter((p): p is { label: string; value: string } => p.label !== null);

  // Ubicaciones agrupadas por categoría de aspecto (las categorías vienen en
  // el idioma del proyecto, tal cual las guarda manifest.db).
  const locationGroups = new Map<string, string[]>();
  for (const location of manifest.locations) {
    if (!location.name) continue;
    const list = locationGroups.get(location.category) ?? [];
    list.push(location.name);
    locationGroups.set(location.category, list);
  }

  return (
    <div className="project-panel">
      <div className="inner">
        <h1>{manifest.projectName ?? t("project.unnamed")}</h1>
        <p className="sub">
          manifest.db · {t("project.schema")} {manifest.schemaVersion ?? "?"}
          {manifest.installationSpaces.length > 0 &&
            ` · ${t("project.installationSpaces")}: ${manifest.installationSpaces
              .map((s) => s.name)
              .join(", ")}`}
        </p>

        <div className="stat-row">
          {stats
            .filter(([, value]) => value !== undefined && value > 0)
            .map(([label, value]) => (
              <div className="stat" key={label}>
                <div className="num">{value}</div>
                <div className="lbl">{label}</div>
              </div>
            ))}
        </div>

        <h2 className="section-title">{t("project.propertiesTitle")}</h2>
        <div className="kv">
          {properties.map((prop, i) => (
            <div key={i}>
              <span className="k">{prop.label}</span>
              <span className="v">{prop.value}</span>
            </div>
          ))}
          {properties.length === 0 && (
            <div>
              <span className="k">—</span>
              <span className="v">{t("project.noProperties")}</span>
            </div>
          )}
        </div>

        {locationGroups.size > 0 && (
          <>
            <h2 className="section-title" style={{ marginTop: 24 }}>
              {t("project.locations")}
            </h2>
            <div className="kv">
              {[...locationGroups].map(([category, names]) => (
                <div key={category}>
                  <span className="k">{category}</span>
                  <span className="v">{names.sort((a, b) => a.localeCompare(b)).join(", ")}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
