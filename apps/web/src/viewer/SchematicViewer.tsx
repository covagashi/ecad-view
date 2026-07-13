import { useEffect, useMemo, useRef, useState } from "react";

export interface SchematicViewerProps {
  /** Contenido del fichero SVG de la página. */
  svgText: string;
  /** Mapa nombre de fichero (en minúsculas) -> object URL, para imágenes referenciadas. */
  imageUrls: Map<string, string>;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

/** Ancho base en px al que se renderiza la página; el zoom se hace con transform. */
const BASE_WIDTH = 1400;

/**
 * Visor de páginas de esquema EPLAN (SVG).
 * Interacción: arrastrar para desplazar, rueda para zoom, pinch en táctil,
 * doble clic/tap para reencuadrar.
 */
export function SchematicViewer({ svgText, imageUrls }: SchematicViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ origin: ViewState; center: { x: number; y: number }; distance: number } | null>(null);

  const page = useMemo(() => preparePage(svgText, imageUrls), [svgText, imageUrls]);

  const fit = () => {
    const container = containerRef.current;
    if (!container) return;
    const { clientWidth, clientHeight } = container;
    const pageHeight = BASE_WIDTH * page.aspect;
    const scale = Math.min(clientWidth / BASE_WIDTH, clientHeight / pageHeight) * 0.94;
    setView({
      x: (clientWidth - BASE_WIDTH * scale) / 2,
      y: (clientHeight - pageHeight * scale) / 2,
      scale,
    });
  };

  // Encuadre inicial y al cambiar de página.
  useEffect(fit, [page]);

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
    >
      <div
        className="sheet"
        style={{
          width: BASE_WIDTH,
          height: BASE_WIDTH * page.aspect,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </div>
  );
}

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

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function preparePage(svgText: string, imageUrls: Map<string, string>): { html: string; aspect: number } {
  // Descarta la declaración XML y el DOCTYPE.
  let svg = svgText.slice(Math.max(0, svgText.indexOf("<svg")));

  // Elimina el script de EPLAN (SVGScripting.js) y cualquier script embebido.
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<script[^>]*\/>/gi, "");

  // Neutraliza los enlaces javascript: (saltos de referencias cruzadas del visor original).
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
