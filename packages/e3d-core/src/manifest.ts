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
  /** Descripción de página (ep.11011) o, en su defecto, última parte del identificador. */
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

/** Función (dispositivo) del proyecto según manifest.db. */
export interface ManifestFunction {
  packageId: number;
  /** Nombre bruto del package, p. ej. "==EES=...+#01-K1_SH_17_4180". */
  name: string;
  /** Designación completa del dispositivo (propiedad ep.20001), si existe. */
  designation: string | null;
  /**
   * Número de artículo/pieza principal (propiedad ep.20100), p. ej.
   * "SIE.5SY4106-7" o "PXC.3022218" (prefijo de fabricante + referencia).
   * null si la función no lleva pieza asociada.
   */
  partNumber: string | null;
  /** Descripción/tipo de la pieza (propiedad ep.20193), si existe. */
  partDescription: string | null;
  /**
   * Id del elemento SVG asociado ("Id17_4180"), derivado del sufijo numérico
   * del nombre. Es el mismo id que usan los enlaces jumpToFunction.
   */
  svgElementId: string | null;
  /** packageIds de las páginas en las que aparece (tabla page_functions). */
  pageIds: number[];
}

/** Ubicación/aspecto de estructura (tabla location_package). */
export interface ManifestLocation {
  packageId: number;
  /** Categoría del aspecto, p. ej. "Lugar de instalación" (viene en el idioma del proyecto). */
  category: string;
  /** Valor dentro de la categoría, p. ej. "DC10V". */
  name: string;
}

export interface EplanManifest {
  schemaVersion: string | null;
  projectName: string | null;
  /** Propiedades del paquete de proyecto (autor, empresa, fecha...). */
  properties: ManifestProperty[];
  pages: ManifestPage[];
  installationSpaces: ManifestInstallationSpace[];
  functions: ManifestFunction[];
  locations: ManifestLocation[];
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

    // page_package solo tiene las columnas de estructura (epXXXX) que usa la
    // configuración de árbol del proyecto (propiedad pages.treeconf), así que
    // la consulta se construye a partir del esquema real de la tabla.
    const pageColumns = new Set(
      rows(db, "PRAGMA table_info(page_package)").map((row) => String(row[1]).toLowerCase())
    );
    const col = (name: string) => (pageColumns.has(name) ? `COALESCE(${name},'')` : "''");
    const structureExpr = ["ep1340", "ep1440", "ep1140", "ep1240"].map(col).join(" || ");

    // Propiedades por página: contador (ep.11000) y descripción (ep.11011).
    const pageProps = new Map<number, { counter?: string; description?: string }>();
    for (const [packageId, propId, value] of rows(
      db,
      `SELECT packageid, propid, value FROM property
       WHERE propid IN (11000, 11011) AND value IS NOT NULL AND value != ''`
    )) {
      const entry = pageProps.get(Number(packageId)) ?? {};
      if (Number(propId) === 11000) entry.counter = String(value);
      else entry.description = String(value);
      pageProps.set(Number(packageId), entry);
    }

    const pages: ManifestPage[] = rows(
      db,
      `SELECT packageid, name, ${structureExpr}, ${col("ep1640")}, ${col("ep1540")}
       FROM page_package`
    ).map((row) => {
      const packageId = Number(row[0]);
      const name = String(row[1]);
      const breadcrumb = tokenizeStructure(String(row[2]));
      const props = pageProps.get(packageId);
      const counter = String(row[3]).replace(/^#/, "") || props?.counter || null;
      const pageType = String(row[4]).replace(/^&/, "") || null;
      const file =
        locators.get(packageId)?.find((l) => l.toLowerCase() === `${name.toLowerCase()}.svg`) ??
        locators.get(packageId)?.find((l) => l.toLowerCase().endsWith(".svg")) ??
        null;
      return {
        packageId,
        name,
        file,
        breadcrumb,
        title: props?.description || breadcrumb[breadcrumb.length - 1] || name,
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

    // Páginas donde aparece cada función (referencias cruzadas).
    const functionPages = new Map<number, number[]>();
    for (const [pageId, functionId] of rows(db, "SELECT pageid, functionid FROM page_functions")) {
      const list = functionPages.get(Number(functionId)) ?? [];
      list.push(Number(pageId));
      functionPages.set(Number(functionId), list);
    }

    // ep.20001 designación, ep.20100 nº de artículo, ep.20193 descripción de la
    // pieza. Una función puede llevar varias piezas (propindex 0,1…); se toma la
    // principal (propindex más bajo, no vacía).
    const firstProp = (propId: number) =>
      `(SELECT p.value FROM property p WHERE p.packageid = k.id AND p.propid = ${propId}` +
      ` AND p.value != '' ORDER BY p.propindex LIMIT 1)`;
    const functions: ManifestFunction[] = rows(
      db,
      `SELECT k.id, k.name, ${firstProp(20001)}, ${firstProp(20100)}, ${firstProp(20193)}
       FROM package k WHERE k.type = 'function'`
    ).map(([packageId, name, designation, partNumber, partDescription]) => {
      // El sufijo "_17_4180" del nombre casa con el id "Id17_4180" del SVG.
      const suffix = /_(\d+)_(\d+)$/.exec(String(name));
      const clean = (value: (typeof designation)) =>
        value == null || value === "" ? null : String(value);
      return {
        packageId: Number(packageId),
        name: String(name),
        designation: clean(designation),
        partNumber: clean(partNumber),
        partDescription: clean(partDescription),
        svgElementId: suffix ? `Id${suffix[1]}_${suffix[2]}` : null,
        pageIds: functionPages.get(Number(packageId)) ?? [],
      };
    });

    // location_package.name viene como "<categoría>-<valor>"; la categoría está
    // en el idioma del proyecto (p. ej. "Lugar de instalación-DC10V").
    const locations: ManifestLocation[] = rows(
      db,
      "SELECT packageid, name FROM location_package"
    ).map(([packageId, name]) => {
      const text = String(name);
      const sep = text.indexOf("-");
      return {
        packageId: Number(packageId),
        category: sep >= 0 ? text.slice(0, sep) : text,
        name: sep >= 0 ? text.slice(sep + 1) : "",
      };
    });

    return {
      schemaVersion,
      projectName,
      properties,
      pages,
      installationSpaces,
      functions,
      locations,
      packageCounts,
    };
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
  const re = /(?:==|=|\+\+|\+|&)([^=+&#]+)/g;
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
