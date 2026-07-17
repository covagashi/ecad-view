import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SchematicViewer,
  type SchematicNavTarget,
  type SchematicViewerHandle,
} from "../viewer/SchematicViewer";
import { useProjects } from "../state/ProjectsContext";
import { nextDeviceOccurrence, type Device } from "../devices";
import { buildDeviceTo3dIndex } from "../state/bridge";
import { getPartLocations } from "../state/partLocator";
import { stashPendingPick } from "../state/deeplink";
import { buildBom } from "../bom";
import { BreadcrumbChip } from "./BreadcrumbChip";
import { EdgeTabs } from "./EdgeTabs";
import { PagesPanel, type PanelTab } from "./PagesPanel";
import { ZoomToolbar } from "./ZoomToolbar";

const PIN_KEY = "covaga.pagesPanel.pinned";

function initialPinned(): boolean {
  try {
    return localStorage.getItem(PIN_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Vista de esquemas: lienzo a la izquierda y panel de páginas/dispositivos a
 * la derecha. El panel puede anclarse (en flujo) o quedar oculto tras unas
 * pestañas verticales en el borde; en móvil siempre funciona como overlay.
 */
export function SchematicsView() {
  const { dispatch, active: doc } = useProjects();
  const viewerRef = useRef<SchematicViewerHandle>(null);
  const nonceRef = useRef(0);
  const [pinned, setPinned] = useState(initialPinned);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>("pages");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia?.("(max-width: 760px)").matches ?? false
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const onChange = () => setIsMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Atajos de teclado: RePág/AvPág página anterior/siguiente; Inicio/Fin,
  // primera/última. Se ignoran cuando el foco está en un campo de texto.
  const docRef = useRef(doc);
  docRef.current = doc;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const current = docRef.current;
      if (!current || current.pages.length === 0) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      let next: number | null = null;
      if (e.key === "PageDown") next = Math.min(current.pageIndex + 1, current.pages.length - 1);
      else if (e.key === "PageUp") next = Math.max(current.pageIndex - 1, 0);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = current.pages.length - 1;
      if (next === null || next === current.pageIndex) return;
      e.preventDefault();
      dispatch({ type: "SET_PAGE", id: current.id, pageIndex: next });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  // Lista de piezas / BOM a partir del manifest.db (vacía sin manifest).
  const articles = useMemo(
    () => buildBom(doc?.manifest ?? null, doc?.deviceIndex ?? { devices: [], byElement: new Map() }),
    [doc?.manifest, doc?.deviceIndex]
  );
  const bomFileName = useMemo(() => {
    const base =
      doc?.manifest?.projectName || doc?.fileName?.replace(/\.[^.]+$/, "") || "project";
    return `${base}-BOM.csv`;
  }, [doc?.manifest?.projectName, doc?.fileName]);

  // Índice inverso esquema→3D: solo se construye si hay manifest (sin él no hay
  // funciones que casen dispositivo y pieza). partLocations parsea los modelos
  // una vez (cacheado por proyecto) para saber a qué modelo pertenece cada pieza.
  const partLocations = useMemo(
    () => (doc?.manifest ? getPartLocations(doc.id, doc.epdzModels) : new Map<string, number>()),
    [doc?.id, doc?.manifest, doc?.epdzModels]
  );
  const deviceTo3d = useMemo(
    () => buildDeviceTo3dIndex(doc?.deviceIndex.devices ?? [], doc?.manifest ?? null, partLocations),
    [doc?.deviceIndex, doc?.manifest, partLocations]
  );
  const resolvable3d = useMemo(() => new Set(deviceTo3d.keys()), [deviceTo3d]);

  const setPinnedPersist = useCallback((next: boolean) => {
    setPinned(next);
    try {
      localStorage.setItem(PIN_KEY, next ? "1" : "0");
    } catch {
      // Sin persistencia.
    }
  }, []);

  /** Alterna el pin; al desanclar, el panel sigue visible como overlay. */
  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PIN_KEY, next ? "1" : "0");
      } catch {
        // Sin persistencia.
      }
      if (!next) setOverlayOpen(true);
      return next;
    });
  }, []);

  /** Oculta el panel del todo: quedan las pestañas verticales del borde. */
  const hidePanel = useCallback(() => {
    setPinnedPersist(false);
    setOverlayOpen(false);
  }, [setPinnedPersist]);

  const currentPage = doc?.pages[doc.pageIndex];
  if (!doc || !currentPage) return null;
  // En móvil el panel nunca va anclado en flujo: siempre overlay.
  const inlinePanel = pinned && !isMobile;
  const showOverlay = !inlinePanel && overlayOpen;

  const selectPage = (index: number) => {
    dispatch({ type: "SET_PAGE", id: doc.id, pageIndex: index });
    if (!inlinePanel) setOverlayOpen(false);
  };

  /** Salta a la siguiente aparición del dispositivo (ciclando entre páginas). */
  const jumpToDevice = (device: Device) => {
    const next = nextDeviceOccurrence(device, doc.pageIndex, doc.highlight?.elementId);
    if (!next) return;
    dispatch({
      type: "NAVIGATE",
      id: doc.id,
      pageIndex: next.occurrence.pageIndex,
      highlight: { elementId: next.occurrence.elementId, nonce: ++nonceRef.current },
      xrefInfo: `${device.label} · ${next.index + 1}/${next.total}`,
    });
    if (!inlinePanel) setOverlayOpen(false);
  };

  /**
   * Salto inverso esquema→3D: cambia al modelo que contiene la pieza (si hace
   * falta), pasa a la vista 3D y deja el objectId pendiente; el visor 3D lo
   * consume al montar la escena y selecciona/encuadra la pieza (misma vía que
   * los enlaces profundos). Sin pieza 3D no hace nada (la UI ya oculta la acción).
   */
  const viewInThreeD = (device: Device) => {
    const target = deviceTo3d.get(device.key);
    if (!target) return;
    stashPendingPick(doc.id, target.objectId);
    if (target.modelIndex !== doc.modelIndex) {
      dispatch({ type: "SET_MODEL", id: doc.id, modelIndex: target.modelIndex });
    }
    dispatch({ type: "SET_VIEW", id: doc.id, view: "3d" });
    if (!inlinePanel) setOverlayOpen(false);
  };

  /** Resuelve un enlace jumpToFunction: salto a otra página o a un dispositivo. */
  const onNavigate = (target: SchematicNavTarget) => {
    if (target.file) {
      const fileLower = target.file.toLowerCase();
      const index = doc.pages.findIndex((p) => {
        const base = (p.path.split("/").pop() ?? "").toLowerCase();
        return base === fileLower || base === `${fileLower}.svg`;
      });
      if (index < 0) {
        dispatch({
          type: "SET_STATUS",
          status: { key: "status.xrefNotFound", params: { target: target.file } },
        });
        return;
      }
      dispatch({
        type: "NAVIGATE",
        id: doc.id,
        pageIndex: index,
        highlight: target.elementId
          ? { elementId: target.elementId, nonce: ++nonceRef.current }
          : null,
        xrefInfo: null,
      });
      return;
    }
    if (!target.elementId) return;
    const device = doc.deviceIndex.byElement.get(`${doc.pageIndex}|${target.elementId}`);
    if (device) {
      jumpToDevice(device);
    } else {
      // Sin índice de dispositivos: al menos se recuadra el propio elemento.
      dispatch({
        type: "NAVIGATE",
        id: doc.id,
        pageIndex: doc.pageIndex,
        highlight: { elementId: target.elementId, nonce: ++nonceRef.current },
        xrefInfo: doc.xrefInfo,
      });
    }
  };

  const panel = (
    <PagesPanel
      pages={doc.pages}
      pageIndex={doc.pageIndex}
      devices={doc.deviceIndex.devices}
      articles={articles}
      bomFileName={bomFileName}
      tab={tab}
      onTab={setTab}
      pinned={inlinePanel}
      onTogglePin={togglePin}
      onHide={hidePanel}
      onSelectPage={selectPage}
      onSelectDevice={jumpToDevice}
      resolvable3d={resolvable3d}
      onViewIn3d={viewInThreeD}
    />
  );

  return (
    <div className="schematics-view">
      <div className="schematics-canvas">
        <SchematicViewer
          ref={viewerRef}
          svgText={currentPage.svgText}
          imageUrls={doc.imageUrls}
          highlight={doc.highlight}
          onNavigate={onNavigate}
          onViewChange={setZoomPercent}
        />
        <BreadcrumbChip breadcrumb={currentPage.breadcrumb} />
        <ZoomToolbar
          percent={zoomPercent}
          onZoomIn={() => viewerRef.current?.zoomIn()}
          onZoomOut={() => viewerRef.current?.zoomOut()}
          onFit={() => viewerRef.current?.fit()}
        />

        {!inlinePanel && !showOverlay && (
          <EdgeTabs
            pageIndex={doc.pageIndex}
            pageCount={doc.pages.length}
            hasDevices={doc.deviceIndex.devices.length > 0}
            hasArticles={articles.length > 0}
            onOpen={(nextTab) => {
              setTab(nextTab);
              setOverlayOpen(true);
            }}
          />
        )}

        {showOverlay && (
          <>
            <div className="panel-scrim" onClick={() => setOverlayOpen(false)} />
            <aside className="pages-panel overlay">{panel}</aside>
          </>
        )}
      </div>

      {inlinePanel && <aside className="pages-panel">{panel}</aside>}
    </div>
  );
}
