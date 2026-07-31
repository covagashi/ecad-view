# Product

## Register

product

## Users

Ingenieros y montadores eléctricos revisando una instalación **in situ**: delante
del armario o de la máquina, con una tablet o un móvil en la mano, luz variable
(nave con fluorescentes, exterior, un rincón mal iluminado), a menudo con una
sola mano libre y sin ganas de esperar.

El trabajo a hacer es siempre una comprobación contra la realidad física:
"¿qué borne es este?", "¿dónde aparece este dispositivo en el esquema?",
"¿qué pieza es esta del modelo 3D y cómo se llama en el proyecto?". Llegan con
un `.epdz` que alguien exportó desde EPLAN y no tienen (ni quieren tener) EPLAN
instalado.

El proyectista de oficina es un usuario secundario real: mismas pantallas,
monitor grande y sesiones más largas. La UI no debe romperse ahí, pero cuando
haya que elegir, gana el caso de campo.

## Product Purpose

Abrir proyectos EPLAN (`.epdz`) y piezas 3D (`.e3d`) en el navegador, sin
instalación, sin servidor y sin subir nada: todo se extrae, parsea y renderiza
en el dispositivo. Un `.epdz` deja de ser un archivo que solo abre quien tiene
la licencia y pasa a ser algo que cualquiera del equipo puede consultar.

Cubre esquemas SVG con navegación de referencias cruzadas, visor 3D de espacios
de instalación, índice de dispositivos, árbol de proyecto y metadatos leídos del
`manifest.db`. Se distribuye como PWA instalable y offline, con envolturas
nativas finas (Tauri en escritorio, Capacitor en móvil) sobre el mismo núcleo web.

Éxito: alguien delante del armario encuentra el dispositivo que busca en menos
tiempo del que tardaría en llamar a la oficina, y sin que ningún archivo salga
de su dispositivo.

## Brand Personality

**Claro, técnico, desdramatizado.** Es EPLAN sin EPLAN: la misma información,
sin la barrera de la herramienta. Habla el vocabulario del proyecto (dispositivo,
página, espacio de instalación, referencia cruzada) porque su usuario lo habla,
pero no arrastra la jerga interna de la exportación (`typeId`, `objectId`, rutas
del archivo) a la superficie.

El tono es el de un compañero competente que responde en una frase: nombra la
cosa, no la celebra. Nada de entusiasmo de producto, nada de disculpas, nada de
copy que explique lo que ya se ve en pantalla. La confianza se transmite por
precisión y velocidad, no por adjetivos.

Emocionalmente busca **alivio**: el archivo se abre, se entiende, y la duda que
trajo el usuario queda resuelta.

## Anti-references

- **EPLAN y el CAD legacy.** Ribbons cargados, iconografía de los 2000, diálogos
  grises con biseles 3D, densidad sin jerarquía. Es de lo que la gente viene
  huyendo; reproducirlo anula la razón de existir del proyecto.
- **SaaS genérico.** Rejillas de cards redondeadas, gradientes morados, hero con
  métricas grandes, ilustraciones flat de stock. Esto es una herramienta de
  consulta técnica, no una landing de startup.
- **Estética de juguete.** Animaciones exageradas, colores saturados, emojis,
  esquinas muy redondeadas. Rompe la credibilidad delante de un ingeniero.
- **Minimalismo vacío.** Tanto aire y tan poco dato que hay que dar cuatro clics
  para ver lo que antes se veía de un vistazo. La densidad aquí es una función,
  no un defecto: el objetivo es densidad *ordenada*, no menos información.

## Design Principles

1. **El plano es el protagonista.** El esquema y el modelo 3D son el contenido;
   todo cromo (rail, paneles, barras) cede espacio, contraste y atención al
   lienzo. Si un elemento de UI no ayuda a leer el plano, sobra.
2. **Densidad ordenada, no aire.** La respuesta a "está muy cargado" es
   jerarquía (peso, agrupación, alineación), nunca quitar datos ni esconderlos
   detrás de más navegación.
3. **Una mano, a distancia de brazo.** Cada acción principal debe alcanzarse con
   el pulgar y leerse sin acercar la pantalla. El caso de campo define los
   mínimos de tamaño y contraste; el escritorio hereda, no al revés.
4. **Los datos del proyecto se traducen, no se filtran en crudo.** Lo que viene
   del `manifest.db` o del binario E3D se muestra con el nombre que el usuario
   reconoce. Los identificadores internos son depuración, no interfaz.
5. **Local y honesto.** Nada sale del dispositivo, y la UI lo demuestra con su
   comportamiento (funciona offline, sin cuentas, sin esperas de red). Cuando
   algo del archivo no se puede interpretar, se dice claramente en vez de
   fingir que no existe.

## Accessibility & Inclusion

**Prioridad declarada: legibilidad con luz dura.** Uso en taller, con la pantalla
a media luminosidad y bajo sol o fluorescentes. El contraste real y el tamaño
mínimo legible mandan sobre la elegancia: nada de texto gris claro "para que
respire", ni etiquetas por debajo del tamaño de cuerpo en superficies que se
leen a distancia de brazo. Ante la duda, el texto se acerca al extremo de tinta
de la rampa.

No se ha fijado un nivel WCAG formal como compromiso del proyecto. Trátese
4.5:1 en texto de cuerpo como el listón de trabajo derivado de la prioridad
anterior, no como una conformidad auditada.

El tema oscuro es el predeterminado y existe tema claro (`data-theme="light"`);
ambos deben cumplir la prioridad de legibilidad, no solo el oscuro. La app tiene
ocho idiomas de interfaz, así que las etiquetas deben aguantar cadenas más
largas que el español sin desbordar.
