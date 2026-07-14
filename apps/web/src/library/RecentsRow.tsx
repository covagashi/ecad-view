import { useProjects } from "../state/ProjectsContext";
import { sourceKey, type RecentEntry } from "./db";
import { useI18n } from "../i18n";

export interface RecentsRowProps {
  recents: RecentEntry[];
  onOpenRecent: (recent: RecentEntry) => void;
}

/** Fila de recientes: pestañas abiertas primero, luego últimos proyectos. */
export function RecentsRow({ recents, onOpenRecent }: RecentsRowProps) {
  const { state, dispatch } = useProjects();
  const { t, locale } = useI18n();

  const openKeys = new Set(
    state.projects.map((doc) => sourceKey(doc.source)).filter(Boolean) as string[]
  );
  const closedRecents = recents.filter((r) => !openKeys.has(r.key)).slice(0, 3);

  if (state.projects.length === 0 && closedRecents.length === 0) return null;

  const relative = (timestamp: number): string => {
    const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const minutes = Math.round((timestamp - Date.now()) / 60000);
    if (Math.abs(minutes) < 60) return fmt.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return fmt.format(hours, "hour");
    return fmt.format(Math.round(hours / 24), "day");
  };

  return (
    <>
      <div className="library-section">
        <span>{t("library.recents")}</span>
        <span className="rule" />
      </div>
      <div className="recents-row">
        {state.projects.map((doc) => (
          <button
            key={doc.id}
            className={`recent-chip${state.activeId === doc.id ? " current" : ""}`}
            onClick={() => dispatch({ type: "SET_ACTIVE", id: doc.id })}
            title={doc.fileName}
          >
            <span className="tab-dot" aria-hidden />
            <span className="recent-body">
              <span className="recent-name">{doc.fileName}</span>
              <span className="recent-meta">
                {t("library.openBadge")}
                {doc.pages.length > 0 && ` · ${t("library.pageN", { n: doc.pageIndex + 1 })}`}
              </span>
            </span>
          </button>
        ))}
        {closedRecents.map((recent) => (
          <button
            key={recent.key}
            className="recent-chip"
            onClick={() => onOpenRecent(recent)}
            title={recent.label}
          >
            <span className="tab-dot idle" aria-hidden />
            <span className="recent-body">
              <span className="recent-name">{recent.label}</span>
              <span className="recent-meta">{relative(recent.lastOpened)}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
