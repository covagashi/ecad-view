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

export type DataTab = "connections" | "panel" | "network" | "bom" | "positions" | "ipoints";

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

function defaultTab(doc: {
  aml: unknown;
  amlEntry: unknown;
  manifest: { connections: unknown[]; interruptionPoints: unknown[] } | null;
}): DataTab {
  // En taller el hilo manda: conexiones primero si hay lista de cableado.
  if ((doc.manifest?.connections.length ?? 0) > 0) return "connections";
  if (doc.aml || doc.amlEntry) return "panel";
  if ((doc.manifest?.interruptionPoints.length ?? 0) > 0) return "ipoints";
  return "connections";
}

/**
 * Vista "Datos": lo que el montador necesita delante del armario —
 * conexiones de cableado, mecanizado, red/PLC, BOM, posiciones y puntos
 * de interrupción. Escritorio a pantalla completa; en móvil, dentro del modal.
 */
export function DataView({ onNavigateAway }: { onNavigateAway?: () => void }) {
  const { dispatch, active: doc } = useProjects();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<DataTab>(() => (doc ? defaultTab(doc) : "connections"));
  const nonceRef = useRef(0);

  useAml(doc ?? null);

  const aml = doc?.aml ?? null;
  const manifest = doc?.manifest ?? null;

  const lang = useMemo(
    () => resolveAmlLang(aml, doc?.amlLang, locale),
    [aml, doc?.amlLang, locale]
  );

  const partLocations = useMemo(
    () => (doc?.manifest ? getPartLocations(doc.id, doc.epdzModels) : new Map<string, number>()),
    [doc?.id, doc?.manifest, doc?.epdzModels]
  );
  const deviceTo3d = useMemo(
    () => buildDeviceTo3dIndex(doc?.deviceIndex.devices ?? [], manifest, partLocations),
    [doc?.deviceIndex, manifest, partLocations]
  );

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

  // Orden de taller: cableado → placa → red → lista de material → resto.
  const tabs: { key: DataTab; label: string; enabled: boolean }[] = [
    {
      key: "connections",
      label: t("data.tab.connections"),
      enabled: (manifest?.connections.length ?? 0) > 0,
    },
    { key: "panel", label: t("data.tab.panel"), enabled: doc.amlEntry !== null },
    { key: "network", label: t("data.tab.network"), enabled: doc.amlEntry !== null },
    { key: "bom", label: t("data.tab.bom"), enabled: doc.amlEntry !== null },
    { key: "positions", label: t("data.tab.positions"), enabled: doc.amlEntry !== null },
    {
      key: "ipoints",
      label: t("data.tab.ipoints"),
      enabled: (manifest?.interruptionPoints.length ?? 0) > 0,
    },
  ];
  const visibleTabs = tabs.filter((entry) => entry.enabled);
  const activeTab = visibleTabs.some((entry) => entry.key === tab)
    ? tab
    : (visibleTabs[0]?.key ?? "connections");

  const needsAml =
    activeTab === "bom" ||
    activeTab === "panel" ||
    activeTab === "network" ||
    activeTab === "positions";

  const description = pickText(aml?.description ?? null, lang);
  const projectName = manifest?.projectName ?? aml?.name ?? doc.fileName;

  return (
    <div className="data-view">
      <header className="data-head">
        <div className="data-title">
          <h1 className="mono">{projectName}</h1>
          {description && <p className="sub">{description}</p>}
        </div>
      </header>

      <nav className="data-tabs" role="tablist" aria-label={t("rail.data")}>
        {visibleTabs.map((entry) => (
          <button
            key={entry.key}
            role="tab"
            type="button"
            aria-selected={activeTab === entry.key}
            className={activeTab === entry.key ? "active" : ""}
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
            {activeTab === "connections" && (
              <ConnectionsView
                manifest={manifest}
                aml={aml}
                partBoxes={partBoxes}
                projectId={doc.id}
                models={doc.epdzModels}
                nav={nav}
              />
            )}
            {activeTab === "panel" && aml && <PanelView aml={aml} />}
            {activeTab === "network" && aml && <NetworkView aml={aml} nav={nav} />}
            {activeTab === "bom" && aml && <EclassBomView aml={aml} lang={lang} nav={nav} />}
            {activeTab === "positions" && aml && <PositionsView aml={aml} lang={lang} nav={nav} />}
            {activeTab === "ipoints" && <InterruptionView manifest={manifest} nav={nav} />}
          </>
        )}
      </div>
    </div>
  );
}
