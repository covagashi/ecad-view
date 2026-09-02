import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { E3dScene } from "@covaga/e3d-core";
import {
  applySceneVisibility,
  buildThreeScene,
  findScenePart,
  partWorldBox,
} from "@covaga/e3d-core/three";
import { cssVar, onThemeChange } from "../theme";

export type ViewPreset = "iso" | "front" | "side" | "top";

/** Controles imperativos del visor 3D (toolbar y presets externos). */
export interface ViewerHandle {
  fit(): void;
  setPreset(preset: ViewPreset): void;
  /**
   * Aplica la visibilidad por pieza: con `isolated` solo se muestran esas
   * partes (un objectId o un conjunto); si no, se ocultan los de `hidden`.
   */
  applyVisibility(
    hidden: ReadonlySet<number>,
    isolated: number | ReadonlySet<number> | null
  ): void;
  /**
   * Encuadra el conjunto de piezas indicadas (por objectId) mirando desde
   * `preset`, ajustando la distancia al campo de visión real del lienzo.
   */
  frameParts(objectIds: Iterable<number>, preset: ViewPreset): void;
  /** Selecciona la parte (recuadro) y devuelve su userData, o null si no existe. */
  selectPart(objectId: number): Record<string, unknown> | null;
  /** Acerca la cámara a la parte manteniendo la dirección de vista. */
  focusPart(objectId: number): void;
  /** Quita el recuadro de selección. */
  clearSelection(): void;
}

export interface ViewerProps {
  scene: E3dScene | null;
  /** Se llama al hacer clic sobre una parte, con su userData ({ typeId, objectId, meshId, textLines }). */
  onPickPart?: (info: Record<string, unknown> | null) => void;
  /** Preset con el que se encuadra la escena al cargarla (iso por defecto). */
  initialPreset?: ViewPreset;
  /** false = vista fija: ni órbita, ni desplazamiento, ni zoom (previsualización). */
  interactive?: boolean;
}

interface ViewerHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  modelRoot: THREE.Group | null;
  selectionBox: THREE.Box3Helper | null;
  invalidate: () => void;
}

/** Dirección de cámara de cada preset (espacio Y-arriba de three.js). */
const PRESET_DIRECTIONS: Record<ViewPreset, [number, number, number]> = {
  iso: [0.6, 0.5, 0.6],
  front: [0, 0, 1],
  side: [1, 0, 0],
  // Ligeramente fuera del eje para que OrbitControls no degenere.
  top: [0.001, 1, 0.001],
};

export const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer(
  { scene, onPickPart, initialPreset = "iso", interactive = true },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<ViewerHandles | null>(null);
  const onPickRef = useRef(onPickPart);
  onPickRef.current = onPickPart;

  useEffect(() => {
    const container = containerRef.current!;
    // Comprobar GL antes de construir el renderer: en headless/WebView el
    // constructor de three.js puede lanzar y tumbar el árbol de React.
    const probe = document.createElement("canvas");
    const gl =
      probe.getContext("webgl", { failIfMajorPerformanceCaveat: false }) ||
      probe.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: false });
    if (!gl) {
      container.replaceChildren();
      const note = document.createElement("div");
      note.className = "data-note";
      note.style.padding = "24px";
      note.textContent = "3D no disponible en este dispositivo.";
      container.appendChild(note);
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: document.createElement("canvas"),
        powerPreference: "high-performance",
      });
    } catch {
      container.replaceChildren();
      const note = document.createElement("div");
      note.className = "data-note";
      note.style.padding = "24px";
      note.textContent = "3D no disponible en este dispositivo.";
      container.appendChild(note);
      return;
    }
    // Capar el DPR evita rellenar 3–4× más píxeles en pantallas retina sin
    // cambiar el aspecto en 1×/2× (el techo coincide con el buffer nativo).
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    // El fondo sigue al tema de la aplicación (variable --canvas).
    threeScene.background = new THREE.Color(cssVar("--canvas") || "#1a1e25");

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);
    camera.position.set(200, 200, 200);

    threeScene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(1, 2, 1.5);
    threeScene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // Amortiguación corta: con la de serie la cámara sigue derivando ~2 s
    // tras soltar, alargando cualquier shimmer de las líneas.
    controls.dampingFactor = 0.12;

    let needsRender = true;
    const invalidate = () => {
      needsRender = true;
    };

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / Math.max(1, clientHeight);
      camera.updateProjectionMatrix();
      invalidate();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const raycaster = new THREE.Raycaster();
    const onClick = (event: MouseEvent) => {
      const handles = handlesRef.current;
      if (!handles?.modelRoot || !onPickRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(handles.modelRoot, true);
      let picked: Record<string, unknown> | null = null;
      let pickedObject: THREE.Object3D | null = null;
      for (const hit of hits) {
        if (!hit.object.visible) continue;
        const batched = hit.object as THREE.BatchedMesh & { isBatchedMesh?: boolean };
        if (batched.isBatchedMesh) {
          const batchId = (hit as { batchId?: number }).batchId;
          const objectId =
            batchId !== undefined
              ? (batched.userData.instanceToPart as Array<number | undefined> | undefined)?.[batchId]
              : undefined;
          if (objectId === undefined) continue;
          const part = findScenePart(handles.modelRoot, objectId);
          if (part?.visible) {
            picked = part.userData;
            pickedObject = part;
            break;
          }
          continue;
        }
        if (hit.object.userData.kind === "e3d-edges") continue;
        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj.userData.meshId === undefined) obj = obj.parent;
        if (obj && obj.visible) {
          picked = obj.userData;
          pickedObject = obj;
          break;
        }
      }

      if (handles.selectionBox) {
        threeScene.remove(handles.selectionBox);
        handles.selectionBox = null;
      }
      if (pickedObject) {
        const box = partWorldBox(pickedObject);
        handles.selectionBox = new THREE.Box3Helper(
          box,
          new THREE.Color(cssVar("--accent") || "#5b9dff")
        );
        threeScene.add(handles.selectionBox);
      }
      onPickRef.current(picked);
      handles.invalidate();
    };
    renderer.domElement.addEventListener("click", onClick);

    controls.addEventListener("change", invalidate);
    const disposeThemeWatch = onThemeChange(() => {
      threeScene.background = new THREE.Color(cssVar("--canvas") || "#1a1e25");
      invalidate();
    });

    renderer.setAnimationLoop(() => {
      controls.update();
      if (!needsRender) return;
      renderer.render(threeScene, camera);
      needsRender = false;
    });

    handlesRef.current = {
      renderer,
      scene: threeScene,
      camera,
      controls,
      modelRoot: null,
      selectionBox: null,
      invalidate,
    };

    return () => {
      disposeThemeWatch();
      controls.removeEventListener("change", invalidate);
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("click", onClick);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      handlesRef.current = null;
    };
  }, []);

  // Vista fija (p. ej. la previsualización de una conexión): sin controles.
  useEffect(() => {
    const controls = handlesRef.current?.controls;
    if (controls) controls.enabled = interactive;
  }, [interactive]);

  /**
   * Distancia a la que la esfera envolvente de `box` entra en el encuadre, con
   * el campo de visión y la relación de aspecto reales del lienzo: si no, un
   * objeto pequeño en un panel ancho y bajo se ve diminuto y lejos.
   */
  const fitDistance = (box: THREE.Box3, margin: number): number => {
    const camera = handlesRef.current!.camera;
    const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 0.5);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect, 0.01));
    return (radius / Math.sin(Math.min(vFov, hFov) / 2)) * margin;
  };

  /** Sitúa la cámara a `distance` del centro, en la dirección dada. */
  const placeCamera = (
    center: THREE.Vector3,
    direction: THREE.Vector3,
    distance: number
  ) => {
    const handles = handlesRef.current!;
    handles.controls.target.copy(center);
    handles.camera.position.copy(center).addScaledVector(direction.normalize(), distance);
    handles.camera.near = distance / 1000;
    handles.camera.far = distance * 100;
    handles.camera.updateProjectionMatrix();
    handles.controls.update();
    handles.invalidate();
  };

  /** Coloca la cámara para encuadrar `box` mirando desde `direction`. */
  const frameBox3 = (box: THREE.Box3, direction: [number, number, number]) => {
    const handles = handlesRef.current;
    if (!handles || box.isEmpty()) return;
    placeCamera(
      box.getCenter(new THREE.Vector3()),
      new THREE.Vector3(...direction),
      fitDistance(box, 1.05)
    );
  };

  /** Encuadra el modelo con la cámara mirando desde `direction`. */
  const frame = (direction: [number, number, number]) => {
    const handles = handlesRef.current;
    if (!handles?.modelRoot) return;
    frameBox3(new THREE.Box3().setFromObject(handles.modelRoot), direction);
  };

  /** Primer grupo de parte con ese objectId, o null. */
  const findPart = (objectId: number): THREE.Object3D | null => {
    const handles = handlesRef.current;
    if (!handles?.modelRoot) return null;
    return findScenePart(handles.modelRoot, objectId);
  };

  useImperativeHandle(ref, () => ({
    fit: () => frame(PRESET_DIRECTIONS.iso),
    setPreset: (preset) => frame(PRESET_DIRECTIONS[preset]),
    applyVisibility(hidden, isolated) {
      const handles = handlesRef.current;
      if (!handles?.modelRoot) return;
      applySceneVisibility(handles.modelRoot, hidden, isolated);
      handles.invalidate();
    },
    frameParts(objectIds, preset) {
      const handles = handlesRef.current;
      if (!handles?.modelRoot) return;
      const box = new THREE.Box3();
      for (const objectId of objectIds) {
        const part = findPart(objectId);
        if (part) box.union(partWorldBox(part));
      }
      if (box.isEmpty()) return;
      frameBox3(box, PRESET_DIRECTIONS[preset]);
    },
    selectPart(objectId) {
      const handles = handlesRef.current;
      if (!handles) return null;
      if (handles.selectionBox) {
        handles.scene.remove(handles.selectionBox);
        handles.selectionBox = null;
      }
      const part = findPart(objectId);
      if (!part) return null;
      const box = partWorldBox(part);
      if (!box.isEmpty()) {
        handles.selectionBox = new THREE.Box3Helper(
          box,
          new THREE.Color(cssVar("--accent") || "#5b9dff")
        );
        handles.scene.add(handles.selectionBox);
      }
      handles.invalidate();
      return part.userData;
    },
    focusPart(objectId) {
      const handles = handlesRef.current;
      const part = findPart(objectId);
      if (!handles || !part) return;
      const box = partWorldBox(part);
      if (box.isEmpty()) return;
      // Se conserva la dirección de vista actual: solo se acerca.
      const direction = handles.camera.position.clone().sub(handles.controls.target);
      if (direction.lengthSq() === 0) direction.set(0.6, 0.5, 0.6);
      placeCamera(box.getCenter(new THREE.Vector3()), direction, fitDistance(box, 1.25));
    },
    clearSelection() {
      const handles = handlesRef.current;
      if (handles?.selectionBox) {
        handles.scene.remove(handles.selectionBox);
        handles.selectionBox = null;
        handles.invalidate();
      }
    },
  }));

  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;

    if (handles.modelRoot) {
      handles.scene.remove(handles.modelRoot);
      disposeTree(handles.modelRoot);
      handles.modelRoot = null;
    }
    if (handles.selectionBox) {
      handles.scene.remove(handles.selectionBox);
      handles.selectionBox = null;
    }
    if (!scene) return;

    const { root } = buildThreeScene(scene);
    handles.scene.add(root);
    handles.modelRoot = root;

    // Encuadra la cámara sobre el modelo.
    frame(PRESET_DIRECTIONS[initialPreset]);
    handles.invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
});

function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const batched = obj as THREE.BatchedMesh & { isBatchedMesh?: boolean };
    if (batched.isBatchedMesh) {
      const material = batched.material as THREE.Material | THREE.Material[] | undefined;
      batched.dispose();
      const disposeMat = (m: THREE.Material) => {
        const map = (m as THREE.MeshBasicMaterial).map;
        map?.dispose();
        m.dispose();
      };
      if (Array.isArray(material)) material.forEach(disposeMat);
      else if (material) disposeMat(material);
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.MeshBasicMaterial | THREE.Material | THREE.Material[] | undefined;
    const disposeMat = (m: THREE.Material) => {
      const map = (m as THREE.MeshBasicMaterial).map;
      map?.dispose();
      m.dispose();
    };
    if (Array.isArray(material)) material.forEach(disposeMat);
    else if (material) disposeMat(material);
  });
}
