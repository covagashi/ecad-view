import { useState } from "react";
import type { E3dScene } from "@covaga/e3d-core";
import { useProjects } from "../state/ProjectsContext";
import { buildHashForDoc, shareUrl } from "../state/deeplink";
import { useI18n } from "../i18n";
import { IconCheck, IconLink } from "./icons";

/** Barra de estado inferior: fichero activo, progreso, xref y pieza 3D seleccionada. */
export function StatusBar({ scene }: { scene: E3dScene | null }) {
  const { state, active: doc } = useProjects();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const currentPage = doc?.pages[doc.pageIndex];

  const shareable = doc && !doc.loading && !doc.error;

  const copyLink = async () => {
    if (!shareable) return;
    const url = shareUrl(buildHashForDoc(doc));
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Reserva para contextos sin Clipboard API (webviews antiguos).
        const area = document.createElement("textarea");
        area.value = url;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.warn("No se pudo copiar el enlace:", error);
    }
  };

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
      {shareable && (
        <button
          className={`copy-link${copied ? " copied" : ""}`}
          title={t("action.copyLink")}
          aria-label={t("action.copyLink")}
          onClick={() => void copyLink()}
        >
          {copied ? <IconCheck size={12} /> : <IconLink size={12} />}
          <span>{copied ? t("action.linkCopied") : t("action.copyLink")}</span>
        </button>
      )}
    </footer>
  );
}
