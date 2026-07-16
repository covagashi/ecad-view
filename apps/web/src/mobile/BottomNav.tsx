import { useState } from "react";
import { HOME_ID, useProjects } from "../state/ProjectsContext";
import { useI18n } from "../i18n";
import { SettingsPanel } from "../shell/SettingsPanel";
import { IconCube, IconGear, IconHome, IconInfo, IconSchematic } from "../shell/icons";
import type { ProjectView } from "../state/types";

/** Navegación inferior en móvil: Inicio / 3D / Esquemas / Proyecto / Ajustes. */
export function BottomNav() {
  const { state, dispatch, active: doc } = useProjects();
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const items: {
    key: string;
    label: string;
    icon: typeof IconHome;
    active: boolean;
    enabled: boolean;
    onClick: () => void;
  }[] = [
    {
      key: "home",
      label: t("rail.home"),
      icon: IconHome,
      active: state.activeId === HOME_ID,
      enabled: true,
      onClick: () => dispatch({ type: "SET_ACTIVE", id: HOME_ID }),
    },
    ...(["3d", "pages", "project"] as ProjectView[]).map((view) => ({
      key: view,
      label:
        view === "3d"
          ? t("rail.3d")
          : view === "pages"
            ? t("rail.schematics")
            : t("rail.project"),
      icon: view === "3d" ? IconCube : view === "pages" ? IconSchematic : IconInfo,
      active: !!doc && state.activeId !== HOME_ID && doc.view === view,
      enabled:
        !!doc &&
        (view === "3d"
          ? doc.modelIndex >= 0
          : view === "pages"
            ? doc.pages.length > 0
            : !!doc.manifest),
      onClick: () => doc && dispatch({ type: "SET_VIEW", id: doc.id, view }),
    })),
  ];

  return (
    <>
      <nav className="bottom-nav">
        {items.map(({ key, label, icon: Icon, active, enabled, onClick }) => (
          <button
            key={key}
            className={active ? "active" : ""}
            disabled={!enabled}
            aria-label={label}
            onClick={onClick}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        <button
          className={settingsOpen ? "active" : ""}
          aria-label={t("rail.settings")}
          onClick={() => setSettingsOpen(true)}
        >
          <IconGear size={18} />
          <span>{t("rail.settings")}</span>
        </button>
      </nav>

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
