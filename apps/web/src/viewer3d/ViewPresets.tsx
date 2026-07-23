import { useState } from "react";
import { useI18n } from "../i18n";
import { IconFit } from "../shell/icons";
import type { ViewPreset } from "../viewer/Viewer";

export interface ViewPresetsProps {
  onPreset: (preset: ViewPreset) => void;
  /** Preset marcado como activo al montar (iso por defecto). */
  initial?: ViewPreset;
}

const PRESETS: ViewPreset[] = ["iso", "front", "side", "top"];

/** Pills de vistas de cámara (ISO / Frente / Lateral / Planta) + encuadre. */
export function ViewPresets({ onPreset, initial = "iso" }: ViewPresetsProps) {
  const { t } = useI18n();
  const [active, setActive] = useState<ViewPreset>(initial);

  return (
    <div className="view-presets">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          className={`preset${active === preset ? " active" : ""}`}
          onClick={() => {
            setActive(preset);
            onPreset(preset);
          }}
        >
          {t(`preset.${preset}`)}
        </button>
      ))}
      <span className="divider" />
      <button
        className="preset icon"
        aria-label={t("viewer.fit")}
        title={t("viewer.fit")}
        onClick={() => onPreset(active)}
      >
        <IconFit size={13} />
      </button>
    </div>
  );
}
