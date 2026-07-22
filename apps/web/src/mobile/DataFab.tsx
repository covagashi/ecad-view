import { useEffect, useState } from "react";
import { HOME_ID, useProjects } from "../state/ProjectsContext";
import { useI18n } from "../i18n";
import { DataView } from "../data/DataView";
import { IconClose, IconList } from "../shell/icons";

/**
 * Acceso a "Datos" en móvil, al estilo de las webs modernas (Vercel):
 * una pastilla flotante centrada sobre la navegación inferior que abre un
 * modal deslizante con la vista completa. Solo se muestra en pantallas
 * estrechas (CSS) y cuando el proyecto activo tiene manifest o AML.
 */
export function DataFab() {
  const { state, active: doc } = useProjects();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  // Al cambiar de proyecto o volver a Inicio, el modal no debe quedar abierto.
  useEffect(() => {
    setOpen(false);
  }, [state.activeId]);

  const available =
    !!doc &&
    state.activeId !== HOME_ID &&
    !doc.loading &&
    !doc.error &&
    (doc.manifest !== null || doc.amlEntry !== null);
  if (!available) return null;

  return (
    <>
      {!open && (
        <button className="data-fab" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <IconList size={14} />
          <span>{t("rail.data")}</span>
        </button>
      )}

      {open && (
        <div className="data-sheet-wrap" role="dialog" aria-modal onClick={() => setOpen(false)}>
          <div className="data-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="data-sheet-grab" aria-hidden />
            <button
              className="data-sheet-close"
              aria-label={t("part.close")}
              onClick={() => setOpen(false)}
            >
              <IconClose size={16} />
            </button>
            <DataView onNavigateAway={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
