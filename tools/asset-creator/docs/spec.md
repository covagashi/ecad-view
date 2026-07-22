# Spec declarativa por capas

Formato JSON para modelar una pieza **capa a capa** en vez de escribir un
script `.mjs` contra la `Scene` API. Pensado para que una LLM edite el modelo
incrementalmente (una capa = un grupo lógico de partes) y lo regenere con
`cli/create.mjs`.

Convención EPLAN: **Z hacia arriba, milímetros**; el visor mira desde −Y, así
que el "frente" apunta a −Y.

```bash
node tools/asset-creator/cli/create.mjs <spec.json> [--out dir] [--formats e3d,stl]
# por defecto: --out tools/asset-creator/examples/out --formats e3d,stl
```

`create.mjs` valida, construye la escena, escribe `.e3d`/`.stl`, hace
round-trip del `.e3d` con el lector real (`parseE3d`) y escribe el sidecar de
capas. Imprime un resumen de una línea por capa (nombre, partes, triángulos).

## Estructura raíz

```json
{
  "name": "mi-pieza",
  "viewBox": [200, 200, 200],
  "params": { "W": 40, "H": 60 },
  "layers": [ { "name": "cuerpo", "ops": [ ... ] } ]
}
```

| campo      | oblig. | descripción |
|------------|:---:|--------------|
| `name`     | sí | nombre base de los ficheros de salida (`<name>.e3d`, …). |
| `viewBox`  | no | `[x,y,z]` del volumen de encuadre (número o expresión). Por defecto `[200,200,200]`. |
| `params`   | no | mapa `nombre → número`. **Solo números literales.** |
| `layers`   | sí | array de capas (al menos una). |

## params y expresiones

`params` asocia nombres a **números literales** (cotas del plano, constantes).
Los valores derivados (`W/2`, `-D/2`, direcciones con seno/coseno) se calculan
donde se usan, mediante **expresiones**, o se precalculan como params numéricos
si conviene tenerlos a mano (el evaluador solo hace aritmética, no trigonometría
— para direcciones inclinadas, precalcula `sin`/`cos` como params).

Cualquier campo numérico de una op admite **un número o una expresión string**
sobre los params (y sobre la variable de índice de `repeat`, ver abajo). El
evaluador es propio y seguro (no usa `eval`/`Function`): solo

- números (`3`, `2.5`, `1e-3`),
- identificadores (nombres de params / variable de índice),
- operadores `+ - * /`, paréntesis y unario `-`/`+`.

Ejemplos: `"W/2"`, `"-D_BODY/2"`, `"-WIDTH/2 + (i+0.5)*POLE_W"`,
`"HEIGHT-9+1.6"`.

Los arrays (`center`, `size`, un punto `[y,z]` de un perfil, una columna de
`basis`, …) admiten expresión **por elemento**: `["W/2", 0, "H-5"]`.

## Capas

```json
{
  "name": "bornes-arriba",
  "color": [0.13, 0.13, 0.14],
  "repeat": { "count": "POLES", "dx": "POLE_W" },
  "ops": [ ... ]
}
```

| campo    | oblig. | descripción |
|----------|:---:|--------------|
| `name`   | sí | nombre de la capa (aparece en el resumen y el sidecar). |
| `color`  | no | `[r,g,b]` en 0..1, color por defecto de las ops de la capa. |
| `repeat` | no | repite las ops de la capa (ver abajo). |
| `ops`    | sí | array de operaciones (al menos una). |

### repeat

```json
"repeat": { "count": "POLES", "dx": 17.4, "dy": 0, "dz": 0, "var": "i" }
```

Repite **todas las ops de la capa** `count` veces. En la iteración *i*:

- expone la variable de índice (por defecto `"i"`, 0-based) a las expresiones
  de las ops de esa capa;
- desplaza toda la geometría producida por `[i*dx, i*dy, i*dz]`.

`count`/`dx`/`dy`/`dz` admiten expresiones. `count` debe ser un entero ≥ 0.
Puedes usar `dx…dz` (traslación automática), la variable de índice en las
expresiones, o ambos. Ejemplo: 3 polos separados `POLE_W` en X →
`{ "count": "POLES", "dx": "POLE_W" }` con la op posicionada en el polo 0.

## Operaciones (`ops`)

Cada op es un objeto con el campo discriminador `op`. Mapean 1:1 a la `Scene`
API. Todas admiten `color` (sobrescribe el de la capa) y `transparency`
(0 opaco … 1 invisible).

| `op` | campos | Scene |
|------|--------|-------|
| `box`      | `center[3]`, `size[3]` | `box(center,size)` — caja centrada, tamaño total. |
| `tube`     | `from[3]`, `to[3]`, `radius` | `tube(from,to,radius)` — cilindro entre dos puntos. |
| `ball`     | `center[3]`, `radii[3]` | `ball(center,radii)` — elipsoide alineado a ejes. |
| `cone`     | `base[3]`, `dir[3]`, `len`, `radius` | `cone(base,dir,len,radius)`. |
| `prism`    | `profile[[y,z]…]`, `xCenter`, `width` | `prism(profile,xCenter,width)` — perfil 2D (CCW) extruido en X. |
| `ring`     | `center[3]`, `radii[3]` | `ring(center,radii)` — toro en el plano XY local. |
| `oriented` | `center[3]`, `dir[3]`, `radii[3]` | `oriented(center,dir,radii)` — elipsoide orientado. |
| `part`     | `mesh`, `basis`, `size?`/`profile?` | op genérica con transform arbitrario (ver abajo). |
| `label`    | `text`, `position?`, `height?`, `attach?` | texto EPLAN anclado a otra op. |

### op `part` (genérica)

Para geometría que no encaja en los helpers: un transform (base) arbitrario,
p. ej. un prisma octogonal girado, o una placa cuya escala va **horneada en la
malla** para que una etiqueta anclada no se deforme.

```json
{
  "op": "part",
  "mesh": "box",
  "basis": {
    "x": [9, 0, 0],
    "y": [0, "4.5*perp_y", "4.5*perp_z"],
    "z": [0, "17*tip_y", "17*tip_z"],
    "t": ["-WIDTH/2 + 0.5*POLE_W", "F_NOSE+4 + tip_y*7", "PIVOT_Z + tip_z*7"]
  }
}
```

- `basis`: `{ x, y, z, t }` — las tres columnas de la base 3×3 (llevan la
  escala/orientación) más la traslación. Cada una es un `[·,·,·]` de
  números/expresiones.
- `mesh`: `"box"` (por defecto), `"prism"`, `"sphere"`, `"cylinder"`, `"cone"`
  o `"torus"`.
  - Con `mesh: "prism"` se requiere `profile` (`[[y,z]…]`), extruido en X con
    profundidad 1 (la anchura la pone `basis.x`).
  - Con `mesh: "box"` y `size` `[sx,sy,sz]`, la escala se **hornea en la malla**
    y el transform de la parte queda sin escala (ancla limpia para `label`).
  - En los demás casos la malla es la primitiva **unitaria** y toda la escala la
    aporta `basis`.

### op `label`

```json
{ "op": "label", "text": "1492-SP", "position": [0, -1, 1.6], "height": 3.4, "attach": 0 }
```

Ancla una línea de texto a la **parte** de otra op de la misma capa (misma
iteración de `repeat`):

- `attach`: índice de la op a cuya parte se ancla. Por defecto, la op anterior
  (`índiceDeEstaOp − 1`). Necesario cuando la op anterior es otra `label` (que
  no produce parte).
- `position`: offset `[x,y,z]` en el marco local de la parte ancla. Ancla en una
  parte de escala unidad (p. ej. una `part` box con `size`) para que el texto no
  herede escala.
- `height`: altura del texto en mm.

## Contrato de capas (estable)

Otros agentes/herramientas dependen de esto:

- Cada capa emite `typeId = 10 + índiceDeCapa` en **todas** sus partes.
- `create.mjs` escribe `<outdir>/<name>.layers.json`:

  ```json
  { "layers": [ { "name": "carcasa", "typeId": 10, "parts": 1 }, … ] }
  ```

  `parts` = nº de partes de esa capa (sumando todas las repeticiones).

## Ejemplo completo

`examples/spm3.spec.json` reproduce, capa a capa, el protector de 3 polos que
`examples/spm3.mjs` construía como script monolítico: `params` para las cotas
del plano, `repeat` para los 3 polos, y la op `part` para el vástago inclinado
de la maneta y la barra octogonal de unión. Genera **31 partes / 876 triángulos**
(igual que el script original): la geometría del `.stl` sale byte a byte idéntica
(salvo la cabecera de 80 bytes con el nombre) y el `.e3d` solo difiere en los
`typeId` (`10 + índiceDeCapa` por contrato, frente al `1`/`2` del script).
