// Spec declarativa POR CAPAS -> Scene (lib/geometry.mjs).
//
// Una LLM (u otro agente) modela una pieza editando JSON capa a capa en vez de
// escribir un script .mjs entero. El formato completo se documenta en
// docs/spec.md. Aquí se carga, se valida (con errores que apuntan al campo
// exacto) y se construye la Scene.
//
// CONTRATO (no cambiar, hay otro agente que depende de él):
//   - Cada capa se emite con typeId = 10 + índiceDeCapa en TODAS sus partes.
//   - create.mjs escribe un sidecar con { layers: [{ name, typeId, parts }] }.
import {
  Scene,
  boxTris,
  extrudeTris,
  sphereTris,
  cylinderTris,
  coneTris,
  torusTris,
} from "./geometry.mjs";

// ---------- evaluador de expresiones (propio, sin eval/Function) ----------
// Gramática soportada: números, identificadores (params + variable de índice),
// + - * /, paréntesis y unario -/+. Nada más: es a propósito minimalista.

function tokenize(src, path) {
  const tokens = [];
  const re = /\s*([A-Za-z_][A-Za-z0-9_]*|\d*\.?\d+(?:[eE][+-]?\d+)?|[()+\-*/])/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) {
      throw specError(path, `carácter inesperado en la expresión "${src}" (posición ${i})`);
    }
    i = re.lastIndex;
    const tok = m[1];
    if (/^[A-Za-z_]/.test(tok)) tokens.push({ t: "id", v: tok });
    else if (/^[.\d]/.test(tok)) tokens.push({ t: "num", v: Number(tok) });
    else tokens.push({ t: tok });
  }
  return tokens;
}

/** Evalúa una expresión aritmética de string sobre `scope` (nombre->número). */
export function evalExpr(src, scope, path) {
  const tokens = tokenize(src, path);
  let pos = 0;
  const peek = () => tokens[pos];
  const fail = (msg) => specError(path, `${msg} en la expresión "${src}"`);

  function parsePrimary() {
    const tk = peek();
    if (!tk) throw fail("expresión incompleta");
    if (tk.t === "(") {
      pos++;
      const v = parseAddSub();
      if (!peek() || peek().t !== ")") throw fail("falta ')'");
      pos++;
      return v;
    }
    if (tk.t === "num") {
      pos++;
      return tk.v;
    }
    if (tk.t === "id") {
      pos++;
      if (!(tk.v in scope)) throw fail(`variable desconocida "${tk.v}"`);
      return scope[tk.v];
    }
    throw fail(`token inesperado "${tk.t}"`);
  }
  function parseUnary() {
    const tk = peek();
    if (tk && (tk.t === "-" || tk.t === "+")) {
      pos++;
      const v = parseUnary();
      return tk.t === "-" ? -v : v;
    }
    return parsePrimary();
  }
  function parseMulDiv() {
    let v = parseUnary();
    while (peek() && (peek().t === "*" || peek().t === "/")) {
      const op = peek().t;
      pos++;
      const r = parseUnary();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function parseAddSub() {
    let v = parseMulDiv();
    while (peek() && (peek().t === "+" || peek().t === "-")) {
      const op = peek().t;
      pos++;
      const r = parseMulDiv();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const value = parseAddSub();
  if (pos < tokens.length) throw fail("texto sobrante tras la expresión");
  if (!Number.isFinite(value)) throw fail("el resultado no es un número finito");
  return value;
}

// ---------- errores con ruta al campo ----------
class SpecError extends Error {}
function specError(path, msg) {
  return new SpecError(`${path}: ${msg}`);
}

// ---------- resolución de campos numéricos ----------
// Cualquier campo numérico admite un número o una expresión string.

function resolveNum(value, scope, path) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw specError(path, "se esperaba un número finito");
    return value;
  }
  if (typeof value === "string") return evalExpr(value, scope, path);
  throw specError(path, "se esperaba un número o una expresión (string)");
}

function resolveVec(value, n, scope, path) {
  if (!Array.isArray(value) || value.length !== n) {
    throw specError(path, `se esperaban ${n} números`);
  }
  return value.map((v, i) => resolveNum(v, scope, `${path}[${i}]`));
}

function resolveColor(value, scope, path) {
  const c = resolveVec(value, 3, scope, path);
  return c;
}

/** Perfil 2D: array de pares [y,z] (números o expresiones). */
function resolveProfile(value, scope, path) {
  if (!Array.isArray(value) || value.length < 3) {
    throw specError(path, "se esperaba un array de al menos 3 puntos [y,z]");
  }
  return value.map((p, i) => resolveVec(p, 2, scope, `${path}[${i}]`));
}

// ---------- opciones comunes de una op ----------
function opColor(op, layer, scope, path) {
  const raw = op.color ?? layer.color ?? [0.8, 0.8, 0.8];
  return resolveColor(raw, scope, op.color != null ? `${path}.color` : `${path}(color heredado)`);
}
function opOpts(op, scope, path) {
  const opts = {};
  if (op.transparency != null) opts.transparency = resolveNum(op.transparency, scope, `${path}.transparency`);
  return opts;
}

// ---------- construcción de las ops geométricas ----------
// Devuelven las partes que han creado (para poder desplazarlas por `repeat`,
// fijarles el typeId de capa y anclarles etiquetas).

const PRIMITIVE_MESH = {
  box: boxTris,
  sphere: sphereTris,
  cylinder: cylinderTris,
  cone: coneTris,
  torus: torusTris,
};

function buildGeometryOp(scene, op, layer, scope, path) {
  const color = opColor(op, layer, scope, path);
  const opts = opOpts(op, scope, path);
  switch (op.op) {
    case "box":
      return [scene.box(resolveVec(op.center, 3, scope, `${path}.center`), resolveVec(op.size, 3, scope, `${path}.size`), color, opts)];
    case "tube":
      return [scene.tube(resolveVec(op.from, 3, scope, `${path}.from`), resolveVec(op.to, 3, scope, `${path}.to`), resolveNum(op.radius, scope, `${path}.radius`), color, opts)];
    case "ball":
      return [scene.ball(resolveVec(op.center, 3, scope, `${path}.center`), resolveVec(op.radii, 3, scope, `${path}.radii`), color, opts)];
    case "cone":
      return [scene.cone(resolveVec(op.base, 3, scope, `${path}.base`), resolveVec(op.dir, 3, scope, `${path}.dir`), resolveNum(op.len, scope, `${path}.len`), resolveNum(op.radius, scope, `${path}.radius`), color, opts)];
    case "prism":
      return [scene.prism(resolveProfile(op.profile, scope, `${path}.profile`), resolveNum(op.xCenter, scope, `${path}.xCenter`), resolveNum(op.width, scope, `${path}.width`), color, opts)];
    case "ring":
      return [scene.ring(resolveVec(op.center, 3, scope, `${path}.center`), resolveVec(op.radii, 3, scope, `${path}.radii`), color, opts)];
    case "oriented":
      return [scene.oriented(resolveVec(op.center, 3, scope, `${path}.center`), resolveVec(op.dir, 3, scope, `${path}.dir`), resolveVec(op.radii, 3, scope, `${path}.radii`), color, opts)];
    case "part":
      return [buildPartOp(scene, op, color, opts, scope, path)];
    default:
      throw specError(path, `op desconocida "${op.op}"`);
  }
}

// op genérica "part": malla + transform (base) arbitrario. Cubre los casos que
// no encajan en los helpers (p. ej. un prisma octogonal girado, o una placa de
// marcado con la escala horneada en la malla para que la etiqueta no se
// deforme). Ver docs/spec.md.
function buildPartOp(scene, op, color, opts, scope, path) {
  const mesh = op.mesh ?? "box";
  const basis = op.basis;
  if (basis == null || typeof basis !== "object") {
    throw specError(`${path}.basis`, "se esperaba { x,y,z,t } (columnas de la base + traslación)");
  }
  const transform = {
    x: resolveVec(basis.x, 3, scope, `${path}.basis.x`),
    y: resolveVec(basis.y, 3, scope, `${path}.basis.y`),
    z: resolveVec(basis.z, 3, scope, `${path}.basis.z`),
    t: resolveVec(basis.t, 3, scope, `${path}.basis.t`),
  };
  let meshId;
  if (mesh === "prism") {
    meshId = scene.addMesh(extrudeTris(resolveProfile(op.profile, scope, `${path}.profile`)));
  } else if (mesh === "box" && op.size != null) {
    // Escala horneada en la malla: el transform de la parte queda sin escala,
    // ideal como ancla de etiquetas (ver Scene.label).
    const [sx, sy, sz] = resolveVec(op.size, 3, scope, `${path}.size`);
    meshId = scene.addMesh(boxTris(), (p) => [p[0] * sx, p[1] * sy, p[2] * sz]);
  } else if (mesh in PRIMITIVE_MESH) {
    meshId = scene._primitive(mesh, PRIMITIVE_MESH[mesh]);
  } else {
    throw specError(`${path}.mesh`, `malla desconocida "${mesh}" (box|prism|sphere|cylinder|cone|torus)`);
  }
  return scene.part(meshId, transform, color, opts);
}

// ---------- validación de estructura ----------
function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function validateParams(raw) {
  if (raw == null) return {};
  if (!isPlainObject(raw)) throw specError("params", "se esperaba un objeto nombre->número");
  const params = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw specError(`params.${k}`, "se esperaba un número (los params son números literales)");
    }
    params[k] = v;
  }
  return params;
}

// ---------- API principal ----------
/**
 * Carga una spec ya parseada (objeto JS) -> { scene, layers }.
 * `layers` = [{ name, typeId, parts }] en orden de capa (para el sidecar).
 */
export function buildSceneFromSpec(spec) {
  if (!isPlainObject(spec)) throw specError("(raíz)", "la spec debe ser un objeto JSON");
  if (typeof spec.name !== "string" || !spec.name) {
    throw specError("name", "se esperaba un nombre (string no vacío)");
  }
  const params = validateParams(spec.params);

  const sceneOpts = {};
  if (spec.viewBox != null) {
    sceneOpts.viewBox = resolveVec(spec.viewBox, 3, params, "viewBox");
  }
  const scene = new Scene(sceneOpts);

  if (!Array.isArray(spec.layers) || spec.layers.length === 0) {
    throw specError("layers", "se esperaba un array de al menos una capa");
  }

  const layersInfo = [];
  spec.layers.forEach((layer, li) => {
    const lpath = `layers[${li}]`;
    if (!isPlainObject(layer)) throw specError(lpath, "se esperaba un objeto de capa");
    if (typeof layer.name !== "string" || !layer.name) {
      throw specError(`${lpath}.name`, "se esperaba un nombre (string no vacío)");
    }
    if (!Array.isArray(layer.ops) || layer.ops.length === 0) {
      throw specError(`${lpath}.ops`, "se esperaba un array de al menos una op");
    }
    const typeId = 10 + li;

    // repeat: repite las ops de la capa desplazándolas y exponiendo el índice.
    let count = 1;
    let dx = 0, dy = 0, dz = 0, indexVar = "i";
    if (layer.repeat != null) {
      const rp = layer.repeat;
      if (!isPlainObject(rp)) throw specError(`${lpath}.repeat`, "se esperaba { count, dx?, dy?, dz?, var? }");
      count = resolveNum(rp.count, params, `${lpath}.repeat.count`);
      if (!Number.isInteger(count) || count < 0) {
        throw specError(`${lpath}.repeat.count`, "se esperaba un entero >= 0");
      }
      if (rp.dx != null) dx = resolveNum(rp.dx, params, `${lpath}.repeat.dx`);
      if (rp.dy != null) dy = resolveNum(rp.dy, params, `${lpath}.repeat.dy`);
      if (rp.dz != null) dz = resolveNum(rp.dz, params, `${lpath}.repeat.dz`);
      if (rp.var != null) {
        if (typeof rp.var !== "string" || !rp.var) throw specError(`${lpath}.repeat.var`, "se esperaba un nombre de variable");
        indexVar = rp.var;
      }
    }

    const partsBefore = scene.parts.length;
    for (let iter = 0; iter < count; iter++) {
      const scope = { ...params, [indexVar]: iter };
      const offset = [iter * dx, iter * dy, iter * dz];
      const producedByOp = [];
      layer.ops.forEach((op, oi) => {
        const opath = `${lpath}.ops[${oi}]`;
        if (!isPlainObject(op) || typeof op.op !== "string") {
          throw specError(opath, 'se esperaba una op con campo "op" (box|tube|ball|cone|prism|ring|oriented|part|label)');
        }
        if (op.op === "label") {
          const attachIdx = op.attach != null ? op.attach : oi - 1;
          if (!Number.isInteger(attachIdx) || attachIdx < 0 || attachIdx >= layer.ops.length) {
            throw specError(`${opath}.attach`, `índice de op fuera de rango (${attachIdx})`);
          }
          const anchors = producedByOp[attachIdx];
          if (!anchors || anchors.length === 0) {
            throw specError(`${opath}.attach`, `la op ${attachIdx} no produjo ninguna parte a la que anclar`);
          }
          if (typeof op.text !== "string") throw specError(`${opath}.text`, "se esperaba un texto (string)");
          const labelOpts = {};
          if (op.position != null) labelOpts.position = resolveVec(op.position, 3, scope, `${opath}.position`);
          if (op.height != null) labelOpts.height = resolveNum(op.height, scope, `${opath}.height`);
          scene.label(anchors[anchors.length - 1], op.text, labelOpts);
          producedByOp[oi] = [];
          return;
        }
        const created = buildGeometryOp(scene, op, layer, scope, opath);
        for (const part of created) {
          part.transform = { ...part.transform, t: [part.transform.t[0] + offset[0], part.transform.t[1] + offset[1], part.transform.t[2] + offset[2]] };
          part.typeId = typeId;
        }
        producedByOp[oi] = created;
      });
    }

    layersInfo.push({ name: layer.name, typeId, parts: scene.parts.length - partsBefore });
  });

  return { scene, layers: layersInfo };
}
