---
name: verify
description: Build, launch and drive the Covaga ECAD web viewer to verify changes end-to-end.
---

# Verificar la app web

## Build y arranque

```bash
npm ci                 # si node_modules no existe
npm run build          # compila @covaga/e3d-core (tsc) y @covaga/web (tsc --noEmit + vite build)
npm run preview -w @covaga/web -- --port 4173 --strictPort   # sirve dist en http://localhost:4173
```

`npm run dev` también funciona (vite dev en el puerto 5173) si se prefiere no compilar.

## Conducir la app

- No hay Playwright en el repo: instalar `playwright-core` en un directorio temporal
  (¡NO en la raíz del repo: ensucia package.json!) y lanzar el Chromium preinstalado:
  - Linux: `executablePath: "/opt/pw-browsers/chromium-<ver>/chrome-linux/chrome"` (listar `/opt/pw-browsers`).
  - Windows: `executablePath: "%LOCALAPPDATA%\\ms-playwright\\chromium-<ver>\\chrome-win64\\chrome.exe"`.
- Flujos útiles:
  - Abrir los demos: rail izquierdo → `.rail [title="Ajustes"]` → popover `.rail-pop` →
    `button.rail-pop-action`: `nth=0` = proyecto .epdz (Sample_Project de EPLAN: 10 páginas,
    7 modelos E3D, manifest.db), `nth=1` = pieza .e3d suelta.
  - Al abrir un .epdz con 3D se entra directo a la vista 3D: esperar `.model-card`
    (selector de modelo: un `<select>`; cambiar con `selectOption`). Vistas ISO/Frente/Lateral/Planta abajo.
  - Vista 3D: panel derecho de desglose de piezas (`.part-row`, ojo `.part-row-eye` para
    ocultar/mostrar; pie con "{visibles} / {total}"). Si está colapsado, pestaña `.edge-tab`.
  - Navegación entre vistas: rail izquierdo `nav.rail`, botones por `title`:
    `.rail [title="Esquemas"]`, `.rail [title="Proyecto"]` (la vista proyecto `.project-panel`
    solo se habilita si el .epdz trae manifest.db). Pestañas de ficheros abiertos: `.tabstrip .tab`.
  - Esquemas: panel derecho `.pages-panel-inner` con pestañas Páginas/Dispositivos (`.panel-head button`),
    árbol de páginas (`.acc-node`/`.acc-leaf`), filtro `.panel-search input`, pie `.panel-foot .mono`
    ("página N / M") y pager `.panel-foot .pager`. Dispositivos: `.device-item`.
  - Referencias cruzadas: enlaces `a[data-jump-id], a[data-jump-file]` dentro del SVG;
    al saltar se recuadra el destino con `.sheet-highlight`.
  - Barra de estado: `.statusbar` ("fichero · E3D v4 · N partes · N meshes · N páginas").
  - Idioma: preferencia en `localStorage["covaga.locale"]`, autodetección por `navigator.languages`
    (fijar con `browser.newContext({ locale: "de-DE" })`).

## Gotchas

- El demo .epdz tarda unos segundos (extracción 7z-wasm + sql.js): usar timeouts ≥30 s.
- El canvas 3D no permite `readPixels` fiable (buffer no preservado): verificar el render con screenshot.
