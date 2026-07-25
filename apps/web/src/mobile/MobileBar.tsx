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
import { useMobileActions } from "./actions";
import type { ProjectView } from "../state/types";

/**
 * Navegación móvil: un único botón flotante sobre el lienzo (estilo Vercel /
 * Cloudflare) en lugar de barras fijas y pestañas en los bordes. Muestra la
 * vista actual, pasa página con las flechas en esquemas y, al tocarlo, abre un
 * menú con las vistas del proyecto, las acciones que publique la vista activa
 * (páginas, dispositivos, piezas…) y los ajustes.
 */
export function MobileBar() {
  const { state, dispatch, active: doc } = useProjects();
  const { t } = useI18n();
  const extras = useMobileActions();
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
  const current = doc ? views.find((entry) => entry.view === doc.view) ?? null : null;

  const go = (view: ProjectView) => {
    if (doc) dispatch({ type: "SET_VIEW", id: doc.id, view });
    setMenuOpen(false);
  };

  // En esquemas las flechas del botón pasan de página (la acción más frecuente).
  const pageCount = doc && doc.view === "pages" ? doc.pages.length : 0;
  const canPage = pageCount > 1;
  const stepPage = (delta: number) => {
    if (!doc) return;
    const next = Math.min(Math.max(doc.pageIndex + delta, 0), doc.pages.length - 1);
    if (next !== doc.pageIndex) dispatch({ type: "SET_PAGE", id: doc.id, pageIndex: next });
  };

  const Icon = current?.icon ?? IconGear;
  const label = onHome || !current ? t("rail.settings") : current.label;

  return (
    <>
      <div className="mobile-fab">
        {canPage && (
          <button
            className="mobile-fab-arrow"
            aria-label={t("panel.prev")}
            disabled={doc!.pageIndex === 0}
            onClick={() => stepPage(-1)}
          >
            <IconChevronRight size={15} className="flip" />
          </button>
        )}

        <button
          className="mobile-fab-main"
          aria-haspopup="dialog"
          onClick={() => (onHome || !current ? setSettingsOpen(true) : setMenuOpen(true))}
        >
          <Icon size={14} />
          <span>{label}</span>
          {canPage && (
            <span className="mono dim">
              {doc!.pageIndex + 1}/{pageCount}
            </span>
          )}
        </button>

        {canPage && (
          <button
            className="mobile-fab-arrow"
            aria-label={t("panel.next")}
            disabled={doc!.pageIndex >= pageCount - 1}
            onClick={() => stepPage(1)}
          >
            <IconChevronRight size={15} />
          </button>
        )}
      </div>

      {menuOpen && (
        <div className="mobile-menu-wrap" role="dialog" aria-modal onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-grab" aria-hidden />

            {/* Acciones de la vista activa: lo que antes eran pestañas laterales. */}
            {extras.length > 0 && (
              <>
                {extras.map((action) => (
                  <button
                    key={action.id}
                    className="mobile-menu-item"
                    onClick={() => {
                      action.onSelect();
                      setMenuOpen(false);
                    }}
                  >
                    <action.icon size={16} />
                    <span>{action.label}</span>
                    {action.count !== undefined && (
                      <span className="mono count">{action.count}</span>
                    )}
                  </button>
                ))}
                <div className="mobile-menu-sep" />
              </>
            )}

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
                dispatch({ type: "SET_ACTIVE", id: HOME_ID });
                setMenuOpen(false);
              }}
            >
              <IconHome size={16} />
              <span>{t("rail.home")}</span>
            </button>
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
