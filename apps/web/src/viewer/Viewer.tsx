import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { E3dScene } from "@covaga/e3d-core";
import { buildThreeScene } from "@covaga/e3d-core/three";
import { cssVar, onThemeChange } from "../theme";

export type ViewPreset = "iso" | "front" | "side" | "top";

/** Controles imperativos del visor 3D (toolbar y presets externos). */
export interface ViewerHandle {
  fit(): void;
  setPreset(preset: ViewPreset): void;
  /**
   * Aplica la visibilidad por pieza: con `isolated` solo se muestra esa parte;
   * si no, se ocultan los objectIds de `hidden`.
   */
  applyVisibility(hidden: ReadonlySet<number>, isolated: number | null): void;
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
}

interface ViewerHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  modelRoot: THREE.Group | null;
  selectionBox: THREE.Box3Helper | null;
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
  { scene, onPickPart },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<ViewerHandles | null>(null);
  const onPickRef = useRef(onPickPart);
  onPickRef.current = onPickPart;

  useEffect(() => {
    const container = containerRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    // El fondo sigue al tema de la aplicación (variable --canvas).
    threeScene.background = new THREE.Color(cssVar("--canvas") || "#1a1e25");
    const disposeThemeWatch = onThemeChange(() => {
      threeScene.background = new THREE.Color(cssVar("--canvas") || "#1a1e25");
    });

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

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / Math.max(1, clientHeight);
      camera.updateProjectionMatrix();
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
        const box = new THREE.Box3().setFromObject(pickedObject);
        handles.selectionBox = new THREE.Box3Helper(
          box,
          new THREE.Color(cssVar("--accent") || "#5b9dff")
        );
        threeScene.add(handles.selectionBox);
      }
      onPickRef.current(picked);
    };
    renderer.domElement.addEventListener("click", onClick);

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(threeScene, camera);
    });

    handlesRef.current = {
      renderer,
      scene: threeScene,
      camera,
      controls,
      modelRoot: null,
      selectionBox: null,
    };

    return () => {
      disposeThemeWatch();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("click", onClick);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      handlesRef.current = null;
    };
  }, []);

  /** Encuadra el modelo con la cámara mirando desde `direction`. */
  const frame = (direction: [number, number, number]) => {
    const handles = handlesRef.current;
    if (!handles?.modelRoot) return;
    const box = new THREE.Box3().setFromObject(handles.modelRoot);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const distance = Math.max(size, 1) * 1.2;
    handles.controls.target.copy(center);
    handles.camera.position
      .copy(center)
      .addScaledVector(new THREE.Vector3(...direction).normalize(), distance);
    handles.camera.near = distance / 1000;
    handles.camera.far = distance * 100;
    handles.camera.updateProjectionMatrix();
    handles.controls.update();
  };

  /** Primer grupo de parte con ese objectId, o null. */
  const findPart = (objectId: number): THREE.Object3D | null => {
    const handles = handlesRef.current;
    if (!handles?.modelRoot) return null;
    let found: THREE.Object3D | null = null;
    handles.modelRoot.traverse((obj) => {
      if (!found && obj.userData.meshId !== undefined && obj.userData.objectId === objectId) {
        found = obj;
      }
    });
    return found;
  };

  useImperativeHandle(ref, () => ({
    fit: () => frame(PRESET_DIRECTIONS.iso),
    setPreset: (preset) => frame(PRESET_DIRECTIONS[preset]),
    applyVisibility(hidden, isolated) {
      const handles = handlesRef.current;
      if (!handles?.modelRoot) return;
      handles.modelRoot.traverse((obj) => {
        if (obj.userData.meshId !== undefined) {
          const objectId = obj.userData.objectId as number | undefined;
          obj.visible =
            isolated !== null
              ? objectId === isolated
              : objectId === undefined || !hidden.has(objectId);
        }
      });
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
      const box = new THREE.Box3().setFromObject(part);
      if (!box.isEmpty()) {
        handles.selectionBox = new THREE.Box3Helper(
          box,
          new THREE.Color(cssVar("--accent") || "#5b9dff")
        );
        handles.scene.add(handles.selectionBox);
      }
      return part.userData;
    },
    focusPart(objectId) {
      const handles = handlesRef.current;
      const part = findPart(objectId);
      if (!handles || !part) return;
      const box = new THREE.Box3().setFromObject(part);
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      const distance = Math.max(size * 2.2, 5);
      const direction = handles.camera.position.clone().sub(handles.controls.target).normalize();
      handles.controls.target.copy(center);
      handles.camera.position.copy(center).addScaledVector(direction, distance);
      handles.controls.update();
    },
    clearSelection() {
      const handles = handlesRef.current;
      if (handles?.selectionBox) {
        handles.scene.remove(handles.selectionBox);
        handles.selectionBox = null;
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
    frame(PRESET_DIRECTIONS.iso);
  }, [scene]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
});

function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}
