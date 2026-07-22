// Harness de previsualización: se empaqueta con esbuild (bundle IIFE
// autocontenido) y se carga en una página `file://` controlada por
// Playwright desde `preview.mjs`. Expone `window.renderE3d(bytesBase64, opts)`,
// que parsea un `.e3d`, construye la escena three.js con `buildThreeScene`
// (mismo código que usa el visor real) y devuelve un PNG (dataURL) del
// canvas, renderizado con las mismas luces y presets de cámara que
// `apps/web/src/viewer/Viewer.tsx`.
import * as THREE from "three";
import { parseE3d } from "@covaga/e3d-core";
import { buildThreeScene } from "@covaga/e3d-core/three";

// Direcciones de cámara idénticas a PRESET_DIRECTIONS en Viewer.tsx (espacio
// Y-arriba de three.js: buildThreeScene ya rota Z-arriba de EPLAN a Y-arriba
// internamente, así que estos vectores se aplican directamente).
const PRESET_DIRECTIONS = {
  iso: [0.6, 0.5, 0.6],
  front: [0, 0, 1],
  side: [1, 0, 0],
  // Ligero desvío del eje para que la base de la cámara no degenere.
  top: [0.001, 1, 0.001],
};

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * @param {string} bytesBase64 contenido del .e3d, en base64
 * @param {{ size?: number, angle?: "iso"|"front"|"side"|"top", skipTypeIds?: number[] }} opts
 * @returns {string} dataURL PNG del render
 */
window.renderE3d = function renderE3d(bytesBase64, opts) {
  const { size = 800, angle = "iso", skipTypeIds = [] } = opts || {};
  const direction = PRESET_DIRECTIONS[angle];
  if (!direction) throw new Error(`Ángulo desconocido: ${angle}`);

  const scene = parseE3d(base64ToArrayBuffer(bytesBase64));
  const { root, background } = buildThreeScene(scene, { skipTypeIds });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  document.body.appendChild(canvas);

  // preserveDrawingBuffer: hacemos toDataURL justo después de renderer.render,
  // en el mismo tick, pero lo dejamos explícito por si algún día se anima.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);

  const threeScene = new THREE.Scene();
  // Fondo sugerido por el propio fichero (no el tema de la app).
  threeScene.background = background.top;

  // Mismas luces que el visor real (Viewer.tsx): hemisferio + direccional.
  threeScene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(1, 2, 1.5);
  threeScene.add(dirLight);

  threeScene.add(root);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);

  // Encuadre automático: bounding box del modelo + margen, cámara mirando
  // desde `direction` (mismo cálculo que Viewer.frame()).
  const box = new THREE.Box3().setFromObject(root);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    const extent = box.getSize(new THREE.Vector3()).length();
    const distance = Math.max(extent, 1) * 1.2;
    const dirVec = new THREE.Vector3(...direction).normalize();
    camera.position.copy(center).addScaledVector(dirVec, distance);
    camera.near = distance / 1000;
    camera.far = distance * 100;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }

  renderer.render(threeScene, camera);
  return canvas.toDataURL("image/png");
};
