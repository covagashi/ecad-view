import type { EplanManifest } from "@covaga/e3d-core/manifest";
import type { Device, DeviceIndex } from "./devices";
import { findDeviceByDesignation } from "./state/bridge";

/** Dispositivo que usa un artículo, con su enlace al esquema (si existe). */
export interface BomDevice {
  /** Designación EPLAN completa (ep.20001), p. ej. "+A1-FC2:1". */
  designation: string;
  /** Dispositivo del índice de esquemas si la designación aparece en los SVG. */
  device: Device | null;
}

/** Fila de la lista de piezas / BOM: un artículo con su cantidad y dispositivos. */
export interface BomArticle {
  /** Clave de agrupación (número de artículo completo). */
  key: string;
  /** Número de artículo/pieza (ep.20100), p. ej. "SIE.5SY4106-7". */
  partNumber: string;
  /** Abreviatura de fabricante derivada del prefijo del artículo (SIE, PXC…). */
  manufacturer: string | null;
  /** Descripción/tipo de la pieza (ep.20193), si existe. */
  description: string | null;
  /** Cantidad = número de designaciones distintas que llevan el artículo. */
  quantity: number;
  /** Dispositivos que usan el artículo, ordenados por designación. */
  devices: BomDevice[];
}

/**
 * El número de artículo EPLAN llega como "<fabricante>.<referencia>", p. ej.
 * "SIE.5SY4106-7". Se separa el prefijo de fabricante de la referencia; si no
 * hay punto, no hay fabricante conocido y la referencia es el valor completo.
 */
function splitPartNumber(partNumber: string): { manufacturer: string | null; ref: string } {
  const dot = partNumber.indexOf(".");
  if (dot <= 0) return { manufacturer: null, ref: partNumber };
  return { manufacturer: partNumber.slice(0, dot), ref: partNumber.slice(dot + 1) };
}

/**
 * Construye la lista de piezas (BOM) a partir de las funciones del manifest.db.
 * Se agrupan por número de artículo (ep.20100); la cantidad es el número de
 * designaciones de dispositivo distintas que lo usan. Cada designación se
 * resuelve, si es posible, a un dispositivo del índice de esquemas para poder
 * saltar a él (muchas piezas mecánicas —carriles, armarios— no tienen símbolo
 * en los esquemas y quedan sin enlace).
 */
export function buildBom(manifest: EplanManifest | null, deviceIndex: DeviceIndex): BomArticle[] {
  if (!manifest) return [];

  const byArticle = new Map<string, { article: BomArticle; seen: Set<string> }>();
  for (const fn of manifest.functions) {
    if (!fn.partNumber) continue;
    let entry = byArticle.get(fn.partNumber);
    if (!entry) {
      const { manufacturer } = splitPartNumber(fn.partNumber);
      entry = {
        article: {
          key: fn.partNumber,
          partNumber: fn.partNumber,
          manufacturer,
          description: fn.partDescription,
          quantity: 0,
          devices: [],
        },
        seen: new Set<string>(),
      };
      byArticle.set(fn.partNumber, entry);
    }
    // La descripción puede faltar en algunas funciones del mismo artículo.
    if (!entry.article.description && fn.partDescription) {
      entry.article.description = fn.partDescription;
    }
    const designation = fn.designation;
    if (!designation || entry.seen.has(designation)) continue;
    entry.seen.add(designation);
    entry.article.devices.push({
      designation,
      device: findDeviceByDesignation(deviceIndex, designation),
    });
  }

  const articles = [...byArticle.values()].map(({ article }) => {
    article.quantity = article.devices.length;
    article.devices.sort((a, b) =>
      a.designation.localeCompare(b.designation, undefined, { numeric: true })
    );
    return article;
  });

  // Orden principal: los artículos con más unidades primero, luego por número.
  articles.sort(
    (a, b) =>
      b.quantity - a.quantity ||
      a.partNumber.localeCompare(b.partNumber, undefined, { numeric: true })
  );
  return articles;
}

/** Escapa un valor para CSV (comillas dobles, comas y saltos de línea). */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Genera un CSV de la lista de piezas y lo descarga en el navegador (sin
 * servidor). Una fila por artículo: fabricante, número, descripción, cantidad y
 * las designaciones que lo usan.
 */
export function exportBomCsv(
  articles: BomArticle[],
  header: { manufacturer: string; partNumber: string; description: string; quantity: string; designations: string },
  fileName: string
): void {
  const lines = [
    [header.manufacturer, header.partNumber, header.description, header.quantity, header.designations],
    ...articles.map((a) => [
      a.manufacturer ?? "",
      a.partNumber,
      a.description ?? "",
      String(a.quantity),
      a.devices.map((d) => d.designation).join("; "),
    ]),
  ];
  // BOM UTF-8 para que Excel abra bien los acentos y caracteres CJK.
  const csv = "﻿" + lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
