# Byndr ECAD Project Viewer

Visor de proyectos EPLAN (modelos 3D `.e3d` y exports `.epdz`) multiplataforma.
El núcleo es web (TypeScript + three.js); el plan de despliegue es web/PWA para
PC y Capacitor para iOS/Android.

## Estructura del monorepo

```
packages/e3d-core/   Intérprete del formato binario E3D (v1-v4), extractor de
                     .epdz (7z-wasm), lector del manifest.db (sql.js/SQLite)
                     y constructor de escenas three.js.
apps/web/            Visor web (Vite + React + three.js), responsive para
                     escritorio y móvil. Drag & drop de .e3d / .epdz, órbita
                     y picking en 3D, esquemas 2D (SVG con pan/zoom/pinch)
                     con nombres estructurados desde SQLite, y ficha de
                     proyecto (propiedades del manifest).
scripts/             parse-samples.mjs: smoke test del parser con los E3D del repo.
```

## Uso

```bash
npm install
npm run dev            # compila el core y arranca el visor en Vite
npm run build          # build completo (core + web)
npm run test:samples   # parsea los E3D de ejemplo y valida el intérprete
```

## Formato E3D (resumen)

Binario little-endian. Cabecera: byte de versión (1-4), transform del modelo,
viewBox y colores de fondo. Después, cuatro arrays con prefijo de longitud:
luces, texturas (BGRA sin comprimir), meshes y partes.

- **Mesh**: vertex buffer intercalado (posición / normal / uv según flags) +
  grupos de caras (material, índices con modo OpenGL: triangles/strip/fan) +
  grupos de aristas (estilo de línea, índices lines/strip/loop).
- **Parte**: referencia a mesh + transform 4x4 + color RGBA (alfa invertida =
  transparencia). Desde v3: `typeId` y `objectId` (id en la BD del proyecto).
  Desde v4: líneas de texto (transform, altura, justificación, UTF-16LE).
- Los ejes son Z-up; el builder de three.js aplica la conversión a Y-up.

## Formato .epdz (resumen)

Archivo **7-zip** (no zip) con `manifest.db` (SQLite), `packages/pages/.../
*.svg` (páginas 2D), `packages/installationspaces/.../*.E3d` (3D) y
`packages/automationML/*.aml` (estructura del proyecto).

El `manifest.db` describe el proyecto completo: tabla `package` (jerarquía
project/page/function/location...), `page_package` (identificadores
estructurados EPLAN por página: ep.1340/1440/1140/1240/1640/1540),
`item` (mapeo package -> fichero dentro del archivo, con tamaños),
`property` (propiedades del proyecto: creador, empresa, versión...) e
`installationspace_package` (espacios de montaje -> modelos .e3d). El visor
lo lee con sql.js para nombrar páginas, la ficha de proyecto y los modelos.

## Material de referencia en el repo

- `ejemplo.epdz` + `ejemplo/` — export de ejemplo, descomprimido.
- `main.js` / `main - copia.js` — bundle del visor original de EPLAN (referencia
  de ingeniería inversa).
- `useless/e3d_reader.mjs` — primer prototipo del lector E3D en JS (origen del
  port a TypeScript de `packages/e3d-core`).
- `funcional basico/app.py` — cliente del EPLAN Data Portal API (residual).
