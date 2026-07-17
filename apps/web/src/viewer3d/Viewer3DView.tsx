import { useEffect, useMemo, useRef, useState } from "react";
import type { E3dScene } from "@covaga/e3d-core";
import { Viewer, type ViewerHandle } from "../viewer/Viewer";
import { useProjects } from "../state/ProjectsContext";
import { pickedLabel, resolvePickedToSchematic } from "../state/bridge";
import { consumePendingPick } from "../state/deeplink";
import { nextDeviceOccurrence } from "../devices";
import type { PickedPart } from "../state/types";
import { useI18n } from "../i18n";
import { IconCube } from "../shell/icons";
import { ModelSelectorCard } from "./ModelSelectorCard";
import { PartsPanel } from "./PartsPanel";
import { ViewPresets } from "./ViewPresets";
import { buildPartList, type PartEntry } from "./parts";

const PANEL_KEY = "covaga.partsPanel.open";

function initialPanelOpen(): boolean {
  try {
    const saved = localStorage.getItem(PANEL_KEY);
    if (saved !== null) return saved === "1";
  } catch {
    // Sin persistencia.
  }
  return !(window.matchMedia?.("(max-width: 760px)").matches ?? false);
}

/**
 * Vista 3D: visor three.js con UI flotante (selector de modelo, tarjeta de la
 * pieza seleccionada, presets de cámara) y panel derecho con el desglose de
 * piezas del modelo (visibilidad por pieza, selección, aislado).
 */
export function Viewer3DView({ scene }: { scene: E3dScene | null }) {
  const { dispatch, active: doc } = useProjects();
  const { t } = useI18n();
  const viewerRef = useRef<ViewerHandle>(null);
  const nonceRef = useRef(0);
  const [isolated, setIsolated] = useState<number | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(initialPanelOpen);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia?.("(max-width: 760px)").matches ?? false
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const onChange = () => setIsMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const parts = useMemo(
    () => buildPartList(scene, doc?.manifest ?? null),
    [scene, doc?.manifest]
  );

  // Cambiar de modelo reconstruye la escena: se pierde visibilidad y aislado.
  useEffect(() => {
    setIsolated(null);
    setHiddenKeys(new Set());
  }, [scene]);

  // La visibilidad se aplica como efecto: una única fuente de verdad.
  useEffect(() => {
    const hiddenIds = new Set<number>();
    for (const entry of parts) {
      if (hiddenKeys.has(entry.key)) for (const id of entry.objectIds) hiddenIds.add(id);
    }
    viewerRef.current?.applyVisibility(hiddenIds, isolated);
  }, [scene, parts, hiddenKeys, isolated]);

  // Pieza 3D pendiente de un enlace profundo: se selecciona al montar la escena.
  useEffect(() => {
    if (!doc || !scene) return;
    const objectId = consumePendingPick(doc.id);
    if (objectId == null) return;
    const info = viewerRef.current?.selectPart(objectId);
    if (info) dispatch({ type: "SET_PICKED", id: doc.id, picked: info as PickedPart });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, scene]);

  if (!doc) return null;

  const bridgeTarget = doc.picked ? resolvePickedToSchematic(doc, doc.picked) : null;
  const pickedId = doc.picked?.objectId;

  const setPanelOpenPersist = (open: boolean) => {
    setPanelOpen(open);
    try {
      localStorage.setItem(PANEL_KEY, open ? "1" : "0");
    } catch {
      // Sin persistencia.
    }
  };

  const onPick = (info: Record<string, unknown> | null) => {
    dispatch({ type: "SET_PICKED", id: doc.id, picked: info as PickedPart | null });
    // La ficha de la pieza vive en el panel: al elegir en el lienzo desde móvil
    // (panel cerrado por defecto) lo abrimos para que se vea la selección.
    if (info && isMobile) setPanelOpenPersist(true);
  };

  const viewInSchematics = () => {
    if (!bridgeTarget) return;
    if (bridgeTarget.kind === "device") {
      // Misma lógica de ciclo que la búsqueda de dispositivos: el primer salto
      // cae en la primera aparición y, si se repite, avanza a la siguiente.
      const next = nextDeviceOccurrence(
        bridgeTarget.device,
        doc.pageIndex,
        doc.highlight?.elementId
      );
      if (!next) return;
      dispatch({
        type: "NAVIGATE",
        id: doc.id,
        pageIndex: next.occurrence.pageIndex,
        highlight: { elementId: next.occurrence.elementId, nonce: ++nonceRef.current },
        xrefInfo: `${bridgeTarget.device.label} · ${next.index + 1}/${next.total}`,
      });
    } else {
      dispatch({
        type: "NAVIGATE",
        id: doc.id,
        pageIndex: bridgeTarget.pageIndex,
        highlight: bridgeTarget.elementId
          ? { elementId: bridgeTarget.elementId, nonce: ++nonceRef.current }
          : null,
        xrefInfo: null,
      });
    }
  };

  const closeCard = () => {
    viewerRef.current?.clearSelection();
    dispatch({ type: "SET_PICKED", id: doc.id, picked: null });
  };

  const toggleIsolate = () => {
    if (pickedId === undefined) return;
    setIsolated((prev) => (prev === pickedId ? null : pickedId));
  };

  const pickedEntry =
    pickedId !== undefined
      ? parts.find((entry) => entry.objectIds.includes(pickedId)) ?? null
      : null;

  const toggleEntryHidden = (entry: PartEntry) => {
    // Con un aislado activo las ocultaciones no se ven: se desactiva para que
    // el ojo tenga siempre efecto visible.
    setIsolated(null);
    const hide = !hiddenKeys.has(entry.key);
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (hide) next.add(entry.key);
      else next.delete(entry.key);
      return next;
    });
    // Al ocultar el aparato seleccionado, la selección deja de tener sentido.
    if (hide && pickedId !== undefined && entry.objectIds.includes(pickedId)) closeCard();
  };

  const showAll = () => {
    setIsolated(null);
    setHiddenKeys(new Set());
  };

  const selectFromPanel = (entry: PartEntry) => {
    const info = viewerRef.current?.selectPart(entry.objectIds[0]);
    if (info) dispatch({ type: "SET_PICKED", id: doc.id, picked: info as PickedPart });
    // La ficha de la pieza (y sus acciones) se muestra en este mismo panel, así
    // que no se cierra en móvil: la selección queda visible arriba del listado.
  };

  const focusPicked = () => {
    if (pickedId !== undefined) viewerRef.current?.focusPart(pickedId);
  };

  const showPanel = parts.length > 0 && panelOpen;

  const selectedLabel = doc.picked
    ? pickedLabel(doc, doc.picked) ??
      t("part.part", { id: String(doc.picked.objectId ?? doc.picked.meshId ?? "?") })
    : null;

  const selected =
    doc.picked && selectedLabel
      ? {
          label: selectedLabel,
          typeId: String(doc.picked.typeId ?? "–"),
          objectId: String(doc.picked.objectId ?? "–"),
          hasObject: doc.picked.objectId !== undefined,
          hasBridge: !!bridgeTarget,
          isolated: isolated !== null && isolated === pickedId,
          hidden: !!pickedEntry && hiddenKeys.has(pickedEntry.key),
        }
      : null;

  const partsPanel = (
    <PartsPanel
      parts={parts}
      hiddenKeys={hiddenKeys}
      isolated={isolated}
      selectedKey={pickedEntry?.key ?? null}
      selected={selected}
      onSelect={selectFromPanel}
      onToggleHidden={toggleEntryHidden}
      onShowAll={showAll}
      onHide={() => setPanelOpenPersist(false)}
      onViewInSchematics={viewInSchematics}
      onToggleIsolate={toggleIsolate}
      onToggleSelectedHidden={() => {
        if (pickedEntry) toggleEntryHidden(pickedEntry);
      }}
      onFocusSelected={focusPicked}
      onDeselect={closeCard}
    />
  );

  return (
    <div className="viewer3d-view">
      <div className="viewport">
        <Viewer ref={viewerRef} scene={scene} onPickPart={onPick} />

        <ModelSelectorCard
          models={doc.epdzModels}
          modelIndex={doc.modelIndex}
          onSelect={(index) => {
            dispatch({ type: "SET_MODEL", id: doc.id, modelIndex: index });
          }}
        />

        <ViewPresets onPreset={(preset) => viewerRef.current?.setPreset(preset)} />

        {parts.length > 0 && !panelOpen && !isMobile && (
          <div className="edge-tabs">
            <button className="edge-tab" onClick={() => setPanelOpenPersist(true)}>
              <IconCube size={14} />
              <span className="edge-label">{t("parts.title")}</span>
              <span className="edge-count mono">{parts.length}</span>
            </button>
          </div>
        )}

        {parts.length > 0 && !panelOpen && isMobile && (
          <button
            className="parts-fab"
            aria-label={t("parts.title")}
            onClick={() => setPanelOpenPersist(true)}
          >
            <IconCube size={17} />
            <span className="parts-fab-count mono">{parts.length}</span>
          </button>
        )}

        {showPanel && isMobile && (
          <>
            <div className="panel-scrim" onClick={() => setPanelOpenPersist(false)} />
            <aside className="pages-panel overlay">{partsPanel}</aside>
          </>
        )}
      </div>

      {showPanel && !isMobile && <aside className="pages-panel">{partsPanel}</aside>}
    </div>
  );
}
