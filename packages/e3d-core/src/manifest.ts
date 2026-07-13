import initSqlJs, { type Database } from "sql.js";

/** Página del proyecto según manifest.db, con su nombre estructurado EPLAN. */
export interface ManifestPage {
  packageId: number;
  /** Nombre base del fichero SVG (sin extensión). */
  name: string;
  /** Fichero SVG asociado (locator del item), si existe. */
  file: string | null;
  /** Segmentos del identificador estructurado (==EES, ++Infrastructure, ...) ya limpios. */
  breadcrumb: string[];
  /** Última parte del identificador: el nombre "humano" de la página. */
  title: string;
  /** Tipo de representación (Multi_line, EFS...). */
  pageType: string | null;
  /** Contador de página (01, 02...). */
  counter: string | null;
}

export interface ManifestProperty {
  /** Id de propiedad EPLAN (ep.XXXXX) si es numérica. */
  propId: number | null;
  /** Nombre simbólico si lo tiene (p. ej. "language"). */
  name: string | null;
  value: string;
}

export interface ManifestInstallationSpace {
  packageId: number;
  name: string;
  /** Fichero .e3d asociado, si existe. */
  file: string | null;
}

export interface EplanManifest {
  schemaVersion: string | null;
  projectName: string | null;
  /** Propiedades del paquete de proyecto (autor, empresa, fecha...). */
  properties: ManifestProperty[];
  pages: ManifestPage[];
  installationSpaces: ManifestInstallationSpace[];
  /** Recuento de packages por tipo (project, page, function, location...). */
  packageCounts: Record<string, number>;
}

export interface ManifestOptions {
  /**
   * URL del binario sql-wasm.wasm. En Vite:
   *   import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url"
   */
  wasmUrl?: string;
}

/** Etiquetas legibles para los ids de propiedad EPLAN más comunes. */
export const EPLAN_PROPERTY_LABELS: Record<number, string> = {
  2000: "Versión de EPLAN",
  3010: "Equipo de creación",
  3011: "Creador",
  10000: "Nombre de proyecto",
  10011: "Descripción de proyecto",
  10013: "Empresa",
  10014: "Nombre de empresa",
  10015: "Dirección",
  10016: "Dirección (línea 1)",
  10017: "Dirección (línea 2)",
  10020: "Fecha de creación",
  10021: "Creado por",
  10022: "Última modificación",
  10023: "Id de proyecto",
  10042: "Año",
};

/**
 * Lee el manifest.db (SQLite) de un .epdz y devuelve la estructura del
 * proyecto: nombre, propiedades, páginas con sus identificadores EPLAN
 * y espacios de montaje con su modelo 3D.
 */
export async function readManifest(
  data: Uint8Array,
  options: ManifestOptions = {}
): Promise<EplanManifest> {
  const SQL = await initSqlJs(
    options.wasmUrl ? { locateFile: () => options.wasmUrl! } : undefined
  );
  const db = new SQL.Database(data);
  try {
    const schemaVersion = scalar(db, "SELECT version FROM database LIMIT 1");
    const projectName = scalar(db, "SELECT name FROM package WHERE type='project' LIMIT 1");

    const packageCounts: Record<string, number> = {};
    for (const [type, count] of rows(db, "SELECT type, COUNT(*) FROM package GROUP BY type")) {
      packageCounts[String(type)] = Number(count);
    }

    const properties: ManifestProperty[] = rows(
      db,
      `SELECT p.propname, p.propid, p.value FROM property p
       JOIN package k ON k.id = p.packageid
       WHERE k.type = 'project' AND p.value IS NOT NULL AND p.value != ''`
    ).map(([name, propId, value]) => ({
      name: name == null ? null : String(name),
      propId: propId == null ? null : Number(propId),
      value: String(value),
    }));

    // Locators de items por package (para asociar página -> SVG, espacio -> E3D).
    const locators = new Map<number, string[]>();
    for (const [packageId, locator] of rows(db, "SELECT packageid, locator FROM item")) {
      const list = locators.get(Number(packageId)) ?? [];
      list.push(String(locator));
      locators.set(Number(packageId), list);
    }

    const pages: ManifestPage[] = rows(
      db,
      `SELECT packageid, name,
              COALESCE(ep1340,''), COALESCE(ep1440,''), COALESCE(ep1140,''),
              COALESCE(ep1240,''), COALESCE(ep1640,''), COALESCE(ep1540,'')
       FROM page_package`
    ).map((row) => {
      const packageId = Number(row[0]);
      const name = String(row[1]);
      const structure = `${row[2]}${row[3]}${row[4]}${row[5]}`;
      const breadcrumb = tokenizeStructure(structure);
      const counter = String(row[6]).replace(/^#/, "") || null;
      const pageType = String(row[7]).replace(/^&/, "") || null;
      const file =
        locators.get(packageId)?.find((l) => l.toLowerCase() === `${name.toLowerCase()}.svg`) ??
        locators.get(packageId)?.find((l) => l.toLowerCase().endsWith(".svg")) ??
        null;
      return {
        packageId,
        name,
        file,
        breadcrumb,
        title: breadcrumb[breadcrumb.length - 1] ?? name,
        pageType,
        counter,
      };
    });

    const installationSpaces: ManifestInstallationSpace[] = rows(
      db,
      "SELECT packageid, name FROM installationspace_package"
    ).map(([packageId, name]) => ({
      packageId: Number(packageId),
      name: String(name),
      file:
        locators.get(Number(packageId))?.find((l) => l.toLowerCase().endsWith(".e3d")) ?? null,
    }));

    return { schemaVersion, projectName, properties, pages, installationSpaces, packageCounts };
  } finally {
    db.close();
  }
}

/**
 * Trocea un identificador estructurado EPLAN ("==EES==Page_macros++Infrastructure...")
 * en segmentos legibles, sustituyendo los separadores por espacios en los nombres.
 */
export function tokenizeStructure(structure: string): string[] {
  const tokens: string[] = [];
  const re = /(?:==|\+\+|\+|&)([^=+&#]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(structure)) !== null) {
    const value = match[1].replace(/_/g, " ").trim();
    if (value) tokens.push(value);
  }
  return tokens;
}

function scalar(db: Database, sql: string): string | null {
  try {
    const result = db.exec(sql);
    const value = result[0]?.values[0]?.[0];
    return value == null ? null : String(value);
  } catch {
    return null;
  }
}

function rows(db: Database, sql: string): (string | number | Uint8Array | null)[][] {
  try {
    return db.exec(sql)[0]?.values ?? [];
  } catch {
    return [];
  }
}
