import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { useProjects } from "../state/ProjectsContext";
import { IconSearch } from "../shell/icons";
import { sourceKey, type IndexedFile } from "./db";
import { LibrarySidebar } from "./LibrarySidebar";
import { ProjectCard } from "./ProjectCard";
import { RecentsRow } from "./RecentsRow";
import { useLibrary } from "./useLibrary";

export interface LibraryViewProps {
  dragging: boolean;
}

/**
 * Pantalla de Inicio: biblioteca de proyectos. Con File System Access API
 * muestra las carpetas vinculadas y su índice; sin ella, un modo degradado
 * con recientes y apertura manual de ficheros.
 */
export function LibraryView({ dragging }: LibraryViewProps) {
  const { t } = useI18n();
  const { state, openFiles } = useProjects();
  const library = useLibrary();
  const [scope, setScope] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const openKeys = useMemo(
    () =>
      new Set(state.projects.map((doc) => sourceKey(doc.source)).filter(Boolean) as string[]),
    [state.projects]
  );

  const allFiles = useMemo(() => {
    const rows: { folderId: string; file: IndexedFile }[] = [];
    for (const view of library.folders) {
      if (scope && view.folder.id !== scope) continue;
      for (const file of view.files) rows.push({ folderId: view.folder.id, file });
    }
    const q = query.trim().toLowerCase();
    return q ? rows.filter(({ file }) => file.name.toLowerCase().includes(q)) : rows;
  }, [library.folders, scope, query]);

  const metaLine = (file: IndexedFile): string => {
    const parts: string[] = [];
    if (file.meta) {
      if (file.meta.pages > 0) parts.push(t("status.pages", { count: file.meta.pages }));
      if (file.meta.models > 0) parts.push(t("library.models", { count: file.meta.models }));
    }
    if (file.kind === "e3d" && !file.meta?.models) parts.push(t("library.loosePart"));
    parts.push(formatSize(file.size));
    return parts.join(" · ");
  };

  const openFileButton = (
    <label className="btn primary" style={{ cursor: "pointer" }}>
      {t("app.openFile")}
      <input
        type="file"
        accept=".e3d,.E3d,.epdz"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void openFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );

  return (
    <div className="library">
      {library.supported && (
        <LibrarySidebar
          folders={library.folders}
          scope={scope}
          onScope={setScope}
          onLink={() => void library.linkFolder()}
          onChange={(id) => void library.changeFolder(id)}
          onReindex={(id) => void library.reindexFolder(id)}
          onReconnect={(id) => void library.reconnectFolder(id)}
          onUnlink={(id) => void library.unlinkFolder(id)}
        />
      )}

      <div className="library-main">
        <div className="library-head">
          <h1>{t("library.title")}</h1>
          <div className="library-head-spacer" />
          <div className="library-search">
            <IconSearch size={13} />
            <input
              type="search"
              placeholder={t("library.searchPlaceholder", { count: allFiles.length })}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {openFileButton}
        </div>

        {library.pendingSession && state.projects.length === 0 && (
          <div className="session-banner">
            <span>
              {t("library.restoreHint", { count: library.pendingSession.tabs.length })}
            </span>
            <button className="btn primary" onClick={() => void library.restoreSession()}>
              {t("library.restore")}
            </button>
            <button className="btn quiet" onClick={library.dismissSession}>
              {t("library.dismiss")}
            </button>
          </div>
        )}

        <RecentsRow recents={library.recents} onOpenRecent={(r) => void library.openRecent(r)} />

        <div className="library-section">
          <span>
            {t("library.projectsCount", { count: allFiles.length })}
          </span>
          <span className="rule" />
        </div>

        <div className="library-grid">
          {allFiles.map(({ folderId, file }) => {
            const key = `${folderId}|${file.relPath}`;
            return (
              <ProjectCard
                key={key}
                name={file.name}
                metaLine={metaLine(file)}
                kind={file.kind}
                thumbKey={key}
                active={openKeys.has(key)}
                onOpen={() => void library.openIndexedFile(folderId, file)}
              />
            );
          })}

          <div className={`drop-cell${dragging ? " dragging" : ""}`}>
            <div className="drop-cell-inner">
              <span className="drop-arrow">⇣</span>
              <span>{t("library.dropHere")}</span>
            </div>
          </div>
        </div>

        {!library.supported && (
          <p className="library-fallback-note">{t("library.noFolderSupport")}</p>
        )}

        <div className="library-foot">
          <span className="grow" />
          <span className="privacy mono">{t("drop.privacy")}</span>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
