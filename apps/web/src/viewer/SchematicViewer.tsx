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
 * Visor de páginas de esquema EPLAN (SVG) con pan (arrastrar) y zoom (rueda).
 * Sanea el SVG del .epdz: quita el SVGScripting.js original y los enlaces
 * javascript:, y resuelve las imágenes relativas contra el contenido del archivo.
 */
export function SchematicViewer({ svgText, imageUrls }: SchematicViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: ViewState } | null>(null);

  const page = useMemo(() => preparePage(svgText, imageUrls), [svgText, imageUrls]);

  // Encuadre inicial (y al cambiar de página): ajusta la página al contenedor.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { clientWidth, clientHeight } = container;
    const pageHeight = BASE_WIDTH * page.aspect;
    const scale = Math.min(clientWidth / BASE_WIDTH, clientHeight / pageHeight) * 0.96;
    setView({
      x: (clientWidth - BASE_WIDTH * scale) / 2,
      y: (clientHeight - pageHeight * scale) / 2,
      scale,
    });
  }, [page]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const scale = Math.min(40, Math.max(0.05, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin: view };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setView({
      ...drag.origin,
      x: drag.origin.x + (e.clientX - drag.startX),
      y: drag.origin.y + (e.clientY - drag.startY),
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        cursor: "grab",
        touchAction: "none",
        background: "#3a3a42",
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        style={{
          width: BASE_WIDTH,
          height: BASE_WIDTH * page.aspect,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: "0 0",
          background: "white",
          boxShadow: "0 2px 16px rgba(0,0,0,0.5)",
        }}
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </div>
  );
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
