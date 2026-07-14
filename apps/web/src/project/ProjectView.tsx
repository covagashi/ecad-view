import { useI18n, type TranslationKey } from "../i18n";
import { translations } from "../i18n/translations";
import { useProjects } from "../state/ProjectsContext";
import { IconCube } from "../shell/icons";

/** Ficha del proyecto construida a partir del manifest.db (SQLite) del .epdz. */
export function ProjectView() {
  const { t } = useI18n();
  const { dispatch, active: doc } = useProjects();
  const manifest = doc?.manifest;
  if (!doc || !manifest) return null;

  const stats: [string, number | undefined][] = [
    [t("project.pages"), doc.pages.length],
    [t("project.models3d"), doc.epdzModels.length],
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

  // Modelos 3D vinculados: espacios de montaje del manifest cruzados con los
  // .e3d del archivo; los modelos sin espacio aparecen con su nombre de fichero.
  const modelBase = (path: string) => (path.split("/").pop() ?? path).toLowerCase();
  const linkedModels = doc.epdzModels.map((entry, index) => {
    const space = manifest.installationSpaces.find(
      (s) => s.file && modelBase(s.file) === modelBase(entry.path)
    );
    return {
      index,
      label: space ? space.name : (entry.path.split("/").pop() ?? entry.path),
      file: entry.path.split("/").pop() ?? entry.path,
    };
  });

  const activateModel = (index: number) => {
    dispatch({ type: "SET_MODEL", id: doc.id, modelIndex: index });
    dispatch({ type: "SET_VIEW", id: doc.id, view: "3d" });
  };

  return (
    <div className="project-panel">
      <div className="inner">
        <div className="eyebrow">{t("tabs.project")}</div>
        <h1>{manifest.projectName ?? t("project.unnamed")}</h1>
        <p className="sub">
          manifest.db · {t("project.schema")} {manifest.schemaVersion ?? "?"}
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

        {linkedModels.length > 0 && (
          <>
            <h2 className="section-title" style={{ marginTop: 24 }}>
              {t("project.linkedModels")}
            </h2>
            <div className="model-list">
              {linkedModels.map((model) => (
                <button
                  key={model.index}
                  className={`model-link${model.index === doc.modelIndex ? " active" : ""}`}
                  onClick={() => activateModel(model.index)}
                >
                  <IconCube size={14} />
                  <span className="label">{model.label}</span>
                  <span className="file mono">{model.file}</span>
                  {model.index === doc.modelIndex && (
                    <span className="state mono">{t("project.activeModel")}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

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
