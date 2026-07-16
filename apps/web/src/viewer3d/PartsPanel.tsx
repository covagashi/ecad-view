import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { IconChevronRight, IconEye, IconEyeOff, IconSearch } from "../shell/icons";
import type { PartEntry } from "./parts";

export interface PartsPanelProps {
  parts: PartEntry[];
  hiddenKeys: ReadonlySet<string>;
  isolated: number | null;
  selectedKey: string | null;
  onSelect: (entry: PartEntry) => void;
  onToggleHidden: (entry: PartEntry) => void;
  onShowAll: () => void;
  /** Oculta el panel (colapsa a la pestaña lateral). */
  onHide: () => void;
}

/**
 * Panel derecho de la vista 3D: desglose de aparatos/piezas del modelo activo
 * con visibilidad conmutable (ojo), selección y filtro.
 */
export function PartsPanel({
  parts,
  hiddenKeys,
  isolated,
  selectedKey,
  onSelect,
  onToggleHidden,
  onShowAll,
  onHide,
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
