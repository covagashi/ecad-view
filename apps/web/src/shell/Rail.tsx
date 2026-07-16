import { useEffect, useRef, useState } from "react";
import { HOME_ID, useProjects } from "../state/ProjectsContext";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import type { ProjectView } from "../state/types";
import { SettingsPanel } from "./SettingsPanel";
import { IconBolt, IconCube, IconGear, IconHome, IconInfo, IconMoon, IconSchematic, IconSun } from "./icons";

/**
 * Rail izquierdo de navegación: 56 px de ancho en el flujo; al pasar el ratón
 * (o recibir foco de teclado) un panel superpuesto se expande a 220 px con las
 * etiquetas, sin reflow del contenido. En táctil no hay expansión.
 */
export function Rail() {
  const { state, dispatch, active: doc } = useProjects();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);

  // Cierra el popover de ajustes al hacer clic fuera del rail.
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!railRef.current?.contains(e.target as Node)) setSettingsOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [settingsOpen]);

  const setView = (view: ProjectView) => {
    if (doc) dispatch({ type: "SET_VIEW", id: doc.id, view });
  };

  const viewItems: {
    view: ProjectView;
    label: string;
    icon: typeof IconCube;
    enabled: boolean;
  }[] = [
    { view: "3d", label: t("rail.3d"), icon: IconCube, enabled: !!doc && doc.modelIndex >= 0 },
    {
      view: "pages",
      label: t("rail.schematics"),
      icon: IconSchematic,
      enabled: !!doc && doc.pages.length > 0,
    },
    { view: "project", label: t("rail.project"), icon: IconInfo, enabled: !!doc && !!doc.manifest },
  ];

  return (
    <nav ref={railRef} className="rail" aria-label="Covaga">
      <div className={`rail-panel${settingsOpen ? " open" : ""}`}>
        <div className="rail-logo" aria-hidden>
          <span className="rail-logo-mark">
            <IconBolt size={16} />
          </span>
          <span className="rail-label rail-logo-label">
            <strong>Covaga</strong> ECAD Viewer
          </span>
        </div>

        <button
          className={`rail-item${state.activeId === HOME_ID ? " active" : ""}`}
          aria-label={t("rail.home")}
          title={t("rail.home")}
          onClick={() => dispatch({ type: "SET_ACTIVE", id: HOME_ID })}
        >
          <span className="rail-icon">
            <IconHome size={17} />
          </span>
          <span className="rail-label">{t("rail.home")}</span>
        </button>

        {viewItems.map(({ view, label, icon: Icon, enabled }) => (
          <button
            key={view}
            className={`rail-item${doc && state.activeId !== HOME_ID && doc.view === view ? " active" : ""}`}
            aria-label={label}
            title={label}
            disabled={!enabled}
            onClick={() => setView(view)}
          >
            <span className="rail-icon">
              <Icon size={17} />
            </span>
            <span className="rail-label">{label}</span>
          </button>
        ))}

        <div className="rail-spacer" />

        <button
          className="rail-item"
          aria-label={t("rail.theme")}
          title={t("rail.theme")}
          onClick={toggleTheme}
        >
          <span className="rail-icon">
            {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          </span>
          <span className="rail-label">{t("rail.theme")}</span>
        </button>

        <div className="rail-settings">
          {settingsOpen && (
            <div className="rail-pop">
              <SettingsPanel onClose={() => setSettingsOpen(false)} />
            </div>
          )}
          <button
            className={`rail-item${settingsOpen ? " active" : ""}`}
            aria-label={t("rail.settings")}
            title={t("rail.settings")}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <span className="rail-icon">
              <IconGear size={16} />
            </span>
            <span className="rail-label">{t("rail.settings")}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
