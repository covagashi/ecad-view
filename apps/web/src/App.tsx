import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ProjectView } from "./project/ProjectView";
import { getScene } from "./state/sceneCache";
import { HOME_ID, useProjects } from "./state/ProjectsContext";
import { TabStrip } from "./shell/TabStrip";
import { Rail } from "./shell/Rail";
import { StatusBar } from "./shell/StatusBar";
import { LibraryView } from "./library/LibraryView";
import { scheduleSessionSave } from "./library/session";
import { useSessionRestore } from "./library/useSessionRestore";
import { SchematicsView } from "./schematic/SchematicsView";
import { MobileBar } from "./mobile/MobileBar";
import { MobileActionsProvider } from "./mobile/actions";
import { useDeepLink } from "./state/useDeepLink";
import { useI18n } from "./i18n";

const Viewer3DView = lazy(() =>
  import("./viewer3d/Viewer3DView").then((mod) => ({ default: mod.Viewer3DView }))
);
const DataView = lazy(() =>
  import("./data/DataView").then((mod) => ({ default: mod.DataView }))
);

export function App() {
  const { t } = useI18n();
  const { state, active: doc, openFiles } = useProjects();
  const [dragging, setDragging] = useState(false);

  // Enlaces profundos: hash de la URL ↔ estado de vista.
  useDeepLink();

  // Reabre el último proyecto al arrancar (sin banner ni confirmación).
  useSessionRestore();

  // Persistencia de la sesión de pestañas (con debounce interno).
  useEffect(() => {
    scheduleSessionSave(state);
  }, [state]);

  const scene = useMemo(() => {
    if (!doc || doc.loading || doc.modelIndex < 0) return null;
    const entry = doc.epdzModels[doc.modelIndex];
    return entry ? getScene(doc.id, doc.modelIndex, entry) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, doc?.loading, doc?.modelIndex, doc?.epdzModels]);

  return (
    <MobileActionsProvider>
      <div
        className="app"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void openFiles(e.dataTransfer.files);
        }}
      >
        <TabStrip />

        <div className="app-body">
          <Rail />

          <main className="main">
            {state.activeId === HOME_ID && <LibraryView dragging={dragging} />}

            {doc?.loading && (
              <div className="empty">
                <div className="dropzone">
                  <p>{state.status ? t(state.status.key, state.status.params) : "…"}</p>
                </div>
              </div>
            )}

            {doc?.error && (
              <div className="empty">
                <div className="dropzone">
                  <h1>{doc.fileName}</h1>
                  <p>{doc.error}</p>
                </div>
              </div>
            )}

            {doc && !doc.loading && !doc.error && doc.view === "3d" && (
              <Suspense fallback={null}>
                <Viewer3DView scene={scene} />
              </Suspense>
            )}

            {doc && !doc.loading && !doc.error && doc.view === "pages" && <SchematicsView />}

            {doc && !doc.loading && !doc.error && doc.view === "project" && doc.manifest && (
              <ProjectView />
            )}

            {doc &&
              !doc.loading &&
              !doc.error &&
              doc.view === "data" &&
              (doc.manifest || doc.amlEntry) && (
                <Suspense fallback={null}>
                  <DataView />
                </Suspense>
              )}
          </main>
        </div>

        <StatusBar />
        <MobileBar />
      </div>
    </MobileActionsProvider>
  );
}
