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
  y lanzar el Chromium preinstalado con
  `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`
  (la ruta `/opt/pw-browsers/chromium/...` NO existe; listar `/opt/pw-browsers` si cambia la versión).
- Flujos útiles:
  - Pantalla vacía: `h1` del dropzone, barra de estado `.statusbar .grow`.
  - Cargar demo: clic en `button.demo-btn >> nth=0` (proyecto .epdz con 32 páginas y manifest)
    o `nth=1` (pieza .e3d suelta). Esperar `.tabs`.
  - Pestañas `.tabs button`: 3D / esquemas / proyecto. La vista proyecto (`.project-panel`)
    solo se habilita si el .epdz trae manifest.db.
  - Sidebar de páginas: filtro en `.search input`.
  - Idioma: selector `.lang-select` en la topbar; preferencia en `localStorage["covaga.locale"]`,
    autodetección por `navigator.languages` (fijar con `browser.newContext({ locale: "de-DE" })`).

## Gotchas

- El demo .epdz tarda unos segundos (extracción 7z-wasm + sql.js): usar timeouts ≥30 s.
