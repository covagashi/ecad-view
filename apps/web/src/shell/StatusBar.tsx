import { useProjects } from "../state/ProjectsContext";
import { useI18n } from "../i18n";

/** Barra de estado inferior: fichero activo, progreso, xref y pieza 3D seleccionada. */
export function StatusBar() {
  const { state, active: doc } = useProjects();
  const { t } = useI18n();
  const currentPage = doc?.pages[doc.pageIndex];

  return (
    <footer className="statusbar">
      <span className="grow">
        {state.status
          ? t(state.status.key, state.status.params)
          : doc
            ? [doc.fileName, doc.pages.length > 0 && t("status.pages", { count: doc.pages.length })]
                .filter(Boolean)
                .join("  ·  ")
            : t("status.noFile")}
      </span>
      {doc?.view === "pages" && doc.xrefInfo && <span className="pick">{doc.xrefInfo}</span>}
      {doc?.view === "pages" && currentPage && <span className="optional">{currentPage.name}</span>}
    </footer>
  );
}
