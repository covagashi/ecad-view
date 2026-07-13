import type { EplanManifest } from "@byndr/e3d-core/manifest";
import { EPLAN_PROPERTY_LABELS } from "@byndr/e3d-core/manifest";

export interface ProjectPanelProps {
  manifest: EplanManifest;
  modelCount: number;
  pageCount: number;
}

/** Ficha del proyecto construida a partir del manifest.db (SQLite) del .epdz. */
export function ProjectPanel({ manifest, modelCount, pageCount }: ProjectPanelProps) {
  const stats: [string, number | undefined][] = [
    ["Páginas", pageCount],
    ["Modelos 3D", modelCount],
    ["Funciones", manifest.packageCounts["function"]],
    ["Ubicaciones", manifest.packageCounts["location"]],
  ];

  const properties = manifest.properties
    .map((prop) => ({
      label:
        (prop.propId != null && EPLAN_PROPERTY_LABELS[prop.propId]) ||
        prop.name ||
        (prop.propId != null ? `ep.${prop.propId}` : null),
      value: prop.value,
    }))
    .filter((p): p is { label: string; value: string } => p.label !== null);

  return (
    <div className="project-panel">
      <div className="inner">
        <h1>{manifest.projectName ?? "Proyecto sin nombre"}</h1>
        <p className="sub">
          manifest.db · esquema {manifest.schemaVersion ?? "?"}
          {manifest.installationSpaces.length > 0 &&
            ` · espacios de montaje: ${manifest.installationSpaces
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

        <h2 className="section-title">Propiedades del proyecto</h2>
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
              <span className="v">Sin propiedades registradas</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
