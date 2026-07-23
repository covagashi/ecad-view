import { useMemo, useRef, useState } from "react";
import { useProjects } from "../state/ProjectsContext";
import { useI18n } from "../i18n";
import { useAml } from "../aml/useAml";
import { buildDeviceTo3dIndex, findDeviceByDesignation } from "../state/bridge";
import { getPartLocations } from "../state/partLocator";
import { stashPendingPick } from "../state/deeplink";
import { getPartBoxes, type PartBoxIndex } from "./partBoxes";
import { resolveAmlLang } from "./lang";
import { pickText } from "./derive";
import { EclassBomView } from "./EclassBomView";
import { PanelView } from "./PanelView";
import { ConnectionsView } from "./ConnectionsView";
import { NetworkView } from "./NetworkView";
import { PositionsView } from "./PositionsView";
import { InterruptionView } from "./InterruptionView";

export type DataTab = "bom" | "panel" | "connections" | "network" | "positions" | "ipoints";

/** Acciones de navegación que las pestañas usan para saltar a esquemas/3D. */
export interface DataNav {
  /** Salta a una página (por packageId del manifest) resaltando un elemento. */
  toSchematic: (pageId: number | null, elementId: string | null) => void;
  /** Salta a la primera aparición de una designación en los esquemas. */
  toDevice: (designation: string) => void;
  hasDevice: (designation: string) => boolean;
  /** Salta a la pieza 3D de una designación (si la tiene). */
  to3d: (designation: string) => void;
  has3d: (designation: string) => boolean;
  /** Pieza 3D (modelo + objectId) de una designación, si existe. */
  resolve3d: (designation: string) => { modelIndex: number; objectId: number } | null;
}

/**
 * Vista "Datos": lo que el AutomationML y el manifest.db saben del proyecto
 * más allá de páginas y modelos — BOM por clase eCl@ss, mecanizado del armario
 * (ProPanel), conexiones de cableado con su cable en 3D, dispositivos de
 * red/PLC, posiciones de montaje y validación de puntos de interrupción.
 * Se usa como vista completa (escritorio) y dentro del modal móvil.
 */
export function DataView({ onNavigateAway }: { onNavigateAway?: () => void }) {
  const { dispatch, active: doc } = useProjects();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<DataTab>(() =>
    doc?.aml || doc?.amlEntry ? "bom" : "connections"
  );
  const nonceRef = useRef(0);

  // Parseo perezoso del AutomationML al entrar por primera vez.
  useAml(doc ?? null);

  const aml = doc?.aml ?? null;
  const manifest = doc?.manifest ?? null;

  // Idioma de proyecto: se elige en Ajustes; aquí solo se resuelve.
  const lang = useMemo(
    () => resolveAmlLang(aml, doc?.amlLang, locale),
    [aml, doc?.amlLang, locale]
  );

  // Índice esquema→3D (mismo mecanismo que la vista de esquemas).
  const partLocations = useMemo(
    () => (doc?.manifest ? getPartLocations(doc.id, doc.epdzModels) : new Map<string, number>()),
    [doc?.id, doc?.manifest, doc?.epdzModels]
  );
  const deviceTo3d = useMemo(
    () => buildDeviceTo3dIndex(doc?.deviceIndex.devices ?? [], manifest, partLocations),
    [doc?.deviceIndex, manifest, partLocations]
  );

  // Cajas 3D por pieza para localizar el cable de cada conexión; bajo demanda.
  const partBoxes = useMemo<PartBoxIndex>(
    () =>
      tab === "connections" && doc && doc.epdzModels.length > 0
        ? getPartBoxes(doc.id, doc.epdzModels)
        : new Map(),
    [tab, doc?.id, doc?.epdzModels]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  );

  if (!doc) return null;

  const nav: DataNav = {
    toSchematic: (pageId, elementId) => {
      const pageIndex = pageId == null ? -1 : doc.pages.findIndex((p) => p.packageId === pageId);
      if (pageIndex < 0) return;
      dispatch({
        type: "NAVIGATE",
        id: doc.id,
        pageIndex,
        highlight: elementId ? { elementId, nonce: ++nonceRef.current } : null,
        xrefInfo: null,
      });
      onNavigateAway?.();
    },
    toDevice: (designation) => {
      const device = findDeviceByDesignation(doc.deviceIndex, designation);
      const occurrence = device?.occurrences[0];
      if (!device || !occurrence) return;
      dispatch({
        type: "NAVIGATE",
        id: doc.id,
        pageIndex: occurrence.pageIndex,
        highlight: { elementId: occurrence.elementId, nonce: ++nonceRef.current },
        xrefInfo: device.label,
      });
      onNavigateAway?.();
    },
    hasDevice: (designation) => findDeviceByDesignation(doc.deviceIndex, designation) !== null,
    to3d: (designation) => {
      const device = findDeviceByDesignation(doc.deviceIndex, designation);
      const target = device ? deviceTo3d.get(device.key) : undefined;
      if (!target) return;
      stashPendingPick(doc.id, target.objectId);
      if (target.modelIndex !== doc.modelIndex) {
        dispatch({ type: "SET_MODEL", id: doc.id, modelIndex: target.modelIndex });
      }
      dispatch({ type: "SET_VIEW", id: doc.id, view: "3d" });
      onNavigateAway?.();
    },
    has3d: (designation) => {
      const device = findDeviceByDesignation(doc.deviceIndex, designation);
      return device ? deviceTo3d.has(device.key) : false;
    },
    resolve3d: (designation) => {
      const device = findDeviceByDesignation(doc.deviceIndex, designation);
      return (device && deviceTo3d.get(device.key)) ?? null;
    },
  };

  const tabs: { key: DataTab; label: string; enabled: boolean }[] = [
    { key: "bom", label: t("data.tab.bom"), enabled: doc.amlEntry !== null },
    { key: "panel", label: t("data.tab.panel"), enabled: doc.amlEntry !== null },
    {
      key: "connections",
      label: t("data.tab.connections"),
      enabled: (manifest?.connections.length ?? 0) > 0,
    },
    { key: "network", label: t("data.tab.network"), enabled: doc.amlEntry !== null },
    { key: "positions", label: t("data.tab.positions"), enabled: doc.amlEntry !== null },
    {
      key: "ipoints",
      label: t("data.tab.ipoints"),
      enabled: (manifest?.interruptionPoints.length ?? 0) > 0,
    },
  ];
  const needsAml = tab === "bom" || tab === "panel" || tab === "network" || tab === "positions";

  const description = pickText(aml?.description ?? null, lang);

  return (
    <div className="data-view">
      <header className="data-head">
        <div className="data-title">
          <div className="eyebrow">{t("data.title")}</div>
          <h1>{manifest?.projectName ?? aml?.name ?? doc.fileName}</h1>
          {description && <p className="sub">{description}</p>}
        </div>
      </header>

      <nav className="data-tabs" role="tablist">
        {tabs
          .filter((entry) => entry.enabled)
          .map((entry) => (
            <button
              key={entry.key}
              role="tab"
              aria-selected={tab === entry.key}
              className={tab === entry.key ? "active" : ""}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
      </nav>

      <div className="data-body">
        {needsAml && doc.amlState !== "ready" ? (
          <div className="data-note">
            {doc.amlState === "error" || !doc.amlEntry ? t("data.noAml") : t("data.loadingAml")}
          </div>
        ) : (
          <>
            {tab === "bom" && aml && <EclassBomView aml={aml} lang={lang} nav={nav} />}
            {tab === "panel" && aml && <PanelView aml={aml} />}
            {tab === "connections" && (
              <ConnectionsView
                manifest={manifest}
                aml={aml}
                partBoxes={partBoxes}
                projectId={doc.id}
                models={doc.epdzModels}
                nav={nav}
              />
            )}
            {tab === "network" && aml && <NetworkView aml={aml} nav={nav} />}
            {tab === "positions" && aml && <PositionsView aml={aml} lang={lang} nav={nav} />}
            {tab === "ipoints" && <InterruptionView manifest={manifest} nav={nav} />}
          </>
        )}
      </div>
    </div>
  );
}

