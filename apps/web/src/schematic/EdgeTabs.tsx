import { useI18n } from "../i18n";
import { IconList, IconSchematic, IconSearch } from "../shell/icons";
import type { PanelTab } from "./PagesPanel";

export interface EdgeTabsProps {
  pageIndex: number;
  pageCount: number;
  hasDevices: boolean;
  hasArticles: boolean;
  onOpen: (tab: PanelTab) => void;
}

/** Pestañas verticales del borde derecho cuando el panel está oculto. */
export function EdgeTabs({ pageIndex, pageCount, hasDevices, hasArticles, onOpen }: EdgeTabsProps) {
  const { t } = useI18n();
  return (
    <div className="edge-tabs">
      <button className="edge-tab primary" onClick={() => onOpen("pages")}>
        <IconSchematic size={14} />
        <span className="edge-label">{t("panel.pages")}</span>
        <span className="edge-count mono">
          {pageIndex + 1}/{pageCount}
        </span>
      </button>
      {hasDevices && (
        <button className="edge-tab" onClick={() => onOpen("devices")}>
          <IconSearch size={14} />
          <span className="edge-label">{t("panel.devices")}</span>
        </button>
      )}
      {hasArticles && (
        <button className="edge-tab" onClick={() => onOpen("bom")}>
          <IconList size={14} />
          <span className="edge-label">{t("panel.bom")}</span>
        </button>
      )}
    </div>
  );
}
