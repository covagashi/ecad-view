/**
 * Colores de cable de taller (IEC / convención EPLAN) → hex para la pastilla.
 * Si no se reconoce, devuelve null y la UI muestra solo el texto.
 */
const MAP: Record<string, string> = {
  // Códigos cortos IEC
  bk: "#1c1c1c",
  bn: "#8b5a2b",
  rd: "#d6453d",
  og: "#e07a2f",
  ye: "#d4b000",
  gn: "#2f9e44",
  bu: "#2e6be6",
  vt: "#7c3aed",
  gy: "#8b94a3",
  wh: "#e8ecf2",
  pk: "#e879a8",
  tq: "#14b8a6",
  gnye: "#2f9e44",
  gnyw: "#2f9e44",
  // Inglés
  black: "#1c1c1c",
  brown: "#8b5a2b",
  red: "#d6453d",
  orange: "#e07a2f",
  yellow: "#d4b000",
  green: "#2f9e44",
  blue: "#2e6be6",
  violet: "#7c3aed",
  purple: "#7c3aed",
  grey: "#8b94a3",
  gray: "#8b94a3",
  white: "#e8ecf2",
  pink: "#e879a8",
  // Español
  negro: "#1c1c1c",
  marron: "#8b5a2b",
  "marrón": "#8b5a2b",
  rojo: "#d6453d",
  naranja: "#e07a2f",
  amarillo: "#d4b000",
  verde: "#2f9e44",
  azul: "#2e6be6",
  violeta: "#7c3aed",
  gris: "#8b94a3",
  blanco: "#e8ecf2",
  rosa: "#e879a8",
  // Alemán (orange ya está en inglés)
  schwarz: "#1c1c1c",
  braun: "#8b5a2b",
  rot: "#d6453d",
  gelb: "#d4b000",
  gruen: "#2f9e44",
  grün: "#2f9e44",
  blau: "#2e6be6",
  violett: "#7c3aed",
  grau: "#8b94a3",
  weiss: "#e8ecf2",
  weiß: "#e8ecf2",
};

/** ¿El cable es verde-amarillo (PE)? */
export function isPeWire(color: string | null | undefined): boolean {
  if (!color) return false;
  const k = color.trim().toLowerCase().replace(/[\s/_-]+/g, "");
  return k === "gnye" || k === "gnyw" || k === "gnge" || k.includes("verdeamarillo") || k.includes("greenyellow");
}

/** Hex reconocible o null. */
export function wireColorHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const raw = color.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  const key = raw.toLowerCase().replace(/[\s/_-]+/g, "");
  if (MAP[key]) return MAP[key];
  // "BK / BU" → primer tramo
  const first = raw.split(/[/,+]/)[0]?.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (first && MAP[first]) return MAP[first];
  return null;
}
