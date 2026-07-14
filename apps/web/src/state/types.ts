import type { EpdzEntry } from "@covaga/e3d-core/epdz";
import type { EplanManifest } from "@covaga/e3d-core/manifest";
import type { SchematicHighlight } from "../viewer/SchematicViewer";
import type { DeviceIndex } from "../devices";
import type { TranslateParams, TranslationKey } from "../i18n";

export type ProjectView = "3d" | "pages" | "project";

/** Origen del documento; determina si la pestaña puede restaurarse al arrancar. */
export type ProjectSource =
  | { kind: "folder"; folderId: string; relPath: string }
  | { kind: "blob" }
  | { kind: "url"; url: string };

export interface LoadedPage {
  path: string;
  name: string;
  title: string;
  breadcrumb: string[];
  badge: string | null;
  svgText: string;
  /** packageId de manifest.db, para cruzar con functions.pageIds; null sin manifest. */
  packageId: number | null;
}

/** userData de la parte 3D seleccionada (ver builder.ts de e3d-core). */
export interface PickedPart {
  typeId?: number;
  objectId?: number;
  meshId?: number;
  textLines?: string[];
}

/** Mensaje de la barra de estado: clave + parámetros para re-traducir en vivo. */
export interface StatusMessage {
  key: TranslationKey;
  params?: TranslateParams;
}

/** Documento abierto en una pestaña. */
export interface ProjectDoc {
  id: string;
  fileName: string;
  source: ProjectSource;
  loading: boolean;
  error: string | null;
  /** Modelos .e3d disponibles (un .e3d suelto se representa como entrada única). */
  epdzModels: EpdzEntry[];
  pages: LoadedPage[];
  manifest: EplanManifest | null;
  /** nombre de imagen (minúsculas) -> object URL; se revocan al cerrar. */
  imageUrls: Map<string, string>;
  deviceIndex: DeviceIndex;
  // --- Estado de UI por pestaña ---
  view: ProjectView;
  /** Índice en epdzModels; -1 si no hay modelos. */
  modelIndex: number;
  pageIndex: number;
  highlight: SchematicHighlight | null;
  /** Texto informativo de la última referencia cruzada seguida. */
  xrefInfo: string | null;
  picked: PickedPart | null;
}

export const HOME_ID = "home";

export interface AppState {
  projects: ProjectDoc[];
  /** Pestaña activa: id de proyecto o HOME_ID (Inicio). */
  activeId: string;
  status: StatusMessage | null;
}

/** Fragmento que produce loadProject al completarse la carga. */
export type LoadedProjectData = Pick<
  ProjectDoc,
  "epdzModels" | "pages" | "manifest" | "imageUrls" | "deviceIndex" | "view" | "modelIndex"
>;

export type Action =
  | { type: "OPEN_START"; id: string; fileName: string; source: ProjectSource }
  | { type: "OPEN_SUCCESS"; id: string; data: LoadedProjectData }
  | { type: "OPEN_ERROR"; id: string; error: string }
  | { type: "CLOSE"; id: string }
  | { type: "SET_ACTIVE"; id: string }
  | { type: "SET_VIEW"; id: string; view: ProjectView }
  | { type: "SET_MODEL"; id: string; modelIndex: number }
  | { type: "SET_PAGE"; id: string; pageIndex: number }
  | {
      type: "NAVIGATE";
      id: string;
      pageIndex: number;
      highlight: SchematicHighlight | null;
      xrefInfo: string | null;
    }
  | { type: "SET_PICKED"; id: string; picked: PickedPart | null }
  | { type: "SET_STATUS"; status: StatusMessage | null };
