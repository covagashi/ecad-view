import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

/** Destino de un enlace de referencia cruzada (jumpToFunction) de EPLAN. */
export interface SchematicNavTarget {
  /** Fichero SVG de la página destino, o null si el salto es por dispositivo. */
  file: string | null;
  /** Id del elemento destino dentro de la página ("Id17_4180"), si lo hay. */
  elementId: string | null;
}

/** Elemento a resaltar y encuadrar; nonce distinto fuerza re-encuadre. */
export interface SchematicHighlight {
  elementId: string;
  nonce: number;
}

export interface SchematicViewerProps {
  /** Contenido del fichero SVG de la página. */
  svgText: string;
  /** Mapa nombre de fichero (en minúsculas) -> object URL, para imágenes referenciadas. */
  imageUrls: Map<string, string>;
  /** Elemento a resaltar tras renderizar la página. */
  highlight?: SchematicHighlight | null;
  /** Clic en un enlace de referencia cruzada. */
  onNavigate?: (target: SchematicNavTarget) => void;
  /** Notifica el zoom vigente como % respecto al encuadre de página completa. */
  onViewChange?: (percentOfFit: number) => void;
}

/** Controles imperativos del visor (toolbar de zoom externa). */
export interface SchematicViewerHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ancho base en px al que se renderiza la página; el zoom se hace con transform. */
const BASE_WIDTH = 1400;

/**
 * Visor de páginas de esquema EPLAN (SVG).
 * Interacción: arrastrar para desplazar, rueda para zoom, pinch en táctil,
 * doble clic/tap para reencuadrar. Los enlaces jumpToFunction del SVG se
 * convierten en navegación dentro de la aplicación (onNavigate) y el
 * elemento indicado en `highlight` se recuadra y se encuadra con zoom.
 */
export const SchematicViewer = forwardRef<SchematicViewerHandle, SchematicViewerProps>(
  function SchematicViewer({ svgText, imageUrls, highlight, onNavigate, onViewChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const [hlBox, setHlBox] = useState<Box | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ origin: ViewState; center: { x: number; y: number }; distance: number } | null>(null);
  const movedRef = useRef(false);
  /** Escala del encuadre "página completa" vigente, base del % de zoom. */
  const fitScaleRef = useRef(1);

  const page = useMemo(() => preparePage(svgText, imageUrls), [svgText, imageUrls]);

  const fitView = (): ViewState | null => {
    const container = containerRef.current;
    if (!container) return null;
    const { clientWidth, clientHeight } = container;
    const pageHeight = BASE_WIDTH * page.aspect;
    const scale = Math.min(clientWidth / BASE_WIDTH, clientHeight / pageHeight) * 0.94;
    fitScaleRef.current = scale || 1;
    return {
      x: (clientWidth - BASE_WIDTH * scale) / 2,
      y: (clientHeight - pageHeight * scale) / 2,
      scale,
    };
  };

  const fit = () => {
    const v = fitView();
    if (v) setView(v);
  };

  useImperativeHandle(ref, () => ({
    fit,
    zoomIn() {
      const container = containerRef.current;
      if (!container) return;
      setView((v) => zoomAt(v, container.clientWidth / 2, container.clientHeight / 2, 1.25));
    },
    zoomOut() {
      const container = containerRef.current;
      if (!container) return;
      setView((v) => zoomAt(v, container.clientWidth / 2, container.clientHeight / 2, 1 / 1.25));
    },
  }));

  // Notifica el zoom como porcentaje del encuadre de página completa.
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  useEffect(() => {
    onViewChangeRef.current?.((view.scale / fitScaleRef.current) * 100);
  }, [view]);

  // Encuadre al cambiar de página; si hay un elemento a resaltar, se mide su
  // caja (en unidades de hoja) y se hace zoom hasta él.
  useEffect(() => {
    const container = containerRef.current;
    const sheet = sheetRef.current;
    const el =
      highlight && sheet
        ? sheet.querySelector(`[id="${highlight.elementId.replace(/"/g, '\\"')}"]`)
        : null;
    if (!highlight || !container || !sheet || !el) {
      setHlBox(null);
      fit();
      return;
    }
    // getBoundingClientRect incluye el transform actual de la hoja; dividir
    // por la escala vigente da coordenadas de hoja, independientes del zoom.
    const elRect = el.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    const scale = viewRef.current.scale || 1;
    const pad = 6;
    const box: Box = {
      x: (elRect.left - sheetRect.left) / scale - pad,
      y: (elRect.top - sheetRect.top) / scale - pad,
      w: elRect.width / scale + pad * 2,
      h: elRect.height / scale + pad * 2,
    };
    setHlBox(box);

    const { clientWidth, clientHeight } = container;
    const fitted = fitView();
    // El recuadro ocupa ~1/3 del lado menor del viewport, entre "página
    // completa" y un límite razonable de acercamiento.
    let target = Math.min(clientWidth, clientHeight) / (3 * Math.max(box.w, box.h, 1));
    target = Math.max(fitted?.scale ?? 0.05, Math.min(target, 8));
    setView({
      scale: target,
      x: clientWidth / 2 - (box.x + box.w / 2) * target,
      y: clientHeight / 2 - (box.y + box.h / 2) * target,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, highlight]);

  // Zoom con rueda (listener no pasivo para poder hacer preventDefault).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => zoomAt(v, px, py, e.deltaY < 0 ? 1.15 : 1 / 1.15));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  const syncGesture = () => {
    const pointers = [...pointersRef.current.values()];
    if (pointers.length === 0) {
      gestureRef.current = null;
      return;
    }
    const center = averagePoint(pointers);
    gestureRef.current = {
      origin: viewRef.current,
      center,
      distance: pointers.length >= 2 ? distance(pointers[0], pointers[1]) : 0,
    };
  };

  // setView es asíncrono; para los gestos se necesita el valor vigente.
  const viewRef = useRef(view);
  viewRef.current = view;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (pointersRef.current.size === 0) movedRef.current = false;
    pointersRef.current.set(e.pointerId, localPoint(e));
    syncGesture();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, localPoint(e));
    const gesture = gestureRef.current;
    if (!gesture) return;

    const pointers = [...pointersRef.current.values()];
    const center = averagePoint(pointers);
    if (distance(center, gesture.center) > 6 || pointers.length >= 2) movedRef.current = true;
    let next: ViewState = {
      ...gesture.origin,
      x: gesture.origin.x + (center.x - gesture.center.x),
      y: gesture.origin.y + (center.y - gesture.center.y),
    };
    if (pointers.length >= 2 && gesture.distance > 0) {
      const factor = distance(pointers[0], pointers[1]) / gesture.distance;
      next = zoomAt(next, center.x, center.y, factor);
    }
    setView(next);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    syncGesture();
  };

  // Un clic (sin arrastre) sobre un enlace de referencia cruzada navega.
  const onClick = (e: React.MouseEvent) => {
    if (movedRef.current || !onNavigate) return;
    const link = (e.target as Element).closest?.("a[data-jump-id], a[data-jump-file]");
    if (!link) return;
    e.preventDefault();
    onNavigate({
      file: link.getAttribute("data-jump-file") || null,
      elementId: link.getAttribute("data-jump-id") || null,
    });
  };

  function localPoint(e: React.PointerEvent): { x: number; y: number } {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div
      ref={containerRef}
      className="schematic"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={fit}
      onClick={onClick}
    >
      <div
        ref={sheetRef}
        className="sheet"
        style={{
          width: BASE_WIDTH,
          height: BASE_WIDTH * page.aspect,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        <div className="sheet-svg" dangerouslySetInnerHTML={{ __html: page.html }} />
        {hlBox && (
          <div
            key={highlight?.nonce}
            className="sheet-highlight"
            style={{ left: hlBox.x, top: hlBox.y, width: hlBox.w, height: hlBox.h }}
          />
        )}
      </div>
    </div>
  );
});

function zoomAt(v: ViewState, px: number, py: number, factor: number): ViewState {
  const scale = Math.min(40, Math.max(0.05, v.scale * factor));
  const k = scale / v.scale;
  return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
}

function averagePoint(points: { x: number; y: number }[]): { x: number; y: number } {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Extrae el título de página de un SVG EPLAN (contenido de <title>). */
export function pageTitle(svgText: string, fallback: string): string {
  const match = /<title>([^<]*)<\/title>/.exec(svgText);
  if (!match) return fallback;
  return decodeEntities(match[1]);
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Extrae los argumentos de una llamada jumpToFunction(...) del visor EPLAN:
 * (fileName, x, y, width, height, id, targetId, hasInstanceName).
 */
function parseJumpArgs(raw: string): string[] {
  return raw.split(",").map((part) => {
    const trimmed = part.trim();
    const quoted = /^'(.*)'$/.exec(trimmed);
    return quoted ? quoted[1] : trimmed;
  });
}

function preparePage(svgText: string, imageUrls: Map<string, string>): { html: string; aspect: number } {
  // Descarta la declaración XML y el DOCTYPE.
  let svg = svgText.slice(Math.max(0, svgText.indexOf("<svg")));

  // Elimina el script de EPLAN (SVGScripting.js) y cualquier script embebido.
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<script[^>]*\/>/gi, "");

  // Convierte los enlaces jumpToFunction (saltos de referencia cruzada del
  // visor original) en atributos de datos que el visor intercepta al clic.
  svg = svg.replace(
    /(?:xlink:)?href="javascript:\s*jumpToFunction\(([^)]*)\)[^"]*"/gi,
    (_match, rawArgs) => {
      const args = parseJumpArgs(decodeEntities(String(rawArgs)));
      const file = args[0] ?? "";
      const id = args[5] ?? "";
      const targetId = args[6] && args[6] !== "0" ? args[6] : "";
      const attrs: string[] = [];
      if (file) attrs.push(`data-jump-file="${escapeAttr(file)}"`);
      const element = targetId || id;
      if (element) attrs.push(`data-jump-id="${escapeAttr(element)}"`);
      return attrs.join(" ");
    }
  );

  // Neutraliza cualquier otro enlace javascript: embebido.
  svg = svg.replace(/(?:xlink:)?href="javascript:[^"]*"/gi, "");

  // Resuelve imágenes relativas (p. ej. EPLAN.png) contra el contenido del .epdz.
  svg = svg.replace(/((?:xlink:)?href=")([^":]+\.(?:png|jpe?g|gif|bmp))(")/gi, (m, pre, name, post) => {
    const url = imageUrls.get(name.split("/").pop()!.toLowerCase());
    return url ? `${pre}${url}${post}` : m;
  });

  // Relación de aspecto desde el viewBox; la página se escala al contenedor.
  let aspect = 297 / 420; // A3 apaisado por defecto
  const tagEnd = svg.indexOf(">");
  let tag = svg.slice(0, tagEnd + 1);
  const viewBox = /viewBox="\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s*"/.exec(tag);
  if (viewBox) {
    const width = parseFloat(viewBox[3]);
    const height = parseFloat(viewBox[4]);
    if (width > 0 && height > 0) aspect = height / width;
  }
  // La página ocupa el 100% de su contenedor; el tamaño real lo pone el visor.
  tag = tag.replace(/\swidth="[^"]*"/, ' width="100%"').replace(/\sheight="[^"]*"/, ' height="100%"');
  svg = tag + svg.slice(tagEnd + 1);

  return { html: svg, aspect };
}
