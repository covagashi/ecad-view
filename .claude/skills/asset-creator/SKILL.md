---
name: asset-creator
description: Create and preview 3D parts layer-by-layer from declarative JSON specs.
---

# Modelado 3D por capas

## El bucle

1. Edita `<spec>.json` (spec declarativa por capas)
2. Genera con `create.mjs` → `.e3d` + sidecar `.layers.json`
3. Visualiza con `preview.mjs` → PNGs (ángulos: iso/front/side/top)
4. Mira los PNGs → ajusta **solo la capa afectada**
5. Repite desde el paso 2

## Comandos exactos

```bash
# Generar la pieza (spec → .e3d/.stl + sidecar)
node tools/asset-creator/cli/create.mjs <spec.json> [--out dir] [--formats e3d,stl]

# Renderizar PNGs (default: iso,front,side,top)
node tools/asset-creator/cli/preview.mjs <file.e3d> [--angles front,iso] [--size 800]

# Aislar una capa en el preview (requiere sidecar .layers.json)
node tools/asset-creator/cli/preview.mjs <file.e3d> --isolate <capa>

# Ver solo capas específicas
node tools/asset-creator/cli/preview.mjs <file.e3d> --only-layers a,b
```

Por defecto:
- `--out` = `tools/asset-creator/examples/out`
- `--formats` = `e3d,stl`
- `--angles` = `iso,front,side,top`
- `--size` = `800`

## Formato de spec (resumen)

```json
{
  "name": "mi-pieza",
  "viewBox": [200, 200, 200],
  "params": { "W": 40, "H": 60 },
  "layers": [
    {
      "name": "cuerpo",
      "color": [0.9, 0.9, 0.9],
      "repeat": { "count": 3, "dx": 15 },
      "ops": [
        { "op": "box", "center": [0, 0, 30], "size": [40, 20, 60] },
        { "op": "tube", "from": [0, -12, 50], "to": [0, -18, 50], "radius": 3 },
        { "op": "label", "text": "K1M", "position": [0, -22, 50], "height": 10 }
      ]
    }
  ]
}
```

**Referencia completa:** [`tools/asset-creator/docs/spec.md`](../../tools/asset-creator/docs/spec.md)

Operaciones (`op`):
- `box` — caja centrada
- `tube` — cilindro entre dos puntos
- `ball` — elipsoide
- `cone` — cono
- `prism` — perfil 2D (CCW) extruido en X
- `ring` — toro
- `oriented` — elipsoide orientado
- `part` — transform arbitrario (base 3×3 + traslación)
- `label` — texto EPLAN anclado

## Convenciones y gotchas

- **Z arriba, milímetros** (EPLAN)
- **Frente = −Y** (el visor mira desde −Y)
- **Evitar caras coplanarias** → z-fighting (asegura offsets mínimos entre polígonos)
- **El evaluador NO hace trigonometría** → precalcula `sin`/`cos` como params
  (el JSON no admite comentarios; usa nombres descriptivos):
  ```json
  "params": { "cos_35deg": 0.819152, "sin_35deg": 0.573576 }
  ```
- **typeId = 10 + índice de capa** (contrato estable; herramientas dependen de esto)
- **Primer preview tarda** (instala Chromium en tmpdir) → los siguientes usan caché

## Ejemplo funcionando

7 capas, 31 partes, 876 triángulos:
```bash
node tools/asset-creator/cli/create.mjs tools/asset-creator/examples/spm3.spec.json
node tools/asset-creator/cli/preview.mjs tools/asset-creator/examples/out/spm3.e3d
```

Ver [`examples/spm3.spec.json`](../../tools/asset-creator/examples/spm3.spec.json) para protector de 3 polos con cuerpo (prism 2D), maneta inclinada y barra octogonal.
