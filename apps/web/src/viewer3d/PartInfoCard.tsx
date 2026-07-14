import { useI18n } from "../i18n";
import { pickedLabel, type BridgeTarget } from "../state/bridge";
import type { PickedPart, ProjectDoc } from "../state/types";
import { IconClose } from "../shell/icons";

export interface PartInfoCardProps {
  doc: ProjectDoc;
  picked: PickedPart;
  bridgeTarget: BridgeTarget;
  isolated: boolean;
  onViewInSchematics: () => void;
  onToggleIsolate: () => void;
  onClose: () => void;
}

/** Tarjeta flotante con la información de la pieza 3D seleccionada. */
export function PartInfoCard({
  doc,
  picked,
  bridgeTarget,
  isolated,
  onViewInSchematics,
  onToggleIsolate,
  onClose,
}: PartInfoCardProps) {
  const { t } = useI18n();
  const label =
    pickedLabel(doc, picked) ??
    t("part.part", { id: String(picked.objectId ?? picked.meshId ?? "?") });
  const secondaryTexts = (picked.textLines ?? [])
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== label)
    .slice(0, 2);

  return (
    <div className="part-card">
      <div className="part-card-head">
        <div className="part-card-title">{label}</div>
        <button className="part-card-close" aria-label={t("part.close")} onClick={onClose}>
          <IconClose size={12} />
        </button>
      </div>
      {secondaryTexts.length > 0 && (
        <div className="part-card-sub">{secondaryTexts.join(" · ")}</div>
      )}
      <div className="part-card-ids mono">
        <span>
          typeId <b>{String(picked.typeId ?? "–")}</b>
        </span>
        <span>
          objectId <b>{String(picked.objectId ?? "–")}</b>
        </span>
      </div>
      <div className="part-card-actions">
        <button
          className="part-btn primary"
          disabled={!bridgeTarget}
          title={bridgeTarget ? undefined : t("part.noMatch")}
          onClick={onViewInSchematics}
        >
          {t("part.viewInSchematics")} →
        </button>
        {picked.objectId !== undefined && (
          <button className="part-btn" onClick={onToggleIsolate}>
            {isolated ? t("part.showAll") : t("part.isolate")}
          </button>
        )}
      </div>
      {!bridgeTarget && <div className="part-card-hint">{t("part.noMatch")}</div>}
    </div>
  );
}
