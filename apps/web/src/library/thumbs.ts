import { hasThumb, setThumb } from "./db";

const THUMB_W = 320;
const THUMB_H = 226;

/**
 * Genera (si no existe ya) una miniatura PNG de la primera página SVG de un
 * proyecto y la guarda en IndexedDB. Es fire-and-forget: cualquier fallo se
 * ignora y la tarjeta usa el icono genérico.
 */
export async function ensureThumb(key: string, svgText: string): Promise<void> {
  try {
    if (await hasThumb(key)) return;

    // Sin referencias externas: las <image> relativas del .epdz no resuelven
    // fuera de la aplicación y bloquearían la carga del SVG.
    const cleaned = svgText
      .slice(Math.max(0, svgText.indexOf("<svg")))
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<image[^>]*>/gi, "");

    const svgUrl = URL.createObjectURL(new Blob([cleaned], { type: "image/svg+xml" }));
    try {
      const image = await loadImage(svgUrl);
      const canvas = document.createElement("canvas");
      canvas.width = THUMB_W;
      canvas.height = THUMB_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Papel blanco, como las hojas EPLAN.
      ctx.fillStyle = "#f4f5f2";
      ctx.fillRect(0, 0, THUMB_W, THUMB_H);
      const scale = Math.min(THUMB_W / image.width, THUMB_H / image.height) || 1;
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, (THUMB_W - w) / 2, (THUMB_H - h) / 2, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 0.8)
      );
      if (blob) await setThumb(key, blob);
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch (error) {
    console.warn("No se pudo generar la miniatura:", error);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}
