import { HOME_ID, type Action, type AppState, type ProjectDoc } from "./types";
import { buildDeviceIndex } from "../devices";

export const initialState: AppState = {
  projects: [],
  activeId: HOME_ID,
  status: null,
};

function patchProject(
  state: AppState,
  id: string,
  patch: Partial<ProjectDoc> | ((doc: ProjectDoc) => Partial<ProjectDoc>)
): AppState {
  return {
    ...state,
    projects: state.projects.map((doc) =>
      doc.id === id ? { ...doc, ...(typeof patch === "function" ? patch(doc) : patch) } : doc
    ),
  };
}

export function projectsReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "OPEN_START": {
      const doc: ProjectDoc = {
        id: action.id,
        fileName: action.fileName,
        source: action.source,
        loading: true,
        error: null,
        epdzModels: [],
        pages: [],
        manifest: null,
        imageUrls: new Map(),
        deviceIndex: buildDeviceIndex([]),
        view: "3d",
        modelIndex: -1,
        pageIndex: 0,
        highlight: null,
        xrefInfo: null,
        picked: null,
      };
      return {
        ...state,
        projects: [...state.projects, doc],
        activeId: action.id,
      };
    }
    case "OPEN_SUCCESS":
      return {
        ...patchProject(state, action.id, { ...action.data, loading: false, error: null }),
        status: null,
      };
    case "OPEN_ERROR":
      return patchProject(state, action.id, { loading: false, error: action.error });
    case "CLOSE": {
      const index = state.projects.findIndex((doc) => doc.id === action.id);
      const projects = state.projects.filter((doc) => doc.id !== action.id);
      let activeId = state.activeId;
      if (activeId === action.id) {
        // Activa la pestaña vecina; si no queda ninguna, Inicio.
        const neighbor = projects[Math.min(index, projects.length - 1)];
        activeId = neighbor?.id ?? HOME_ID;
      }
      return { ...state, projects, activeId };
    }
    case "SET_ACTIVE":
      if (action.id !== HOME_ID && !state.projects.some((doc) => doc.id === action.id)) {
        return state;
      }
      return { ...state, activeId: action.id };
    case "SET_VIEW":
      // Ignora vistas sin contenido (p. ej. al restaurar una sesión antigua).
      return patchProject(state, action.id, (doc) => {
        const valid =
          action.view === "3d"
            ? doc.modelIndex >= 0
            : action.view === "pages"
              ? doc.pages.length > 0
              : doc.manifest !== null;
        return valid ? { view: action.view } : {};
      });
    case "SET_MODEL":
      return patchProject(state, action.id, { modelIndex: action.modelIndex, picked: null });
    case "SET_PAGE":
      return patchProject(state, action.id, (doc) => ({
        pageIndex: Math.max(0, Math.min(action.pageIndex, doc.pages.length - 1)),
        highlight: null,
        xrefInfo: null,
      }));
    case "NAVIGATE":
      return patchProject(state, action.id, {
        pageIndex: action.pageIndex,
        highlight: action.highlight,
        xrefInfo: action.xrefInfo,
        view: "pages",
      });
    case "SET_PICKED":
      return patchProject(state, action.id, { picked: action.picked });
    case "SET_STATUS":
      return { ...state, status: action.status };
    default:
      return state;
  }
}
