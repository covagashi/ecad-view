import { useI18n } from "../i18n";
import { IconFit } from "../shell/icons";

export interface ZoomToolbarProps {
  /** Zoom vigente en % respecto a página completa. */
  percent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

/** Toolbar flotante de zoom del visor de esquemas. */
export function ZoomToolbar({ percent, onZoomIn, onZoomOut, onFit }: ZoomToolbarProps) {
  const { t } = useI18n();
  return (
    <div className="zoom-toolbar">
      <button aria-label={t("zoom.out")} onClick={onZoomOut}>
        −
      </button>
      <span className="mono percent">{Math.round(percent)}%</span>
      <button aria-label={t("zoom.in")} onClick={onZoomIn}>
        +
      </button>
      <span className="divider" />
      <button aria-label={t("zoom.fit")} title={t("zoom.fit")} onClick={onFit}>
        <IconFit size={14} />
      </button>
    </div>
  );
}
