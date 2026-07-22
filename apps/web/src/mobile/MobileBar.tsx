import { useEffect, useMemo, useState } from "react";
import { HOME_ID, useProjects } from "../state/ProjectsContext";
import { useI18n } from "../i18n";
import { SettingsPanel } from "../shell/SettingsPanel";
import {
  IconChevronRight,
  IconCube,
  IconGear,
  IconHome,
  IconInfo,
  IconList,
  IconSchematic,
} from "../shell/icons";
import type { ProjectView } from "../state/types";

/**
 * Navegación móvil al estilo EPLAN Smart Wiring: en lugar del navbar típico de
 * app, una barra inferior fina ‹ vista › que cicla entre las vistas
 * disponibles; tocar el centro abre un modal con la lista de vistas y los
 * ajustes. Así el lienzo (3D/esquemas) conserva casi toda la pantalla y las
 * barras flotantes de las vistas no compiten con una botonera permanente.
 */
export function MobileBar() {
  const { state, dispatch, active: doc } = useProjects();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Cambiar de pestaña cierra cualquier modal abierto.
  useEffect(() => {
    setMenuOpen(false);
    setSettingsOpen(false);
  }, [state.activeId]);

  const views = useMemo(() => {
    const list: { view: ProjectView; label: string; icon: typeof IconCube }[] = [];
    if (!doc) return list;
    if (doc.modelIndex >= 0) list.push({ view: "3d", label: t("rail.3d"), icon: IconCube });
    if (doc.pages.length > 0)
      list.push({ view: "pages", label: t("rail.schematics"), icon: IconSchematic });
    if (doc.manifest) list.push({ view: "project", label: t("rail.project"), icon: IconInfo });
    if (doc.manifest || doc.amlEntry)
      list.push({ view: "data", label: t("rail.data"), icon: IconList });
    return list;
  }, [doc, t]);

  const onHome = state.activeId === HOME_ID;
  const currentIndex = doc ? views.findIndex((entry) => entry.view === doc.view) : -1;
  const current = currentIndex >= 0 ? views[currentIndex] : null;

  const go = (view: ProjectView) => {
    if (doc) dispatch({ type: "SET_VIEW", id: doc.id, view });
    setMenuOpen(false);
  };
  const step = (delta: number) => {
    if (views.length === 0 || currentIndex < 0) return;
    const next = (currentIndex + delta + views.length) % views.length;
    go(views[next].view);
  };

  return (
    <>
      {/* En Inicio no hay vistas que ciclar: solo el acceso a ajustes. */}
      <div className="mobile-bar">
        {onHome || !current ? (
          <button className="mobile-bar-center" onClick={() => setSettingsOpen(true)}>
            <IconGear size={14} />
            <span>{t("rail.settings")}</span>
          </button>
        ) : (
          <>
            <button
              className="mobile-bar-arrow"
              aria-label={t("panel.prev")}
              disabled={views.length < 2}
              onClick={() => step(-1)}
            >
              <IconChevronRight size={15} className="flip" />
            </button>
            <button
              className="mobile-bar-center"
              aria-haspopup="dialog"
              onClick={() => setMenuOpen(true)}
            >
              <current.icon size={14} />
              <span>{current.label}</span>
              {views.length > 1 && (
                <span className="mono dim">
                  {currentIndex + 1}/{views.length}
                </span>
              )}
            </button>
            <button
              className="mobile-bar-arrow"
              aria-label={t("panel.next")}
              disabled={views.length < 2}
              onClick={() => step(1)}
            >
              <IconChevronRight size={15} />
            </button>
          </>
        )}
      </div>

      {menuOpen && (
        <div className="mobile-menu-wrap" role="dialog" aria-modal onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-grab" aria-hidden />
            <button
              className="mobile-menu-item"
              onClick={() => {
                dispatch({ type: "SET_ACTIVE", id: HOME_ID });
                setMenuOpen(false);
              }}
            >
              <IconHome size={16} />
              <span>{t("rail.home")}</span>
            </button>
            {views.map((entry) => (
              <button
                key={entry.view}
                className={`mobile-menu-item${doc?.view === entry.view ? " active" : ""}`}
                onClick={() => go(entry.view)}
              >
                <entry.icon size={16} />
                <span>{entry.label}</span>
              </button>
            ))}
            <div className="mobile-menu-sep" />
            <button
              className="mobile-menu-item"
              onClick={() => {
                setMenuOpen(false);
                setSettingsOpen(true);
              }}
            >
              <IconGear size={16} />
              <span>{t("rail.settings")}</span>
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-sheet-wrap" onClick={() => setSettingsOpen(false)}>
          <div className="settings-sheet" onClick={(e) => e.stopPropagation()}>
            <SettingsPanel showTheme onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
