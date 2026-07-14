import type { EpdzEntry } from "@covaga/e3d-core/epdz";
import { IconCube } from "../shell/icons";

export interface ModelSelectorCardProps {
  models: EpdzEntry[];
  modelIndex: number;
  onSelect: (index: number) => void;
}

/** Selector flotante de modelo 3D ("fichero ▾ 1/4"); oculto con un solo modelo. */
export function ModelSelectorCard({ models, modelIndex, onSelect }: ModelSelectorCardProps) {
  if (models.length <= 1) return null;
  return (
    <div className="model-card">
      <IconCube size={14} className="accent" />
      <select value={modelIndex} onChange={(e) => onSelect(Number(e.target.value))}>
        {models.map((entry, i) => (
          <option key={entry.path} value={i}>
            {entry.path.split("/").pop()}
          </option>
        ))}
      </select>
      <span className="count mono">
        {modelIndex + 1} / {models.length}
      </span>
    </div>
  );
}
