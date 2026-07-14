import type { E3dScene } from "@covaga/e3d-core";
import { useProjects } from "../state/ProjectsContext";
import { useI18n } from "../i18n";

/** Barra de estado inferior: fichero activo, progreso, xref y pieza 3D seleccionada. */
export function StatusBar({ scene }: { scene: E3dScene | null }) {
  const { state, active: doc } = useProjects();
  const { t } = useI18n();
  const currentPage = doc?.pages[doc.pageIndex];

  return (
    <footer className="statusbar">
      <span className="grow">
        {state.status
          ? t(state.status.key, state.status.params)
          : doc
            ? [
                doc.fileName,
                scene &&
                  `E3D v${scene.formatVersion} · ${t("status.parts", {
                    count: scene.parts.length,
                  })} · ${t("status.meshes", { count: scene.meshes.length })}`,
                doc.pages.length > 0 && t("status.pages", { count: doc.pages.length }),
              ]
                .filter(Boolean)
                .join("  ·  ")
            : t("status.noFile")}
      </span>
      {doc?.view === "pages" && doc.xrefInfo && <span className="pick">{doc.xrefInfo}</span>}
      {doc?.view === "pages" && currentPage && <span className="optional">{currentPage.name}</span>}
      {doc?.view === "3d" && doc.picked && (
        <span className="pick">
          typeId {String(doc.picked.typeId ?? "–")} · objectId {String(doc.picked.objectId ?? "–")}
        </span>
      )}
    </footer>
  );
}
