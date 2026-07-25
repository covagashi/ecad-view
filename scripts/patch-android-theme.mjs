#!/usr/bin/env node
/*
 * Ajustes del tema de la app Android generada por Capacitor (el proyecto
 * android/ no está en el repo: lo crea "cap add android" en cada release).
 *
 *  - forceDarkAllowed=false: sin esto el WebView aplica su "modo oscuro
 *    forzado" sobre una interfaz que YA es oscura, y pinta una caja blanca
 *    detrás de cada SVG inline (todos los iconos de la app).
 *  - windowFullscreen: el visor usa toda la pantalla, sin barra de estado.
 *  - shortEdges: se dibuja también bajo la muesca; el CSS ya aparta la
 *    interfaz con env(safe-area-inset-*).
 *
 * Falla si no encuentra el estilo, para que un cambio de plantilla de
 * Capacitor se note en el build en vez de reaparecer el fallo en silencio.
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2] ?? "apps/mobile/android/app/src/main/res/values/styles.xml";
const items = [
  '<item name="android:forceDarkAllowed">false</item>',
  '<item name="android:windowFullscreen">true</item>',
  '<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>',
];

const xml = readFileSync(file, "utf8");
const open = xml.match(/<style name="AppTheme\.NoActionBar"[^>]*>/);
if (!open) {
  console.error(`No se encontró el estilo AppTheme.NoActionBar en ${file}`);
  process.exit(1);
}

const insertAt = open.index + open[0].length;
const patched =
  xml.slice(0, insertAt) +
  items.map((item) => `\n        ${item}`).join("") +
  xml.slice(insertAt);
writeFileSync(file, patched);
console.log(`Tema Android parcheado (${items.length} items) en ${file}`);
