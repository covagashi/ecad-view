---
name: Covaga ECAD Project Viewer
description: Visor de proyectos EPLAN en el navegador; mesa de luz oscura donde el plano es lo único que brilla.
colors:
  ink-blue: "#5b9dff"
  ink-blue-light: "#2e6be6"
  on-accent: "#07090c"
  on-accent-light: "#ffffff"
  table: "#0b0d11"
  panel: "#0e1116"
  panel-raised: "#12151b"
  canvas: "#1a1e25"
  ink: "#e6eaf0"
  ink-muted: "#8b94a3"
  ink-faint: "#5c6470"
  border: "#ffffff12"
  border-strong: "#ffffff24"
  danger: "#e5534b"
  ok: "#4ade80"
  table-light: "#f5f6f3"
  panel-light: "#e9ebe6"
  panel-raised-light: "#ffffff"
  canvas-light: "#e2e5df"
  ink-light: "#1a222e"
  ink-muted-light: "#5b6572"
  ink-faint-light: "#8a93a0"
  border-light: "#0f172a1a"
  border-strong-light: "#0f172a29"
  ok-light: "#16a34a"
typography:
  headline:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "normal"
  subtitle:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  body-compact:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.1em"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tabular-nums"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  sheet: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "5px 12px"
  button-primary:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "5px 12px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "5px 12px"
  rail-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    height: "38px"
  rail-item-active:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.ink-blue}"
    rounded: "{rounded.lg}"
    height: "38px"
  input-search:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  pill:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.ink-blue}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  card:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-compact}"
    rounded: "8px 8px 0 0"
    padding: "0 12px"
    height: "42px"
  tab-active:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-compact}"
    rounded: "8px 8px 0 0"
    padding: "0 12px"
    height: "42px"
---

# Design System: Covaga ECAD Project Viewer

## 1. Overview

**Creative North Star: "La mesa de luz"**

El fondo oscuro es la mesa. El plano, el esquema SVG o el modelo 3D, es la lámina
iluminada que se apoya encima. Todo lo demás (rail, pestañas, paneles, barra de
estado) es el marco de la mesa: está ahí, se usa constantemente, y nunca compite
con la lámina por la atención. Esta metáfora explica de una vez por qué el tema
oscuro es el predeterminado, por qué el cromo vive en grises casi sin croma, y
por qué existe un único color de acento en todo el sistema.

La densidad es deliberada. Un ingeniero delante de un armario quiere ver la lista
de dispositivos, el árbol del proyecto y la página abierta a la vez, no
descubrirlos de tres clics. El sistema resuelve la carga con jerarquía (peso
tipográfico, agrupación, alineación, capas tonales) y no con espacio en blanco.
Las superficies se apilan en tres tonos casi contiguos (`table` para el marco,
`panel` para las zonas de trabajo, `panel-raised` para lo que está enfocado o
seleccionado) separados por bordes de 1px, sin sombra entre ellos.

El sistema rechaza explícitamente cuatro cosas, heredadas de las anti-referencias
de PRODUCT.md: el CAD legado (ribbons cargados, biseles 3D, densidad sin
jerarquía), el SaaS genérico (rejillas de cards redondeadas, gradientes,
ilustraciones de stock), la estética de juguete (color saturado decorativo,
animación exagerada) y el minimalismo vacío (aire que cuesta clics). Como el uso
real es en taller y a distancia de brazo, el listón de legibilidad y de tamaño de
target manda sobre cualquier decisión estética.

**Key Characteristics:**
- Sigue la preferencia del sistema y cae a oscuro cuando no hay ninguna; el tema claro (`data-theme="light"`) es paritario, no un modo de segunda.
- Un solo acento en todo el sistema; el resto es neutro frío casi sin croma.
- Profundidad por tono y borde de 1px, no por sombra.
- IBM Plex Sans en toda la interfaz, IBM Plex Mono reservado a identificadores y cifras.
- Controles compactos en reposo, pero con mínimos de tamaño que crecen antes que encoger.
- Autoalojado y offline: fuentes, iconos y assets viajan con la app.

## 2. Colors

Neutros fríos casi sin croma, atravesados por un único azul que solo aparece
donde hay acción o selección.

### Primary
- **Azul de tinta técnica** (`#5b9dff` en oscuro, `#2e6be6` en claro): el azul del
  lápiz de delineante. Es el único color de señal del sistema y aparece en cuatro
  sitios: acción primaria, elemento de navegación activo, resaltado del destino
  de una referencia cruzada, y pills de dato. Sus dos derivados de transparencia,
  `accent-dim` (14%) y `accent-strong` (35%), cubren los fondos de estado activo y
  los anillos de foco; el color pleno nunca se usa como fondo de superficie grande.

### Neutral
- **Mesa** (`#0b0d11` oscuro, `#f5f6f3` claro): el marco de la aplicación. Barra
  de pestañas, rail y fondo general.
- **Panel** (`#0e1116` oscuro, `#e9ebe6` claro): zonas de trabajo laterales y
  cabeceras de datos.
- **Panel elevado** (`#12151b` oscuro, `#ffffff` claro): lo que está enfocado,
  seleccionado o abierto. Pestaña activa, tarjeta de proyecto, campo de búsqueda.
- **Lienzo** (`#1a1e25` oscuro, `#e2e5df` claro): el fondo del visor 3D y del
  lienzo de esquemas. Es el único neutro que se aparta del resto, porque debe
  quedar claro dónde acaba la interfaz y empieza el modelo.
- **Tinta** (`#e6eaf0` oscuro, `#1a222e` claro): texto de cuerpo y valores.
- **Tinta apagada** (`#8b94a3` oscuro, `#5b6572` claro): etiquetas, cabeceras de
  columna, texto secundario. Es el tono más claro admitido para texto que el
  usuario tiene que leer.
- **Tinta tenue** (`#5c6470` oscuro, `#8a93a0` claro): iconografía inactiva y
  glifos decorativos. Nunca información necesaria ni placeholders legibles.
- **Bordes** (blanco al 7% y al 14% en oscuro; `#0f172a` al 10% y al 16% en claro):
  el separador por defecto es el de 1px al 7%; el fuerte marca contornos de
  control interactivo.

### Tertiary
- **Rojo de fallo** (`#e5534b`): errores de parseo, avisos de mecanizado, acciones
  destructivas.
- **Verde de conformidad** (`#4ade80` oscuro, `#16a34a` claro): validaciones
  correctas y estados resueltos.

### Named Rules

**La Regla de la Lámina.** El lienzo del plano nunca lleva encima color de marca.
Ningún acento, gradiente ni tinte se superpone al SVG del esquema ni al render
3D salvo para señalar un objetivo concreto que el usuario acaba de pedir (destino
de una referencia cruzada, pieza aislada, resultado de búsqueda). El color en el
lienzo es información, jamás decoración.

**La Regla de la Voz Única.** Hay un solo acento. Si una pantalla necesita un
segundo color para distinguir dos cosas, el problema es de jerarquía, no de
paleta: resuélvase con peso, agrupación o posición. Rojo y verde son semánticos,
no acentos disponibles.

**La Regla de la Tinta Tenue.** `ink-faint` está prohibido en cualquier texto que
el usuario necesite leer (incluido el placeholder de un campo de búsqueda). Su
sitio son iconos inactivos y glifos decorativos. En el momento en que una etiqueta
pasa a ser información, sube a `ink-muted` como mínimo.

## 3. Typography

**Body Font:** IBM Plex Sans (con `system-ui`, `-apple-system`, Segoe UI, Roboto)
**Label/Mono Font:** IBM Plex Mono (con `ui-monospace`, Cascadia Mono, Consolas)

Ambas autoalojadas vía `@fontsource` en subconjuntos latin y latin-ext, para que
la PWA, Tauri y Capacitor funcionen sin conexión. CJK cae a fuentes del sistema
por el font stack.

**Character:** IBM Plex es una tipografía de ingeniería sin ser nostálgica: rasgos
rectos, aperturas amplias, una `l` con cola que no se confunde con `1` ni con `I`.
Esto último no es un detalle estético en una app donde se leen designaciones de
dispositivo como `-K1.1` o `=A1+B2-X3`. La familia sans lleva toda la interfaz;
la mono está reservada a lo que se transcribe literalmente del proyecto.

### Hierarchy
- **Headline** (700, 21px, 1.2): título de la biblioteca de proyectos. Un solo uso por pantalla.
- **Title** (650, 19px, 1.25): cabecera de una vista de datos o del panel de proyecto, y cifras de estadística.
- **Subtitle** (600, 16px, 1.35): cabecera de zona de arrastre y de estados vacíos.
- **Body** (400, 13px, 1.45): tamaño base de la aplicación. Texto de párrafo, valores de tabla, contenido de panel.
- **Body compact** (400, 12.5px, 1.4): pestañas, subtítulos, filas densas de tabla.
- **Label** (600, 11px, `letter-spacing: 0.1em`, mayúsculas): rótulos de sección dentro de un panel. Máximo cuatro palabras.
- **Data** (mono 400, 12px, `tabular-nums`): designaciones de dispositivo, nombres de página, propiedades del proyecto, cualquier cadena que venga literal del `manifest.db` o del binario E3D.

### Named Rules

**La Regla del Suelo de 11px.** 11px es el tamaño mínimo del sistema, y solo para
etiquetas en mayúsculas con tracking. Cualquier cosa por debajo (10.5px, 10px,
9px) es deriva y debe subir. El usuario lee esto en una nave, con la pantalla a
media luminosidad; un rótulo de 9px no existe.

**La Regla de la Mono Literal.** Si la cadena viene del archivo del proyecto, va
en mono. Si la ha escrito la interfaz, va en sans. Esta frontera es lo que
permite distinguir de un vistazo el dato del proyecto de la etiqueta que lo
describe, y hace innecesario ponerle color.

**La Regla de los Siete Peldaños.** El sistema tiene siete roles tipográficos y
ni uno más. Un tamaño nuevo a mitad de camino entre dos existentes no es
jerarquía, es ruido: elíjase el peldaño más cercano.

## 4. Elevation

Plano por defecto. La profundidad se construye apilando tonos casi contiguos
(`table` → `panel` → `panel-raised`) y separándolos con un borde de 1px al 7%.
Un panel lateral, una tarjeta o una fila seleccionada no llevan sombra: se
distinguen por tono y contorno. La sombra queda reservada a lo que de verdad se
despega del plano de la mesa y flota temporalmente sobre otro contenido.

Los radios y las sombras del cromo viven en `apps/web/src/styles/tokens.css`.
Los nombres de trabajo del CSS (`--bg`, `--text`, `--panel-2`) conviven con
alias canónicos de este documento (`--table`, `--ink`, `--panel-raised`).

### Shadow Vocabulary
- **Flotante** (token `--shadow-float`): controles que se superponen al lienzo, como el bloque de presets de vista del visor 3D.
- **Tarjeta** (token `--shadow-card`): superficies que se abren sobre el contenido y lo bloquean: panel del rail expandido, hojas móviles, botón de acción flotante.
- **Anillo de foco** (token `--focus-ring`): no es elevación, es estado. Marca el elemento seleccionado o enfocado por teclado.

### Named Rules

**La Regla de la Sombra que se Gana.** Una superficie solo lleva sombra si puede
desaparecer: si flota, se abre, o tapa algo. Todo lo que forma parte de la
estructura fija de la pantalla es plano. Prueba de auditoría: si el elemento
sigue en pantalla después de pulsar Escape, no debe llevar sombra.

**La Regla del Foco Visible.** `outline: none` sin sustituto está prohibido.
Aparece hoy en varios campos e inputs; cada uno de esos sitios debe llevar el
anillo de acento. Un visor que se navega con teclado entre página, dispositivo y
pieza no puede perder el cursor de foco.

## 5. Components

### Buttons
- **Shape:** esquinas contenidas (8px, `{rounded.md}`).
- **Default:** fondo transparente, borde de 1px en `border-strong`, texto en tinta,
  relleno `5px 12px`. Silencioso en reposo.
- **Primary:** relleno pleno de acento con texto en `on-accent` y peso 600. Uno
  por vista como máximo.
- **Quiet:** sin borde, texto en `ink-muted`, sube a tinta plena al pasar por encima.
- **Hover / Focus:** hover cambia fondo a `panel-raised` y refuerza el borde en
  120ms. El primario aclara un 10% con `filter: brightness(1.1)` sin mover el
  fondo. Foco: anillo de acento de 3px.
- **Disabled:** opacidad 0.45 y cursor por defecto, sin cambio de color.

### Chips
- **Style:** píldora completa (999px) sobre `panel`, borde de 1px en `border-strong`, texto en `ink-muted` a 12px, relleno `5px 12px`. Se usan como filtros de mecanizado y agrupadores.
- **State:** el chip seleccionado invierte a fondo `accent-dim` con texto en acento y el borde pasa a `accent-strong`. Nunca acento pleno de fondo: un chip no es una acción primaria.

### Pills / Badges
- **Style:** píldora informativa no interactiva, fondo `accent-dim`, texto en acento, 10.5px con `tabular-nums`, relleno `1px 8px`. Variantes `warn` y `ok` con la misma forma y el semántico correspondiente mezclado al 14%.
- **Nota:** son el único componente por debajo del suelo de 11px y deben subir a 11px al tocarlos.

### Cards / Containers
- **Corner Style:** 12px (`{rounded.xl}`); las tarjetas de proyecto de la biblioteca son el uso canónico.
- **Background:** `panel-raised`, con la miniatura sobre `canvas`.
- **Shadow Strategy:** ninguna. Ver Elevation.
- **Border:** 1px en `border`; pasa a `border-strong` en hover y a `accent-strong` más anillo de foco de 3px cuando la tarjeta está activa.
- **Internal Padding:** el contenido respira a 12-16px; la tarjeta en sí no lleva relleno porque la miniatura sangra a los bordes.
- **Grid:** `repeat(auto-fill, minmax(210px, 1fr))` con separación de 16px, sin breakpoints.

### Inputs / Fields
- **Style:** contenedor sobre `panel-raised` con borde de 1px, 10px de radio (`--radius-lg`) y relleno `8px 12px`. El `<input>` interno es transparente y sin borde; el contenedor es lo que se ve. Icono a la izquierda en `ink-faint`.
- **Focus:** el borde pasa a acento y aparece `--focus-ring` (anillo de 3px en `accent-dim`). El `outline: none` solo se usa junto a ese anillo (`:focus-visible` en base y en campos compuestos).
- **Placeholder:** `ink-muted` (no `ink-faint`): el placeholder es texto que hay que leer, con el mismo listón de contraste que el cuerpo.

### Navigation
- **Rail (escritorio):** columna de 56px que se expande a 220px al pasar por encima o al recibir foco, con transición de 160ms y retardo de 150ms para no dispararse al cruzar el ratón. Cada elemento mide 38px de alto, 10px de radio, icono más etiqueta con separación de 12px. Reposo en `ink-muted`; hover pinta `panel-raised`; activo pinta `accent-dim` con texto en acento. El panel expandido flota con sombra de tarjeta.
- **Pestañas de proyecto:** 42px de alto, radio superior de 8px, `body-compact`. Inactiva en `ink-muted` sobre el fondo de la mesa; activa en `panel-raised` con borde y peso 600, cosida visualmente al contenido de abajo. Un punto de 4px en acento marca la pestaña que está cargando.
- **Móvil:** por debajo de 760px de ancho o 500px de alto, la navegación pasa a barra inferior con hojas modales de radio superior 16px, entrando con `sheet-slide-up` de 220ms en `cubic-bezier(0.32, 0.72, 0.24, 1)` y el fondo con fundido de 160ms. La zona de agarre y los botones flotantes son píldoras completas con sombra de tarjeta.

### Signature: el lienzo del plano
El área del visor (esquema SVG o escena three.js) se trata como un material
distinto de la interfaz: fondo `canvas`, sin borde, sin radio, a sangre contra
sus paneles. El cromo que se le superpone (presets de vista, controles de zoom,
selector de modelo) es siempre traslúcido sobre panel con sombra flotante, nunca
opaco a ancho completo, y se aparta de las esquinas donde caen los gestos de
pinza y arrastre. El resaltado de una referencia cruzada es la única animación
del lienzo: un pulso de anillo de acento de 1.2s repetido dos veces, que termina
solo y no deja rastro.

## 6. Do's and Don'ts

### Do:
- **Do** usar el suelo de 11px como mínimo absoluto de tamaño de texto, y solo para etiquetas en mayúsculas. Todo lo demás vive en 12.5px o más.
- **Do** llevar cada identificador que venga del proyecto (`manifest.db`, binario E3D, nombres de página) a IBM Plex Mono con `tabular-nums`.
- **Do** dar al usuario de taller targets de 44px como mínimo en móvil, aunque cueste densidad. Si algo tiene que ceder, cede el espacio del cromo, nunca el tamaño del control.
- **Do** construir profundidad con los tres tonos de superficie y bordes de 1px antes de pensar en una sombra.
- **Do** usar el anillo de foco canónico: `box-shadow: var(--focus-ring)` (3px en `accent-dim`) en `:focus-visible`. Nunca `outline: none` sin ese anillo.
- **Do** mantener la paridad del tema claro: cualquier regla nueva se comprueba en `data-theme="light"` antes de darse por hecha.
- **Do** limitar las transiciones a 120-220ms con salida suave, y solo sobre cambio de estado.
- **Do** dejar sitio a cadenas largas: la interfaz tiene ocho idiomas y el alemán ocupa un 35% más que el español.
- **Do** tomar radios solo de la escala en `tokens.css`: `--radius-sm` (6) / `--radius-md` (8) / `--radius-lg` (10) / `--radius-xl` (12) / `--radius-sheet` (16) / `--radius-pill` (999). Círculos verdaderos usan `50%`.

### Don't:
- **Don't** reproducir el **CAD legado**: nada de biseles 3D, iconografía de los 2000, ni barras de herramientas apiladas sin jerarquía.
- **Don't** caer en el **SaaS genérico**: sin gradientes, sin rejillas de cards redondeadas repetidas hasta el final de la página, sin hero de métricas, sin ilustraciones flat de stock.
- **Don't** usar **estética de juguete**: sin animaciones exageradas, sin colores saturados decorativos, sin emojis en la interfaz, sin radios por encima de 16px salvo píldoras.
- **Don't** resolver "está muy cargado" con **minimalismo vacío**. Si una pantalla agobia, se arregla con jerarquía; esconder datos detrás de un clic más es empeorarla.
- **Don't** introducir un segundo color de acento. Rojo y verde son semánticos y no cuentan como paleta disponible.
- **Don't** poner texto informativo en `ink-faint` ni gris claro "para que respire". Ante la duda, el texto sube hacia tinta.
- **Don't** inventar radios nuevos ni escribir píxeles a mano. La escala es 6 / 8 / 10 / 12 / 16 / 999 vía variables CSS; cualquier valor fuera de esa lista es un defecto.
- **Don't** escribir sombras a mano. Solo `--shadow-float`, `--shadow-card` y `--focus-ring`.
- **Don't** añadir animaciones sin respetar el `@media (prefers-reduced-motion: reduce)` global de `base.css` (y el suyo propio si hace falta), sobre todo con three.js activo en móvil.
- **Don't** sacar identificadores internos (`typeId`, `objectId`, rutas dentro del archivo) a la superficie. Son depuración, no interfaz.
- **Don't** poner cromo de marca encima del lienzo del plano. El color ahí es información.
