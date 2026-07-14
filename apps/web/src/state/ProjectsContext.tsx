import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { initialState, projectsReducer } from "./projectsReducer";
import { loadProject } from "./loadProject";
import { evictProject } from "./sceneCache";
import { markSessionTouched } from "../library/session";
import {
  HOME_ID,
  type Action,
  type AppState,
  type LoadedProjectData,
  type ProjectDoc,
  type ProjectSource,
} from "./types";

export interface OpenResult {
  id: string;
  /** null si la carga falló. */
  data: LoadedProjectData | null;
}

export interface ProjectsApi {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** Proyecto activo, o undefined si la pestaña activa es Inicio. */
  active: ProjectDoc | undefined;
  openFile: (name: string, buffer: ArrayBuffer, source: ProjectSource) => Promise<OpenResult>;
  openFiles: (files: FileList | File[] | null) => Promise<void>;
  openDemo: (url: string) => Promise<void>;
  closeProject: (id: string) => void;
}

const ProjectsContext = createContext<ProjectsApi | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectsReducer, initialState);

  const openFile = useCallback(
    async (name: string, buffer: ArrayBuffer, source: ProjectSource): Promise<OpenResult> => {
      const id = crypto.randomUUID();
      markSessionTouched();
      dispatch({ type: "OPEN_START", id, fileName: name, source });
      try {
        const data = await loadProject(name, buffer, (status) =>
          dispatch({ type: "SET_STATUS", status })
        );
        dispatch({ type: "OPEN_SUCCESS", id, data });
        return { id, data };
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: "OPEN_ERROR", id, error: message });
        dispatch({
          type: "SET_STATUS",
          status: { key: "status.loadError", params: { name, message } },
        });
        return { id, data: null };
      }
    },
    []
  );

  const openFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;
      for (const file of [...files]) {
        await openFile(file.name, await file.arrayBuffer(), { kind: "blob" });
      }
    },
    [openFile]
  );

  const openDemo = useCallback(
    async (url: string) => {
      dispatch({ type: "SET_STATUS", status: { key: "status.downloadingDemo" } });
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await openFile(url.split("/").pop() ?? url, await response.arrayBuffer(), {
          kind: "url",
          url,
        });
      } catch (error) {
        dispatch({
          type: "SET_STATUS",
          status: {
            key: "status.demoError",
            params: { message: error instanceof Error ? error.message : String(error) },
          },
        });
      }
    },
    [openFile]
  );

  const closeProject = useCallback(
    (id: string) => {
      markSessionTouched();
      const doc = state.projects.find((p) => p.id === id);
      if (doc) {
        for (const url of doc.imageUrls.values()) URL.revokeObjectURL(url);
        evictProject(id);
      }
      dispatch({ type: "CLOSE", id });
    },
    [state.projects]
  );

  const active = state.projects.find((doc) => doc.id === state.activeId);

  const value = useMemo<ProjectsApi>(
    () => ({ state, dispatch, active, openFile, openFiles, openDemo, closeProject }),
    [state, active, openFile, openFiles, openDemo, closeProject]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsApi {
  const context = useContext(ProjectsContext);
  if (!context) throw new Error("useProjects debe usarse dentro de <ProjectsProvider>");
  return context;
}

export { HOME_ID };
