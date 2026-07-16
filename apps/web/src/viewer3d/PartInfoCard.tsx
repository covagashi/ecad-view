import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { pickedLabel, type BridgeTarget } from "../state/bridge";
import type { PickedPart, ProjectDoc } from "../state/types";
import { IconChevronRight, IconClose, IconCube } from "../shell/icons";

export interface PartInfoCardProps {
  doc: ProjectDoc;
  picked: PickedPart;
  bridgeTarget: BridgeTarget;
  isolated: boolean;
  hidden: boolean;
  /** En móvil la tarjeta arranca plegada como botón flotante. */
  compact?: boolean;
  onViewInSchematics: () => void;
  onToggleIsolate: () => void;
  onToggleHidden: () => void;
  onFocus: () => void;
  onClose: () => void;
}

/**
 * Información de la pieza 3D seleccionada. En escritorio, tarjeta flotante;
 * en móvil (compact) se pliega a una píldora flotante que se expande al tocar.
 */
export function PartInfoCard({
  doc,
  picked,
  bridgeTarget,
  isolated,
  hidden,
  compact = false,
  onViewInSchematics,
  onToggleIsolate,
  onToggleHidden,
  onFocus,
  onClose,
}: PartInfoCardProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(!compact);

  // Cada nueva selección en modo compacto vuelve a la píldora plegada.
  useEffect(() => {
    setExpanded(!compact);
  }, [compact, picked]);

  const label =
    pickedLabel(doc, picked) ??
    t("part.part", { id: String(picked.objectId ?? picked.meshId ?? "?") });

  if (compact && !expanded) {
    return (
      <button className="part-chip" onClick={() => setExpanded(true)}>
        <IconCube size={14} className="accent" />
        <span className="part-chip-label">{label}</span>
        <span
          className="part-chip-close"
          role="button"
          aria-label={t("part.close")}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <IconClose size={11} />
        </span>
      </button>
    );
  }
  const secondaryTexts = (picked.textLines ?? [])
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== label)
    .slice(0, 2);

  return (
    <div className="part-card">
      <div className="part-card-head">
        <div className="part-card-title">{label}</div>
        {compact && (
          <button
            className="part-card-close"
            aria-label={t("panel.hide")}
            onClick={() => setExpanded(false)}
          >
            <IconChevronRight size={12} style={{ transform: "rotate(90deg)" }} />
          </button>
        )}
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
          <>
            <button className="part-btn" onClick={onToggleIsolate}>
              {isolated ? t("part.showAll") : t("part.isolate")}
            </button>
            <button className="part-btn" onClick={onToggleHidden}>
              {hidden ? t("part.show") : t("part.hide")}
            </button>
            <button className="part-btn" onClick={onFocus}>
              {t("part.focus")}
            </button>
          </>
        )}
      </div>
      {!bridgeTarget && <div className="part-card-hint">{t("part.noMatch")}</div>}
    </div>
  );
}
