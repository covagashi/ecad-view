import { useI18n } from "../i18n";
import { IconFolder } from "../shell/icons";
import type { FolderView } from "./useLibrary";

export interface LibrarySidebarProps {
  folders: FolderView[];
  /** Carpeta seleccionada como ámbito del grid, o null = todas. */
  scope: string | null;
  onScope: (folderId: string | null) => void;
  onLink: () => void;
  onChange: (id: string) => void;
  onReindex: (id: string) => void;
  onReconnect: (id: string) => void;
  onUnlink: (id: string) => void;
}

/**
 * Sidebar de la biblioteca: tarjeta de la carpeta vinculada principal
 * (con Cambiar/Reindexar, como la carpeta de proyectos de Visual Studio),
 * lista de carpetas y enlace para vincular otra.
 */
export function LibrarySidebar({
  folders,
  scope,
  onScope,
  onLink,
  onChange,
  onReindex,
  onReconnect,
  onUnlink,
}: LibrarySidebarProps) {
  const { t } = useI18n();
  const primary = folders.find((f) => f.folder.id === scope) ?? folders[0];

  return (
    <aside className="library-sidebar">
      <div className="library-sidebar-title">{t("library.sidebarTitle")}</div>

      {primary && (
        <div className="folder-card">
          <div className="folder-card-head">
            <IconFolder size={15} className="accent" />
            <span>{t("library.linkedFolder")}</span>
          </div>
          <div className="folder-card-path mono" title={primary.folder.name}>
            {primary.folder.name}
          </div>
          <div className="folder-card-actions">
            {primary.permission === "granted" ? (
              <>
                <button onClick={() => onChange(primary.folder.id)}>{t("library.change")}</button>
                <button className="muted" onClick={() => onReindex(primary.folder.id)}>
                  {t("library.reindex")}
                </button>
              </>
            ) : (
              <button onClick={() => onReconnect(primary.folder.id)}>
                {t("library.reconnect")}
              </button>
            )}
            <button className="muted" onClick={() => onUnlink(primary.folder.id)}>
              {t("library.unlink")}
            </button>
          </div>
        </div>
      )}

      <div className="folder-list">
        <button
          className={`folder-item${scope === null ? " active" : ""}`}
          onClick={() => onScope(null)}
        >
          <IconFolder size={13} />
          <span className="grow">{t("library.allProjects")}</span>
          <span className="count mono">
            {folders.reduce((sum, f) => sum + f.files.length, 0)}
          </span>
        </button>
        {folders.map((view) => (
          <button
            key={view.folder.id}
            className={`folder-item${scope === view.folder.id ? " active" : ""}${
              view.permission !== "granted" ? " stale" : ""
            }`}
            onClick={() =>
              view.permission === "granted" ? onScope(view.folder.id) : onReconnect(view.folder.id)
            }
            title={view.permission !== "granted" ? t("library.reconnect") : view.folder.name}
          >
            <IconFolder size={13} />
            <span className="grow">{view.folder.name}</span>
            {view.permission === "granted" ? (
              <span className="count mono">{view.files.length}</span>
            ) : (
              <span className="count reconnect">{t("library.reconnect")}</span>
            )}
          </button>
        ))}
        <button className="folder-link-more" onClick={onLink}>
          + {t("library.linkAnother")}
        </button>
      </div>

      <div className="library-sidebar-foot mono">{t("library.localNote")}</div>
    </aside>
  );
}
