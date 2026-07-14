import { useRef } from "react";
import { HOME_ID, useProjects } from "../state/ProjectsContext";
import { useI18n } from "../i18n";
import { IconClose, IconHome, IconPlus } from "./icons";

/**
 * Tira de pestañas estilo navegador: Inicio + una pestaña por proyecto
 * abierto + botón para abrir otro fichero. El clic central cierra.
 */
export function TabStrip() {
  const { state, dispatch, openFiles, closeProject } = useProjects();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="tabstrip" role="tablist">
      <button
        role="tab"
        aria-selected={state.activeId === HOME_ID}
        className={`tab tab-home${state.activeId === HOME_ID ? " active" : ""}`}
        title={t("tabs.home")}
        onClick={() => dispatch({ type: "SET_ACTIVE", id: HOME_ID })}
      >
        <IconHome size={14} />
      </button>

      <div className="tabstrip-scroll">
        {state.projects.map((doc) => (
          <div
            key={doc.id}
            role="tab"
            aria-selected={state.activeId === doc.id}
            className={`tab${state.activeId === doc.id ? " active" : ""}`}
            title={doc.fileName}
            onClick={() => dispatch({ type: "SET_ACTIVE", id: doc.id })}
            onAuxClick={(e) => {
              if (e.button === 1) closeProject(doc.id);
            }}
          >
            <span
              className={`tab-dot${doc.loading ? " loading" : doc.error ? " error" : ""}`}
              aria-hidden
            />
            <span className="tab-label">{doc.fileName}</span>
            <button
              className="tab-close"
              aria-label={t("tabs.close")}
              onClick={(e) => {
                e.stopPropagation();
                closeProject(doc.id);
              }}
            >
              <IconClose size={11} />
            </button>
          </div>
        ))}
      </div>

      <button
        className="tab-new"
        aria-label={t("app.openFile")}
        title={t("app.openFile")}
        onClick={() => fileInputRef.current?.click()}
      >
        <IconPlus size={14} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".e3d,.E3d,.epdz"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void openFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="tabstrip-spacer" />
    </div>
  );
}
