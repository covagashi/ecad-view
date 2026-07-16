import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { IconChevronRight, IconClose, IconCube, IconEye, IconEyeOff, IconSearch } from "../shell/icons";
import type { PartEntry } from "./parts";

/** Datos de la pieza seleccionada que se muestran en la cabecera del panel. */
export interface SelectedPart {
  label: string;
  typeId: string;
  objectId: string;
  hasObject: boolean;
  hasBridge: boolean;
  isolated: boolean;
  hidden: boolean;
}

export interface PartsPanelProps {
  parts: PartEntry[];
  hiddenKeys: ReadonlySet<string>;
  isolated: number | null;
  selectedKey: string | null;
  /** Pieza seleccionada (su ficha vive aquí, no flotando sobre el 3D). */
  selected: SelectedPart | null;
  onSelect: (entry: PartEntry) => void;
  onToggleHidden: (entry: PartEntry) => void;
  onShowAll: () => void;
  /** Oculta el panel (colapsa a la pestaña lateral). */
  onHide: () => void;
  onViewInSchematics: () => void;
  onToggleIsolate: () => void;
  onToggleSelectedHidden: () => void;
  onFocusSelected: () => void;
  onDeselect: () => void;
}

/**
 * Panel derecho de la vista 3D: ficha de la pieza seleccionada (con sus
 * acciones) sobre el desglose de aparatos/piezas del modelo, con visibilidad
 * conmutable (ojo), selección y filtro.
 */
export function PartsPanel({
  parts,
  hiddenKeys,
  isolated,
  selectedKey,
  selected,
  onSelect,
  onToggleHidden,
  onShowAll,
  onHide,
  onViewInSchematics,
  onToggleIsolate,
  onToggleSelectedHidden,
  onFocusSelected,
  onDeselect,
}: PartsPanelProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter((p) =>
      (p.label || String(p.objectIds[0])).toLowerCase().includes(q)
    );
  }, [parts, filter]);

  const isEntryVisible = (p: PartEntry) =>
    isolated !== null ? p.objectIds.includes(isolated) : !hiddenKeys.has(p.key);

  const visibleCount = parts.filter(isEntryVisible).length;
  const anyHidden = isolated !== null || hiddenKeys.size > 0;

  return (
    <div className="pages-panel-inner">
      <div className="panel-head">
        <button className="active">{t("parts.title")}</button>
        <span className="grow" />
        <button
          className="panel-tool"
          title={t("panel.hide")}
          aria-label={t("panel.hide")}
          onClick={onHide}
        >
          <IconChevronRight size={13} />
        </button>
      </div>

      {selected && (
        <div className="part-detail">
          <div className="part-detail-head">
            <IconCube size={14} className="part-detail-icon" />
            <span className="part-detail-title">{selected.label}</span>
            <button
              className="part-detail-close"
              aria-label={t("part.close")}
              onClick={onDeselect}
            >
              <IconClose size={13} />
            </button>
          </div>

          <div className="part-detail-ids">
            <span className="kv">
              <span className="k">typeId</span>
              <span className="v mono">{selected.typeId}</span>
            </span>
            <span className="kv">
              <span className="k">objectId</span>
              <span className="v mono">{selected.objectId}</span>
            </span>
          </div>

          <button
            className="part-action primary"
            disabled={!selected.hasBridge}
            title={selected.hasBridge ? undefined : t("part.noMatch")}
            onClick={onViewInSchematics}
          >
            {t("part.viewInSchematics")}
            <span aria-hidden="true">→</span>
          </button>

          {selected.hasObject && (
            <div className="part-action-row">
              <button className="part-action" onClick={onToggleIsolate}>
                {selected.isolated ? t("part.showAll") : t("part.isolate")}
              </button>
              <button className="part-action" onClick={onToggleSelectedHidden}>
                {selected.hidden ? t("part.show") : t("part.hide")}
              </button>
              <button className="part-action" onClick={onFocusSelected}>
                {t("part.focus")}
              </button>
            </div>
          )}

          {!selected.hasBridge && (
            <div className="part-detail-hint">{t("part.noMatch")}</div>
          )}
        </div>
      )}

      <div className="panel-search">
        <IconSearch size={13} />
        <input
          type="search"
          placeholder={t("parts.filter", { count: parts.length })}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="panel-scroll">
        {filtered.map((p) => {
          const visible = isEntryVisible(p);
          return (
            <div
              key={p.key}
              className={`part-row${p.key === selectedKey ? " active" : ""}${visible ? "" : " off"}`}
            >
              <button className="part-row-main" onClick={() => onSelect(p)}>
                <span className="title">
                  {p.label || t("part.part", { id: String(p.objectIds[0]) })}
                </span>
                {p.count > 1 && <span className="badge">{p.count}×</span>}
              </button>
              <button
                className="part-row-eye"
                title={visible ? t("part.hide") : t("part.show")}
                aria-label={visible ? t("part.hide") : t("part.show")}
                onClick={() => onToggleHidden(p)}
              >
                {visible ? <IconEye size={14} /> : <IconEyeOff size={14} />}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="list-empty">{t("parts.none")}</div>}
      </div>

      <div className="panel-foot">
        <span className="mono">
          {t("parts.visibleCount", { visible: visibleCount, total: parts.length })}
        </span>
        <span className="grow" />
        {anyHidden && (
          <button className="part-btn" onClick={onShowAll}>
            {t("part.showAll")}
          </button>
        )}
      </div>
    </div>
  );
}
